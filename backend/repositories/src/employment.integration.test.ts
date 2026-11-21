import type { Database } from '@sarmata/database';
import {
  calendarDate,
  emptySheetContent,
  retainedFacts,
  retentionEndsOn,
  sheetCriteria,
} from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  type ServiceDb,
  RepositoryError,
  createEmploymentRepository,
  createRepositories,
  createRetentionStore,
  createServiceClient,
} from './index';

const [regulation2016] = officialRegulations;
if (regulation2016 === undefined) throw new Error('The official regulation catalog is empty');
const regulationCode = regulation2016.id;

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
const unique = () => `${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`;

/** A new employee entered by hr, with an evaluation opened by the demo evaluator. */
async function employeeWithEvaluation() {
  const hrDb = await signedIn('kadry@kropka.test');
  const evaluatorDb = await signedIn('oceniajacy@kropka.test');
  const hr = createRepositories(hrDb);
  const employee = await hr.employees.create({
    firstName: 'Tymczasowy',
    lastName: `Odchodzący${unique()}`,
    email: null,
    positionTitle: 'Referent',
    orgUnit: 'Wydział Testowy',
    positionKind: 'other',
    serviceStatus: 'employee',
    employmentBasis: 'indefinite',
    employmentStart: calendarDate('2010-05-17'),
    appointmentYear: null,
    grade: null,
    gradeGrantedOn: null,
    employmentEndedOn: null,
    supervisorEmployeeId: null,
  });
  const evaluator = createRepositories(evaluatorDb);
  const regulationVersionId = await evaluator.regulationVersions.findOfficialRowId(regulationCode);
  if (regulationVersionId === null) throw new Error('Official regulation row is missing');
  const { data: user } = await evaluatorDb.auth.getUser();
  const evaluation = await evaluator.evaluations.create({
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
  return { hrDb, evaluatorDb, hr, employee, evaluation };
}

describe('ending an employment', () => {
  it('hr ends employment and sees interrupted evaluation', async () => {
    const { hrDb, hr, employee, evaluation } = await employeeWithEvaluation();
    const result = await createEmploymentRepository(hrDb).end({
      employeeId: employee.id,
      endedOn: calendarDate('2026-03-15'),
      reason: 'wypowiedzenie umowy',
      purgeDueOn: retentionEndsOn(calendarDate('2026-03-15')),
    });
    expect(result.interruptedEvaluationIds).toEqual([evaluation.id]);
    expect((await hr.evaluations.get(evaluation.id))?.status).toBe('interrupted');
    expect((await hr.employees.get(employee.id))?.employmentEndedOn).toBe('2026-03-15');
  });

  it('ending twice fails already_ended', async () => {
    const { hrDb, employee } = await employeeWithEvaluation();
    const employment = createEmploymentRepository(hrDb);
    const input = {
      employeeId: employee.id,
      endedOn: calendarDate('2026-03-15'),
      reason: 'x',
      purgeDueOn: calendarDate('2036-12-31'),
    };
    await employment.end(input);
    const error: unknown = await employment.end(input).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).code).toBe('already_ended');
  });

  it('evaluator cannot end employment', async () => {
    const { evaluatorDb, employee } = await employeeWithEvaluation();
    const error: unknown = await createEmploymentRepository(evaluatorDb)
      .end({
        employeeId: employee.id,
        endedOn: calendarDate('2026-03-15'),
        reason: 'x',
        purgeDueOn: calendarDate('2036-12-31'),
      })
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );
    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).code).toBe('42501');
  });

  it('hr overview lists the employee and the confirmation is recorded', async () => {
    const { hrDb, employee } = await employeeWithEvaluation();
    const employment = createEmploymentRepository(hrDb);
    await employment.end({
      employeeId: employee.id,
      endedOn: calendarDate('2026-03-15'),
      reason: 'x',
      purgeDueOn: calendarDate('2036-12-31'),
    });
    expect((await employment.retentionOverview(30)).map((row) => row.employeeId)).not.toContain(
      employee.id,
    );
    const wide = await employment.retentionOverview(4000);
    const row = wide.find((candidate) => candidate.employeeId === employee.id);
    expect(row?.purgeDueOn).toBe('2036-12-31');
    expect(row?.archiveExportedAt).toBeNull();
    await employment.confirmArchiveExport(employee.id);
    const confirmed = (await employment.retentionOverview(4000)).find(
      (candidate) => candidate.employeeId === employee.id,
    );
    expect(confirmed?.archiveExportedAt).not.toBeNull();
  });

  it('confirming before the end fails not_ended', async () => {
    const { hrDb, employee } = await employeeWithEvaluation();
    const error: unknown = await createEmploymentRepository(hrDb)
      .confirmArchiveExport(employee.id)
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );
    expect((error as RepositoryError).code).toBe('not_ended');
  });
});

