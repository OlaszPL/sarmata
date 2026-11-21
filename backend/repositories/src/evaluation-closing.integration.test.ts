import type { Database } from '@sarmata/database';
import { calendarDate, emptySheetContent } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  type ServiceDb,
  createEvaluationClosingStore,
  createRepositories,
  createServiceClient,
} from './index';

const [regulation2016] = officialRegulations;
if (regulation2016 === undefined) throw new Error('The official regulation catalog is empty');

const DEMO_OFFICE_ID = '11111111-1111-4111-8111-111111111111';
const SYSTEM_AUTHOR = '00000000-0000-0000-0000-000000000000';

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

const serviceClient = (): ServiceDb =>
  createServiceClient({ url: env('SUPABASE_URL'), secretKey: env('SUPABASE_SECRET_KEY') });

const today = calendarDate(new Date().toISOString().slice(0, 10));

describe('closing evaluations after the objection window', () => {
  it('service client closes a delivered evaluation and the account sees closed status', async () => {
    const evaluatorDb = await signedIn('oceniajacy@kropka.test');
    const repositories = createRepositories(evaluatorDb);
    const employee = (await repositories.employees.list()).find(
      (candidate) => candidate.lastName === 'Administracyjna',
    );
    if (employee === undefined) throw new Error('No demo employee Administracyjna');
    const regulationVersionId = await repositories.regulationVersions.findOfficialRowId(
      regulation2016.id,
    );
    if (regulationVersionId === null) throw new Error('Official regulation row is missing');
    const { data: user } = await evaluatorDb.auth.getUser();
    const evaluation = await repositories.evaluations.create({
      employeeId: employee.id,
      evaluatorAccountId: user.user?.id ?? '',
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

    // A delivered evaluation whose objection window ended long ago.
    const service = serviceClient();
    const delivered = await service
      .from('evaluations')
      .update({ status: 'delivered' })
      .eq('id', evaluation.id);
    if (delivered.error) throw delivered.error;
    const slot = await service.from('evaluation_deadlines').upsert({
      evaluation_id: evaluation.id,
      office_id: DEMO_OFFICE_ID,
      slot: 'objection',
      due_on: '2020-01-01',
      suspended_since: null,
    });
    if (slot.error) throw slot.error;

    const store = createEvaluationClosingStore(service);
    const closed = await store.closeUnobjected(today);
    expect(closed).toContainEqual({ evaluationId: evaluation.id, officeId: DEMO_OFFICE_ID });
    expect(await store.closeUnobjected(today)).toEqual([]);

    const detail = await repositories.evaluations.get(evaluation.id);
    expect(detail?.status).toBe('closed');
    const event = detail?.events.find((candidate) => candidate.kind === 'closed');
    expect(event).toMatchObject({
      occurredOn: today,
      payload: { automatic: true },
      recordedBy: SYSTEM_AUTHOR,
    });
  });
});
