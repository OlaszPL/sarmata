import type { Database } from '@sarmata/database';
import {
  calendarDate,
  emptySheetContent,
  evaluationTransitions,
  gradeByLawDue,
} from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  RepositoryError,
  type ServiceDb,
  createOfficialRegulationWriter,
  createJobQueue,
  createRepositories,
  createServiceClient,
  readAccountClaims,
} from './index';

const [regulation2016] = officialRegulations;
if (regulation2016 === undefined) throw new Error('The official regulation catalog is empty');
const regulation2016Id = regulation2016.id;

const DEMO_OFFICE_ID = '11111111-1111-4111-8111-111111111111';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, run the tests with "pnpm test:integration"`);
  return value;
}

function anonymousClient(): Db {
  return createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedIn(email: string): Promise<Db> {
  const db = anonymousClient();
  const { error } = await db.auth.signInWithPassword({ email, password: 'Haslo-Demo-2026' });
  if (error) throw error;
  return db;
}

const serviceClient = (): ServiceDb =>
  createServiceClient({ url: env('SUPABASE_URL'), secretKey: env('SUPABASE_SECRET_KEY') });

describe('demo seed', () => {
  it('demo seed has evaluations in period and interview', async () => {
    const repositories = createRepositories(await signedIn('oceniajacy@kropka.test'));
    const employees = await repositories.employees.list();
    const idOf = (lastName: string) => employees.find((e) => e.lastName === lastName)?.id;
    const evaluations = await repositories.evaluations.listForOffice();
    const statusesOf = (lastName: string) =>
      evaluations.filter((e) => e.employeeId === idOf(lastName)).map((e) => e.status);
    expect(statusesOf('Merytoryczny')).toContain('period');
    expect(statusesOf('Ewidencyjna')).toContain('interview');
  });

  it('demo seed has an evaluation in objection', async () => {
    const hr = createRepositories(await signedIn('kadry@kropka.test'));
    const employee = (await hr.employees.list()).find((e) => e.lastName === 'Sprzeciwny');
    if (employee === undefined) throw new Error('No demo employee Sprzeciwny');
    const evaluation = (await hr.evaluations.listForOffice()).find(
      (e) => e.employeeId === employee.id,
    );
    expect(evaluation?.status).toBe('objection');
    const archived = await hr.archivedEvaluations.listForEmployee(employee.id);
    expect(archived).toMatchObject([{ draftedOn: '2023-05-10', levelCode: 'above' }]);
    // The seed throws unless signals.gradeByLaw is set, so check the same rule from the stored data.
    const detail = await hr.evaluations.get(evaluation?.id ?? '');
    const acquainted = detail?.events.find((event) => event.kind === 'acquainted');
    const drafted = detail?.events.find((event) => event.kind === 'sheet_approved');
    const regulationRow = await hr.regulationVersions.findOfficialById(detail?.regulationId ?? '');
    if (!detail || !acquainted || !drafted || regulationRow === null) {
      throw new Error('Demo evaluation is incomplete');
    }
    const history = await hr.evaluations.history(employee.id);
    const due = gradeByLawDue(regulationRow, {
      serviceStatus: 'civil_servant',
      gradeGrantedOn: employee.gradeGrantedOn,
      history: [
        ...history,
        {
          drafted: drafted.occurredOn,
          levelCode: 'above',
          outcome: 'positive',
          acquaintedOn: acquainted.occurredOn,
        },
      ],
    });
    expect(due).not.toBeNull();
  });
});

describe('employees', () => {
  it('lists the employees of the signed-in office sorted by last name', async () => {
    const employees = await createRepositories(
      await signedIn('kadry@kropka.test'),
    ).employees.list();
    expect(employees.map((employee) => employee.lastName)).toEqual([
      'Administracyjna',
      'Dawny',
      'Ewidencyjna',
      'Kadrowy',
      'Merytoryczny',
      'Oceniająca',
      'Odwoławczy',
      'Sprzeciwny',
    ]);
    expect(new Set(employees.map((employee) => employee.officeId))).toEqual(
      new Set([DEMO_OFFICE_ID]),
    );
  });

  it('findSimilar finds seeded employee by misspelled name', async () => {
    const repositories = createRepositories(await signedIn('oceniajacy@kropka.test'));
    const similar = await repositories.employees.findSimilar('Merek Merytoryczny');
    expect(similar[0]?.lastName).toBe('Merytoryczny');
  });

  it('refuses an anonymous client', async () => {
    await expect(createRepositories(anonymousClient()).employees.list()).rejects.toThrow(
      RepositoryError,
    );
  });
});

describe('regulation versions', () => {
  it('returns the synced official versions equal to the code catalog', async () => {
    const repositories = createRepositories(await signedIn('oceniajacy@kropka.test'));
    expect(await repositories.regulationVersions.listOfficial()).toEqual([...officialRegulations]);
  });

  it('returns null for an unknown code', async () => {
    const repositories = createRepositories(await signedIn('oceniajacy@kropka.test'));
    expect(await repositories.regulationVersions.findOfficialById('regulation-1999')).toBeNull();
  });

  it('does not let an account write an official version', async () => {
    // The cast only exists to try the forbidden path: the types keep accounts away from the writer.
    const writer = createOfficialRegulationWriter(
      (await signedIn('admin@kropka.test')) as unknown as ServiceDb,
    );
    const document = { ...regulation2016, id: 'regulation-fake' };
    await expect(writer.insertOfficial(document)).rejects.toThrow(RepositoryError);
  });
});

describe('job queue', () => {
  it('sends, reads and archives a job with the service client', async () => {
    const queue = createJobQueue(serviceClient());
    const id = await queue.send(
      { type: 'test.integration', payload: { at: Date.now() } },
      { delaySeconds: 0 },
    );
    // Small batches with a short visibility timeout, so other jobs on the shared queue stay mostly
    // untouched. Run this test with the worker stopped (README).
    let found: Awaited<ReturnType<typeof queue.read>>[number] | undefined;
    for (let attempt = 0; attempt < 50 && found === undefined; attempt += 1) {
      const batch = await queue.read(5, 1);
      found = batch.find((job) => job.id === id);
    }
    expect(found).toMatchObject({ readCount: 1, message: { type: 'test.integration' } });
    await queue.archive(id);
  });

  it('does not let an account use the queue', async () => {
    // The cast only exists to try the forbidden path: the types keep accounts away from the queue.
    const queue = createJobQueue((await signedIn('admin@kropka.test')) as unknown as ServiceDb);
    await expect(queue.send({ type: 'test.denied', payload: {} })).rejects.toThrow(RepositoryError);
  });
});

describe('evaluations', () => {
  const today = calendarDate(new Date().toISOString().slice(0, 10));

  async function startFor(email: string, lastName: string) {
    const db = await signedIn(email);
    const repositories = createRepositories(db);
    const employees = await repositories.employees.list();
    const employee = employees.find((candidate) => candidate.lastName === lastName);
    if (employee === undefined) throw new Error(`No demo employee ${lastName}`);
    const regulationVersionId =
      await repositories.regulationVersions.findOfficialRowId(regulation2016Id);
    if (regulationVersionId === null) throw new Error('Official regulation row is missing');
    const claims = await readAccountClaims(db);
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
    expect(claims).not.toBeNull();
    return { repositories, evaluation };
  }

  const approvePartOne = (evaluationId: string) => ({
    evaluationId,
    expectedStatus: 'criteria' as const,
    nextStatus: 'criteria_awaiting_signature' as const,
    eventKind: 'part_one_approved' as const,
    occurredOn: today,
    payload: {},
    lockSheet: false,
  });

  it('evaluation lifecycle as demo evaluator', async () => {
    const { repositories, evaluation } = await startFor('oceniajacy@kropka.test', 'Merytoryczny');
    const content = emptySheetContent();
    content.partOne.additionalCriteria = ['Współpraca z innymi urzędami'];
    await repositories.evaluations.saveDraft(evaluation.id, content);
    await repositories.evaluations.applyTransition(approvePartOne(evaluation.id));
    const detail = await repositories.evaluations.get(evaluation.id);
    expect(detail?.status).toBe('criteria_awaiting_signature');
    expect(detail?.regulationId).toBe(regulation2016Id);
    expect(detail?.sheet.version).toBe(1);
    expect(detail?.sheet.content.partOne.additionalCriteria).toEqual([
      'Współpraca z innymi urzędami',
    ]);
    expect(detail?.events.map((event) => event.kind)).toEqual(['created', 'part_one_approved']);
    await repositories.evaluations.saveDeadlines(evaluation.id, [
      { slot: 'startingInterview', windowStart: null, dueOn: today, suspendedSince: null },
    ]);
    const withDeadlines = await repositories.evaluations.get(evaluation.id);
    expect(withDeadlines?.deadlines).toHaveLength(1);
    await repositories.evaluations.saveDeadlines(evaluation.id, []);
    const cleared = await repositories.evaluations.get(evaluation.id);
    expect(cleared?.deadlines.every((deadline) => deadline.dueOn === null)).toBe(true);
    const listed = await repositories.evaluations.listForOffice({
      employeeId: evaluation.employeeId,
    });
    expect(listed.some((row) => row.id === evaluation.id)).toBe(true);
    const latest = await repositories.evaluations.latestForEmployee(evaluation.employeeId);
    expect(latest?.id).toBeDefined();
  });

  it('stale transition maps to stale_status', async () => {
    const { repositories, evaluation } = await startFor('oceniajacy@kropka.test', 'Ewidencyjna');
    await repositories.evaluations.applyTransition(approvePartOne(evaluation.id));
    await expect(
      repositories.evaluations.applyTransition(approvePartOne(evaluation.id)),
    ).rejects.toMatchObject({ code: 'stale_status' });
  });

  it('hr reads evaluation created by evaluator', async () => {
    const { evaluation } = await startFor('oceniajacy@kropka.test', 'Merytoryczny');
    const hr = createRepositories(await signedIn('kadry@kropka.test'));
    expect((await hr.evaluations.get(evaluation.id))?.id).toBe(evaluation.id);
  });

  it('domain transition table matches database', async () => {
    const db = await signedIn('oceniajacy@kropka.test');
    const { data, error } = await db.rpc('evaluation_transitions');
    if (error) throw error;
    const key = (row: { from: string; to: string; kind: string; lock: boolean }) =>
      `${row.from}|${row.to}|${row.kind}|${String(row.lock)}`;
    const fromDb = data.map((row) =>
      key({ from: row.from_status, to: row.to_status, kind: row.event_kind, lock: row.lock_sheet }),
    );
    const fromDomain = evaluationTransitions.map((row) =>
      key({ from: row.from, to: row.to, kind: row.eventKind, lock: row.lockSheet }),
    );
    expect(fromDb.sort()).toEqual(fromDomain.sort());
  });

  async function driveToObjection(evaluationId: string) {
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
    await evaluator.evaluations.applyTransition(approvePartOne(evaluationId));
    await evaluator.evaluations.applyTransition(
      step('criteria_awaiting_signature', 'period', 'part_one_signed', false),
    );
    await evaluator.evaluations.applyTransition(
      step('period', 'interview', 'evaluation_interview_held', false),
    );
    await evaluator.evaluations.applyTransition(
      step('interview', 'drafted', 'sheet_approved', true),
    );
    await evaluator.evaluations.applyTransition(step('drafted', 'delivered', 'acquainted', false));
    await hr.evaluations.applyTransition(step('delivered', 'objection', 'objection_filed', false));
    return { evaluator, hr };
  }

  it('records an absence event as evaluator', async () => {
    const { repositories, evaluation } = await startFor('oceniajacy@kropka.test', 'Oceniająca');
    await repositories.evaluations.recordEvent(evaluation.id, 'absence', today, {
      absenceId: 'a1',
      from: today,
      to: null,
    });
    const detail = await repositories.evaluations.get(evaluation.id);
    expect(detail?.events.map((event) => event.kind)).toContain('absence');
  });

  it('hr runs objection redraft on a delivered evaluation', async () => {
    const { evaluation } = await startFor('oceniajacy@kropka.test', 'Administracyjna');
    const { evaluator, hr } = await driveToObjection(evaluation.id);
    await expect(
      evaluator.evaluations.applyObjectionOutcome({
        evaluationId: evaluation.id,
        outcome: 'redraft',
        occurredOn: today,
        payload: {},
        newContent: null,
      }),
    ).rejects.toMatchObject({ code: '42501' });
    await hr.evaluations.applyObjectionOutcome({
      evaluationId: evaluation.id,
      outcome: 'redraft',
      occurredOn: today,
      payload: { decidedBy: 'hr' },
      newContent: null,
    });
    const detail = await hr.evaluations.get(evaluation.id);
    expect(detail?.status).toBe('interview');
    expect(detail?.sheet).toMatchObject({ version: 2, state: 'draft' });
    expect(detail?.events.map((event) => event.kind)).toContain('objection_outcome');
  });

  it('admin corrects a locked sheet and hr changes the evaluator', async () => {
    const { evaluation } = await startFor('oceniajacy@kropka.test', 'Kadrowy');
    const { hr } = await driveToObjection(evaluation.id);
    const admin = createRepositories(await signedIn('admin@kropka.test'));
    const content = emptySheetContent();
    content.partTwo.developmentConclusions = 'Korekta';
    await expect(hr.evaluations.correctSheet(evaluation.id, content, 'typo')).rejects.toMatchObject(
      { code: '42501' },
    );
    await admin.evaluations.correctSheet(evaluation.id, content, 'typo');
    const detail = await admin.evaluations.get(evaluation.id);
    expect(detail?.sheet).toMatchObject({ version: 2, state: 'locked' });
    const { data } = await (await signedIn('kadry@kropka.test')).auth.getUser();
    await hr.evaluations.changeEvaluator(evaluation.id, data.user?.id ?? '', today, 'handover');
    const changed = await hr.evaluations.get(evaluation.id);
    expect(changed?.evaluatorAccountId).toBe(data.user?.id);
  });

  it('lists all sheet versions after an admin correction', async () => {
    const { evaluation } = await startFor('oceniajacy@kropka.test', 'Kadrowy');
    await driveToObjection(evaluation.id);
    const admin = createRepositories(await signedIn('admin@kropka.test'));
    const content = emptySheetContent();
    content.partTwo.developmentConclusions = 'Wersja druga';
    await admin.evaluations.correctSheet(evaluation.id, content, 'literowka');
    const versions = await admin.sheetVersions.listForEvaluation(evaluation.id);
    expect(versions.map((v) => [v.version, v.state, v.reason])).toEqual([
      [1, 'superseded', null],
      [2, 'locked', 'literowka'],
    ]);
    expect(versions[1]?.content.partTwo.developmentConclusions).toBe('Wersja druga');
  });

  it('history merges archived and closed evaluations', async () => {
    const hr = createRepositories(await signedIn('kadry@kropka.test'));
    const employees = await hr.employees.list();
    const employee = employees.find((candidate) => candidate.lastName === 'Oceniająca');
    if (employee === undefined) throw new Error('No demo employee');
    const before = await hr.evaluations.history(employee.id);
    await hr.archivedEvaluations.create({
      employeeId: employee.id,
      draftedOn: calendarDate('2019-03-01'),
      acquaintedOn: calendarDate('2019-03-10'),
      levelCode: 'B',
      outcome: 'positive',
      ratings: null,
    });
    const history = await hr.evaluations.history(employee.id);
    expect(history).toHaveLength(before.length + 1);
    expect(history[0]).toMatchObject({ drafted: '2019-03-01', outcome: 'positive' });
    const listed = await hr.archivedEvaluations.listForEmployee(employee.id);
    expect(listed.some((entry) => entry.draftedOn === '2019-03-01')).toBe(true);
  });
});