describe('retention store', () => {
  it('service store anonymizes a due employee and statistics facts remain', async () => {
    const { hrDb, employee, evaluation } = await employeeWithEvaluation();
    const service = serviceClient();

    // The evaluation is closed with a locked sheet approved in 2013, as if it had been done long ago.
    const criteria = sheetCriteria(regulation2016, 'C', []);
    const content = emptySheetContent();
    const locked = await service
      .from('evaluation_sheets')
      .update({
        state: 'locked',
        content: JSON.parse(
          JSON.stringify({
            ...content,
            partTwo: {
              ...content.partTwo,
              ratings: Object.fromEntries(criteria.map((id) => [id, 5])),
              developmentConclusions: 'Szkolenie z arkuszy kalkulacyjnych',
            },
          }),
        ) as never,
      })
      .eq('evaluation_id', evaluation.id);
    if (locked.error) throw locked.error;
    const closed = await service
      .from('evaluations')
      .update({ status: 'closed' })
      .eq('id', evaluation.id);
    if (closed.error) throw closed.error;
    const event = await service.from('evaluation_events').insert({
      office_id: employee.officeId,
      evaluation_id: evaluation.id,
      kind: 'sheet_approved',
      occurred_on: '2013-05-01',
      recorded_by: '00000000-0000-0000-0000-000000000000',
    });
    if (event.error) throw event.error;

    // Employment ended in 2014: the retention period is over since the end of 2024.
    await createEmploymentRepository(hrDb).end({
      employeeId: employee.id,
      endedOn: calendarDate('2014-06-30'),
      reason: 'emerytura',
      purgeDueOn: retentionEndsOn(calendarDate('2014-06-30')),
    });

    const store = createRetentionStore(service);
    expect((await store.dueEmployees(today)).map((due) => due.employeeId)).toContain(employee.id);
    const sources = await store.evaluationsOf(employee.id);
    expect(sources).toHaveLength(1);
    const facts = sources.flatMap((source) => retainedFacts(source.regulation, source) ?? []);
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ year: 2013, withConclusions: true, civilServant: false });

    await store.anonymize(employee.id, today, facts);

    const anonymized = await service
      .from('employees')
      .select('first_name, last_name, position_title, org_unit, employment_start, anonymized_at')
      .eq('id', employee.id)
      .single();
    expect(anonymized.data).toMatchObject({
      first_name: 'Anonimizowany',
      last_name: 'pracownik',
      position_title: null,
      org_unit: null,
      employment_start: '2010-01-01',
    });
    expect(anonymized.data?.anonymized_at).not.toBeNull();
    const remaining = await service.from('evaluations').select('id').eq('employee_id', employee.id);
    expect(remaining.data).toHaveLength(0);
    const events = await service
      .from('evaluation_events')
      .select('id')
      .eq('evaluation_id', evaluation.id);
    expect(events.data).toHaveLength(0);
    const kept = await service
      .from('retained_evaluation_facts')
      .select('year, level_code, with_conclusions')
      .eq('evaluation_id', evaluation.id);
    expect(kept.data).toEqual([
      { year: 2013, level_code: facts[0]?.levelCode, with_conclusions: true },
    ]);
    expect((await store.dueEmployees(today)).map((due) => due.employeeId)).not.toContain(
      employee.id,
    );
  });

  it('store lists only due employees', async () => {
    const { hrDb, employee } = await employeeWithEvaluation();
    await createEmploymentRepository(hrDb).end({
      employeeId: employee.id,
      endedOn: calendarDate('2026-03-15'),
      reason: 'x',
      purgeDueOn: retentionEndsOn(calendarDate('2026-03-15')),
    });
    const store = createRetentionStore(serviceClient());
    expect((await store.dueEmployees(today)).map((due) => due.employeeId)).not.toContain(
      employee.id,
    );
    expect(
      (await store.dueEmployees(calendarDate('2037-01-01'))).map((due) => due.employeeId),
    ).toContain(employee.id);
  });

  it('anonymize refuses before the due date', async () => {
    const { hrDb, employee } = await employeeWithEvaluation();
    await createEmploymentRepository(hrDb).end({
      employeeId: employee.id,
      endedOn: calendarDate('2026-03-15'),
      reason: 'x',
      purgeDueOn: calendarDate('2036-12-31'),
    });
    const error: unknown = await createRetentionStore(serviceClient())
      .anonymize(employee.id, today, [])
      .then(
        () => undefined,
        (reason: unknown) => reason,
      );
    expect(error).toBeInstanceOf(RepositoryError);
    expect((error as RepositoryError).message).toContain('not_due');
  });

  it('purge of expired content runs for the service role', async () => {
    const report = await createRetentionStore(serviceClient()).purgeExpiredContent(today);
    expect(report.notes).toBeGreaterThanOrEqual(0);
  });
});
