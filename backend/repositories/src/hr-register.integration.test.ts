import type { Database } from '@sarmata/database';
import { calendarDate, emptySheetContent } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  RepositoryError,
  createHrRegisterRepository,
  createOfficeSettingsRepository,
  createRepositories,
} from './index';

const [regulation2016] = officialRegulations;
if (regulation2016 === undefined) throw new Error('The official regulation catalog is empty');
const regulation2016Id = regulation2016.id;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, run the tests with "pnpm test:integration"`);
  return value;
}

async function signedIn(email: string): Promise<Db> {
  const db: Db = createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email, password: 'Haslo-Demo-2026' });
  if (error) throw error;
  return db;
}

const today = calendarDate(new Date().toISOString().slice(0, 10));

/** A fresh evaluation of the employee, started as the demo evaluator. */
async function startFor(lastName: string) {
  const db = await signedIn('oceniajacy@kropka.test');
  const repositories = createRepositories(db);
  const employee = (await repositories.employees.list()).find((e) => e.lastName === lastName);
  if (employee === undefined) throw new Error(`No demo employee ${lastName}`);
  const regulationVersionId =
    await repositories.regulationVersions.findOfficialRowId(regulation2016Id);
  if (regulationVersionId === null) throw new Error('Official regulation row is missing');
  const { data } = await db.auth.getUser();
  const evaluation = await repositories.evaluations.create({
    employeeId: employee.id,
    evaluatorAccountId: data.user?.id ?? '',
    regulationVersionId,
    sheetId: 'C',
    cycleStart: today,
    afterNegative: false,
    previousEvaluationId: null,
    previousAcquaintedOn: null,
    snapshot: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      positionTitle: employee.positionTitle,
      orgUnit: employee.orgUnit,
      serviceStatus: employee.serviceStatus,
      grade: employee.grade,
      appointmentYear: employee.appointmentYear,
      gradeGrantedOn: employee.gradeGrantedOn,
    },
    content: emptySheetContent(),
  });
  return { repositories, employee, evaluation };
}

/** Drives the evaluation to the objection and lets hr reject it. */
async function rejectedObjection(evaluationId: string) {
  const evaluator = createRepositories(await signedIn('oceniajacy@kropka.test'));
  const hr = createRepositories(await signedIn('kadry@kropka.test'));
  const step = (
    expectedStatus: Parameters<typeof evaluator.evaluations.applyTransition>[0]['expectedStatus'],
    nextStatus: Parameters<typeof evaluator.evaluations.applyTransition>[0]['nextStatus'],
    eventKind: Parameters<typeof evaluator.evaluations.applyTransition>[0]['eventKind'],
    lockSheet: boolean,
  ) => ({
    evaluationId,
    expectedStatus,
    nextStatus,
    eventKind,
    occurredOn: today,
    payload: {},
    lockSheet,
  });
  await evaluator.evaluations.applyTransition(
    step('criteria', 'criteria_awaiting_signature', 'part_one_approved', false),
  );
  await evaluator.evaluations.applyTransition(
    step('criteria_awaiting_signature', 'period', 'part_one_signed', false),
  );
  await evaluator.evaluations.applyTransition(
    step('period', 'interview', 'evaluation_interview_held', false),
  );
  await evaluator.evaluations.applyTransition(step('interview', 'drafted', 'sheet_approved', true));
  await evaluator.evaluations.applyTransition(step('drafted', 'delivered', 'acquainted', false));
  await hr.evaluations.applyTransition(step('delivered', 'objection', 'objection_filed', false));
  await hr.evaluations.applyObjectionOutcome({
    evaluationId,
    outcome: 'rejected',
    occurredOn: today,
    payload: {},
    newContent: null,
  });
  return hr;
}

describe('hr register', () => {
  it('hr records appeal after a rejected objection', async () => {
    const { evaluation } = await startFor('Administracyjna');
    const hr = await rejectedObjection(evaluation.id);
    await createHrRegisterRepository(await signedIn('kadry@kropka.test')).recordLabourCourtAppeal({
      evaluationId: evaluation.id,
      filedOn: today,
    });
    const detail = await hr.evaluations.get(evaluation.id);
    expect(detail?.events.map((event) => event.kind)).toContain('labour_court_appeal');
  });

  it('hr grants grade by law and the employee grade changes', async () => {
    const { evaluation, employee } = await startFor('Ewidencyjna');
    const hrDb = await signedIn('kadry@kropka.test');
    const hr = createHrRegisterRepository(hrDb);
    const newGrade = (employee.grade ?? 0) + 1;
    await hr.recordGradeGrant({
      employeeId: employee.id,
      evaluationId: evaluation.id,
      basis: 'by_law',
      grantedOn: today,
      newGrade,
    });
    const after = (await createRepositories(hrDb).employees.get(employee.id))?.grade;
    expect(after).toBe(newGrade);
    const grants = await hr.gradeGrants(employee.id);
    expect(grants[0]).toMatchObject({
      basis: 'by_law',
      evaluationId: evaluation.id,
      previousGrade: employee.grade,
      newGrade,
    });
  });

  it('evaluator gets 42501 from grade grant', async () => {
    const { evaluation, employee } = await startFor('Ewidencyjna');
    const evaluator = createHrRegisterRepository(await signedIn('oceniajacy@kropka.test'));
    const attempt = evaluator.recordGradeGrant({
      employeeId: employee.id,
      evaluationId: evaluation.id,
      basis: 'by_law',
      grantedOn: today,
      newGrade: 9,
    });
    await expect(attempt).rejects.toBeInstanceOf(RepositoryError);
    await expect(attempt).rejects.toMatchObject({ code: '42501' });
  });

  it('admin sets evaluator thresholds and hr reads them', async () => {
    const admin = createOfficeSettingsRepository(await signedIn('admin@kropka.test'));
    const hr = createOfficeSettingsRepository(await signedIn('kadry@kropka.test'));
    try {
      const updated = await admin.update({
        evaluatorFlags: { minEvaluations: 2, centralShare: 0.7, leniencyPoints: 1.5 },
      });
      expect(updated?.evaluatorFlags).toEqual({
        minEvaluations: 2,
        centralShare: 0.7,
        leniencyPoints: 1.5,
      });
      expect((await hr.get())?.evaluatorFlags).toEqual({
        minEvaluations: 2,
        centralShare: 0.7,
        leniencyPoints: 1.5,
      });
    } finally {
      await admin.update({
        evaluatorFlags: { minEvaluations: 5, centralShare: 0.8, leniencyPoints: 1 },
      });
    }
  });

  it('hr cannot change thresholds', async () => {
    const hr = createOfficeSettingsRepository(await signedIn('kadry@kropka.test'));
    expect(await hr.update({ evaluatorFlags: { minEvaluations: 9 } })).toBeNull();
    expect((await hr.get())?.evaluatorFlags.minEvaluations).toBe(5);
  });
});
