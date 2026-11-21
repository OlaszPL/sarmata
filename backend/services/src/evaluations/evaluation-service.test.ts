import {
  type HistoryEntry,
  type RegulationDocument,
  calendarDate,
  sheetContentSchema,
} from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import {
  type Employee,
  type EvaluationDetail,
  type EvaluationEvent,
  type EvaluationRepository,
  type OfficeSettings,
  type OfficeSettingsRepository,
  type Repositories,
  RepositoryError,
} from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { ServiceError, createServices } from '../index';

const [regulation] = officialRegulations;
if (regulation === undefined) throw new Error('The official regulation catalog is empty');
const reg: RegulationDocument = regulation;

const date = calendarDate;

function fakeEvaluations(
  seed: EvaluationDetail[] = [],
  history: HistoryEntry[] = [],
  override: Partial<EvaluationRepository> = {},
) {
  const store = new Map<string, EvaluationDetail>(seed.map((detail) => [detail.id, detail]));
  let counter = 0;
  const repository: EvaluationRepository = {
    create: (input) => {
      counter += 1;
      const id = `ev${String(counter)}`;
      const event: EvaluationEvent = {
        id: `${id}-created`,
        kind: 'created',
        occurredOn: input.cycleStart,
        payload: { previousAcquaintedOn: input.previousAcquaintedOn },
        recordedBy: input.evaluatorAccountId,
        recordedAt: new Date(counter).toISOString(),
      };
      const detail: EvaluationDetail = {
        id,
        officeId: 'o1',
        employeeId: input.employeeId,
        evaluatorAccountId: input.evaluatorAccountId,
        regulationId: reg.id,
        sheetId: input.sheetId,
        status: 'criteria',
        cycleStart: input.cycleStart,
        afterNegative: input.afterNegative,
        previousEvaluationId: input.previousEvaluationId,
        snapshot: input.snapshot,
        createdAt: new Date(counter).toISOString(),
        sheet: { version: 1, state: 'draft', content: input.content },
        events: [event],
        deadlines: [],
      };
      store.set(id, detail);
      return Promise.resolve(detail);
    },
    get: (id) => Promise.resolve(store.get(id) ?? null),
    listForOffice: () => Promise.resolve([...store.values()]),
    latestForEmployee: (employeeId) =>
      Promise.resolve(
        [...store.values()].filter((d) => d.employeeId === employeeId).at(-1) ?? null,
      ),
    saveDraft: (id, content) => {
      const current = store.get(id);
      if (current === undefined) return Promise.reject(new Error('missing'));
      store.set(id, { ...current, sheet: { ...current.sheet, content } });
      return Promise.resolve();
    },
    applyTransition: (input) => {
      const current = store.get(input.evaluationId);
      if (current === undefined) return Promise.reject(new Error('missing'));
      if (current.status !== input.expectedStatus) {
        return Promise.reject(
          new RepositoryError('apply', { message: 'stale_status', code: 'stale_status' }),
        );
      }
      const event: EvaluationEvent = {
        id: `${input.evaluationId}-${String(current.events.length)}`,
        kind: input.eventKind,
        occurredOn: input.occurredOn,
        payload: input.payload,
        recordedBy: current.evaluatorAccountId,
        recordedAt: new Date(1000 + current.events.length).toISOString(),
      };
      store.set(input.evaluationId, {
        ...current,
        status: input.nextStatus,
        sheet: { ...current.sheet, state: input.lockSheet ? 'locked' : current.sheet.state },
        events: [...current.events, event],
      });
      return Promise.resolve(event.id);
    },
    saveDeadlines: (id, deadlines) => {
      const current = store.get(id);
      if (current === undefined) return Promise.reject(new Error('missing'));
      store.set(id, { ...current, deadlines: [...deadlines] });
      return Promise.resolve();
    },
    recordEvent: (id, kind, occurredOn, payload) => {
      const current = store.get(id);
      if (current === undefined) return Promise.reject(new Error('missing'));
      const event: EvaluationEvent = {
        id: `${id}-${String(current.events.length)}`,
        kind,
        occurredOn,
        payload,
        recordedBy: current.evaluatorAccountId,
        recordedAt: new Date(2000 + current.events.length).toISOString(),
      };
      store.set(id, { ...current, events: [...current.events, event] });
      return Promise.resolve();
    },
    applyObjectionOutcome: (input) => {
      const current = store.get(input.evaluationId);
      if (current === undefined) return Promise.reject(new Error('missing'));
      const redraft = input.outcome === 'redraft';
      const event: EvaluationEvent = {
        id: `${input.evaluationId}-${String(current.events.length)}`,
        kind: 'objection_outcome',
        occurredOn: input.occurredOn,
        payload: { ...input.payload, outcome: input.outcome },
        recordedBy: current.evaluatorAccountId,
        recordedAt: new Date(3000 + current.events.length).toISOString(),
      };
      store.set(input.evaluationId, {
        ...current,
        status: redraft ? 'interview' : 'closed',
        sheet: {
          version: current.sheet.version + (input.outcome === 'rejected' ? 0 : 1),
          state: redraft ? 'draft' : 'locked',
          content: input.newContent ?? current.sheet.content,
        },
        events: [...current.events, event],
      });
      return Promise.resolve();
    },
    correctSheet: () => Promise.reject(new Error('unused')),
    changeEvaluator: () => Promise.reject(new Error('unused')),
    history: () => Promise.resolve([...history]),
    ...override,
  };
  return { repository, store };
}

const employee = (patch: Partial<Employee> = {}): Employee => ({
  id: 'emp1',
  officeId: 'o1',
  firstName: 'Anna',
  lastName: 'Nowak',
  email: null,
  userId: null,
  positionTitle: null,
  orgUnit: null,
  positionKind: 'other',
  serviceStatus: 'employee',
  employmentBasis: 'indefinite',
  employmentStart: date('2024-09-02'),
  appointmentYear: null,
  grade: null,
  gradeGrantedOn: null,
  employmentEndedOn: null,
  supervisorEmployeeId: null,
  ...patch,
});

function setup(
  employees: Employee[],
  seed: EvaluationDetail[] = [],
  history: HistoryEntry[] = [],
  override: Partial<EvaluationRepository> = {},
  officeSettings?: OfficeSettingsRepository,
) {
  const { repository, store } = fakeEvaluations(seed, history, override);
  const repositories: Repositories = {
    employees: {
      list: () => Promise.resolve(employees),
      get: (id) => Promise.resolve(employees.find((e) => e.id === id) ?? null),
      create: () => Promise.reject(new Error('unused')),
      update: () => Promise.reject(new Error('unused')),
      findSimilar: () => Promise.resolve([]),
    },
    regulationVersions: {
      listOfficial: () => Promise.resolve([reg]),
      findOfficialById: (id) => Promise.resolve(id === reg.id ? reg : null),
      findOfficialRowId: (id) => Promise.resolve(id === reg.id ? 'row-1' : null),
    },
    evaluations: repository,
    archivedEvaluations: {
      create: () => Promise.reject(new Error('unused')),
      listForEmployee: () => Promise.resolve([]),
    },
    sheetVersions: { listForEvaluation: () => Promise.resolve([]) },
  };
  const services = createServices({
    repositories,
    currentAccountId: () => Promise.resolve('acc-current'),
    ...(officeSettings === undefined ? {} : { officeSettings }),
  });
  return { services, store };
}

const points = (code: string) => reg.partialScale.levels.find((l) => l.code === code)?.points ?? 0;

function completeContent(sheetId: string, rating: number) {
  const base = sheetContentSchema.parse({
    partOne: { additionalCriteria: [], dueOn: null },
    partTwo: {
      interviewOn: '2026-05-20',
      periodFrom: null,
      periodTo: null,
      ratings: {},
      justification: 'Reasons',
      developmentConclusions: 'Training',
      gradeRequest: null,
    },
  });
  const ratings: Record<string, number> = {};
  for (const id of criteriaOf(sheetId)) ratings[id] = rating;
  base.partTwo.ratings = ratings;
  return base;
}

function criteriaOf(sheetId: string): string[] {
  const sheet = reg.sheets.find((s) => s.id === sheetId);
  return sheet === undefined ? [] : [...sheet.mandatoryCriteria];
}

const expectCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toBeInstanceOf(ServiceError);
  await expect(promise).rejects.toMatchObject({ code });
};

const today = date('2026-11-21');

describe('evaluations.start', () => {
  it('rejects fixed-term employee', async () => {
    const { services } = setup([employee({ employmentBasis: 'fixed_term' })]);
    await expectCode(services.evaluations.start({ employeeId: 'emp1', today }), 'not_eligible');
  });

  it('start defaults evaluator to supervisor account', async () => {
    const supervisor = employee({ id: 'sup', userId: 'acc-sup' });
    const { services } = setup([employee({ supervisorEmployeeId: 'sup' }), supervisor]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    expect(started.evaluatorAccountId).toBe('acc-sup');
  });

  it('start proposes sheet C for other position and pins regulation in force on cycle start', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    expect(started.sheetId).toBe('C');
    expect(started.regulationId).toBe(reg.id);
    expect(started.cycleStart).toBe(today);
    expect(started.evaluatorAccountId).toBe('acc-current');
    expect(started.deadlines.map((d) => d.slot).sort()).toEqual([
      'evaluationDeadline',
      'startingInterview',
    ]);
  });

  it('start for an employee hired in 2010 without history uses today and finds a regulation', async () => {
    const { services } = setup([employee({ employmentStart: date('2010-03-01') })]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    expect(started.cycleStart).toBe(today);
    expect(started.regulationId).toBe(reg.id);
  });

  it('start accepts an explicit cycleStart', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({
      employeeId: 'emp1',
      today,
      cycleStart: date('2026-03-01'),
    });
    expect(started.cycleStart).toBe('2026-03-01');
  });

  it('start rejects a second evaluation while one is in progress', async () => {
    const { services } = setup([employee()]);
    await services.evaluations.start({ employeeId: 'emp1', today });
    const second = services.evaluations.start({ employeeId: 'emp1', today });
    await expectCode(second, 'not_eligible');
    await expect(second).rejects.toMatchObject({ details: { reason: 'evaluation_in_progress' } });
  });

  it('get returns criteria and score', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    await services.evaluations.saveDraft(started.id, completeContent('C', points('meets')));
    const detail = await services.evaluations.get(started.id);
    expect(detail?.criteria).toEqual(criteriaOf('C'));
    expect(detail?.score).toMatchObject({ complete: true, outcome: 'positive' });
  });

  it('get scores an incomplete draft as incomplete', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const detail = await services.evaluations.get(started.id);
    expect(detail?.score.complete).toBe(false);
  });

  it('start after negative sets afterNegative and 7-day starting interview', async () => {
    const content = completeContent('C', points('far-below'));
    const previous: EvaluationDetail = {
      id: 'prev',
      officeId: 'o1',
      employeeId: 'emp1',
      evaluatorAccountId: 'acc1',
      regulationId: reg.id,
      sheetId: 'C',
      status: 'closed',
      cycleStart: date('2024-09-02'),
      afterNegative: false,
      previousEvaluationId: null,
      snapshot: {
        firstName: 'Anna',
        lastName: 'Nowak',
        positionTitle: null,
        orgUnit: null,
        serviceStatus: 'employee',
        grade: null,
        appointmentYear: null,
        gradeGrantedOn: null,
      },
      createdAt: '2024-09-02T00:00:00Z',
      sheet: { version: 1, state: 'locked', content },
      events: [
        {
          id: 'a',
          kind: 'sheet_approved',
          occurredOn: date('2025-01-10'),
          payload: {},
          recordedBy: 'acc1',
          recordedAt: '2025-01-10T10:00:00Z',
        },
        {
          id: 'b',
          kind: 'acquainted',
          occurredOn: date('2025-01-13'),
          payload: {},
          recordedBy: 'acc1',
          recordedAt: '2025-01-13T10:00:00Z',
        },
      ],
      deadlines: [],
    };
    const { services } = setup([employee()], [previous]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    expect(started.afterNegative).toBe(true);
    expect(started.previousEvaluationId).toBe('prev');
    expect(started.cycleStart).toBe('2025-01-10');
    const slots = Object.fromEntries(started.deadlines.map((d) => [d.slot, d.dueOn]));
    expect(slots.startingInterviewAfterNegative).toBe('2025-01-17');
    expect(slots.reevaluationAfterNegative).toBe('2025-07-13');
  });

  it('start does not throw when the previous sheet has an off-scale rating', async () => {
    const content = completeContent('C', points('far-below'));
    const previous: EvaluationDetail = {
      id: 'prev',
      officeId: 'o1',
      employeeId: 'emp1',
      evaluatorAccountId: 'acc1',
      regulationId: reg.id,
      sheetId: 'C',
      status: 'closed',
      cycleStart: date('2024-09-02'),
      afterNegative: false,
      previousEvaluationId: null,
      snapshot: {
        firstName: 'Anna',
        lastName: 'Nowak',
        positionTitle: null,
        orgUnit: null,
        serviceStatus: 'employee',
        grade: null,
        appointmentYear: null,
        gradeGrantedOn: null,
      },
      createdAt: '2024-09-02T00:00:00Z',
      sheet: { version: 1, state: 'locked', content },
      events: [
        {
          id: 'a',
          kind: 'sheet_approved',
          occurredOn: date('2025-01-10'),
          payload: {},
          recordedBy: 'acc1',
          recordedAt: '2025-01-10T10:00:00Z',
        },
        {
          id: 'b',
          kind: 'acquainted',
          occurredOn: date('2025-01-13'),
          payload: {},
          recordedBy: 'acc1',
          recordedAt: '2025-01-13T10:00:00Z',
        },
      ],
      deadlines: [],
    };
    const offScale = completeContent('C', 4);
    const bad: EvaluationDetail = { ...previous, sheet: { ...previous.sheet, content: offScale } };
    const { services } = setup([employee()], [bad]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    expect(started.afterNegative).toBe(false);
  });
});

describe('evaluations.transition', () => {
  it('approve_part_one with mandatory criterion as additional fails criteria_invalid', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const content = structuredClone(started.sheet.content);
    content.partOne.additionalCriteria = ['knowledge-use'];
    await services.evaluations.saveDraft(started.id, content);
    const attempt = services.evaluations.transition(started.id, {
      type: 'approve_part_one',
      startingInterviewOn: date('2024-09-20'),
    });
    await expectCode(attempt, 'criteria_invalid');
  });

  it('approve_sheet without development conclusions fails approval_blocked with details', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    await services.evaluations.transition(started.id, {
      type: 'approve_part_one',
      startingInterviewOn: date('2024-09-20'),
    });
    await services.evaluations.transition(started.id, {
      type: 'record_part_one_signature',
      signedOn: date('2024-09-21'),
    });
    await services.evaluations.transition(started.id, {
      type: 'record_evaluation_interview',
      heldOn: date('2026-05-20'),
    });
    const content = completeContent('C', points('meets'));
    content.partTwo.developmentConclusions = '';
    await services.evaluations.saveDraft(started.id, content);
    const attempt = services.evaluations.transition(started.id, {
      type: 'approve_sheet',
      draftedOn: date('2026-05-25'),
    });
    await expectCode(attempt, 'approval_blocked');
    await expect(attempt).rejects.toMatchObject({
      details: [{ code: 'development_conclusions_missing' }],
    });
  });

  it('saveDraft cannot change part one after approval', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    await services.evaluations.transition(started.id, {
      type: 'approve_part_one',
      startingInterviewOn: date('2024-09-20'),
    });
    const content = structuredClone(started.sheet.content);
    content.partOne.additionalCriteria = ['creativity'];
    await expectCode(services.evaluations.saveDraft(started.id, content), 'part_locked');
  });

  it('rejects a command that does not fit the status', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    await expectCode(
      services.evaluations.transition(started.id, {
        type: 'approve_sheet',
        draftedOn: date('2026-05-25'),
      }),
      'invalid_transition',
    );
  });

  it('full happy path to closed', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const id = started.id;
    const run = (command: Parameters<typeof services.evaluations.transition>[1]) =>
      services.evaluations.transition(id, command);
    await run({ type: 'approve_part_one', startingInterviewOn: date('2024-09-20') });
    await run({ type: 'record_part_one_signature', signedOn: date('2024-09-21') });
    await run({ type: 'record_evaluation_interview', heldOn: date('2026-05-20') });
    await services.evaluations.saveDraft(id, completeContent('C', points('meets')));
    await run({ type: 'approve_sheet', draftedOn: date('2026-05-25') });
    const delivered = await run({
      type: 'record_acquaintance',
      acquaintedOn: date('2026-06-15'),
      signatureRefused: false,
    });
    expect(delivered.status).toBe('delivered');
    const objection = delivered.deadlines.find((d) => d.slot === 'objection');
    expect(objection?.dueOn).toBe('2026-06-22');
    const closed = await run({
      type: 'close_after_objection_window',
      closedOn: date('2026-06-23'),
    });
    expect(closed.status).toBe('closed');
    expect(closed.deadlines).toEqual([]);
  });

  it('close_after_objection_window is blocked until the objection window has passed', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const id = started.id;
    const run = (command: Parameters<typeof services.evaluations.transition>[1]) =>
      services.evaluations.transition(id, command);
    await run({ type: 'approve_part_one', startingInterviewOn: date('2024-09-20') });
    await run({ type: 'record_part_one_signature', signedOn: date('2024-09-21') });
    await run({ type: 'record_evaluation_interview', heldOn: date('2026-05-20') });
    await services.evaluations.saveDraft(id, completeContent('C', points('meets')));
    await run({ type: 'approve_sheet', draftedOn: date('2026-05-25') });
    await run({
      type: 'record_acquaintance',
      acquaintedOn: date('2026-06-15'),
      signatureRefused: false,
    });
    for (const closedOn of ['2026-06-15', '2026-06-22']) {
      const attempt = run({ type: 'close_after_objection_window', closedOn: date(closedOn) });
      await expectCode(attempt, 'approval_blocked');
      await expect(attempt).rejects.toMatchObject({
        details: [{ code: 'objection_window_open' }],
      });
    }
  });

  it('approve_sheet reports an off-scale rating as an approval issue, not a RangeError', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const id = started.id;
    await services.evaluations.transition(id, {
      type: 'approve_part_one',
      startingInterviewOn: date('2024-09-20'),
    });
    await services.evaluations.transition(id, {
      type: 'record_part_one_signature',
      signedOn: date('2024-09-21'),
    });
    await services.evaluations.transition(id, {
      type: 'record_evaluation_interview',
      heldOn: date('2026-05-20'),
    });
    await services.evaluations.saveDraft(id, completeContent('C', 4));
    const attempt = services.evaluations.transition(id, {
      type: 'approve_sheet',
      draftedOn: date('2026-05-25'),
    });
    await expectCode(attempt, 'approval_blocked');
    const error = await attempt.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ServiceError);
    expect((error as ServiceError).details).toContainEqual({
      code: 'rating_out_of_scale',
      criterionId: 'knowledge-use',
    });
    expect((await services.evaluations.get(id))?.score.complete).toBe(false);
  });
});

describe('staffing situations and objection flow', () => {
  async function deliver(services: ReturnType<typeof setup>['services'], rating: string) {
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const id = started.id;
    const run = (command: Parameters<typeof services.evaluations.transition>[1]) =>
      services.evaluations.transition(id, command);
    await run({ type: 'approve_part_one', startingInterviewOn: date('2024-09-20') });
    await run({ type: 'record_part_one_signature', signedOn: date('2024-09-21') });
    await run({ type: 'record_evaluation_interview', heldOn: date('2026-05-20') });
    await services.evaluations.saveDraft(id, completeContent('C', points(rating)));
    await run({ type: 'approve_sheet', draftedOn: date('2026-05-25') });
    await run({
      type: 'record_acquaintance',
      acquaintedOn: date('2026-06-15'),
      signatureRefused: false,
    });
    return { id, run };
  }

  it('objection filed late fails objection_late', async () => {
    const { services } = setup([employee()]);
    const { run } = await deliver(services, 'meets');
    await expectCode(
      run({ type: 'file_objection', filedOn: date('2026-06-23') }),
      'objection_late',
    );
  });

  it('objection filed on the last day moves to objection', async () => {
    const { services } = setup([employee()]);
    const { run } = await deliver(services, 'meets');
    const filed = await run({ type: 'file_objection', filedOn: date('2026-06-22') });
    expect(filed.status).toBe('objection');
    expect(filed.deadlines.map((d) => d.slot)).toContain('objectionDecision');
  });

  it('changed outcome lowering fails', async () => {
    const { services } = setup([employee()]);
    const { id, run } = await deliver(services, 'meets');
    await run({ type: 'file_objection', filedOn: date('2026-06-16') });
    const lower = completeContent('C', points('far-below'));
    await expectCode(
      services.evaluations.decideObjection(id, {
        outcome: 'changed',
        decidedOn: date('2026-06-20'),
        content: lower,
      }),
      'objection_lowers_outcome',
    );
  });

  it('changed outcome without content fails', async () => {
    const { services } = setup([employee()]);
    const { id, run } = await deliver(services, 'meets');
    await run({ type: 'file_objection', filedOn: date('2026-06-16') });
    await expectCode(
      services.evaluations.decideObjection(id, {
        outcome: 'changed',
        decidedOn: date('2026-06-20'),
      }),
      'criteria_invalid',
    );
  });

  it('redraft returns view in interview', async () => {
    const { services } = setup([employee()]);
    const { id, run } = await deliver(services, 'meets');
    await run({ type: 'file_objection', filedOn: date('2026-06-16') });
    const redrafted = await services.evaluations.decideObjection(id, {
      outcome: 'redraft',
      decidedOn: date('2026-06-20'),
    });
    expect(redrafted.status).toBe('interview');
    expect(redrafted.sheet).toMatchObject({ version: 2, state: 'draft' });
  });

  it('term change too early fails term_change_invalid', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const attempt = services.evaluations.changeTerm(started.id, {
      newDueOn: date('2027-06-01'),
      reason: 'evaluatorChange',
      noticeOn: date('2027-01-01'),
    });
    await expectCode(attempt, 'term_change_invalid');
    await expect(attempt).rejects.toMatchObject({ details: ['term_change_too_early'] });
  });

  it('term change after the minimum period sets the due date', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const changed = await services.evaluations.changeTerm(started.id, {
      newDueOn: date('2027-09-30'),
      reason: 'evaluatorChange',
      noticeOn: date('2027-06-01'),
    });
    const slot = changed.deadlines.find((d) => d.slot === 'evaluationDeadline');
    expect(slot?.dueOn).toBe('2027-09-30');
  });

  it('absence without end suspends deadline in view', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const absenceId = '11111111-1111-4111-8111-111111111111';
    const open = await services.evaluations.recordAbsence(started.id, {
      absenceId,
      from: date('2026-12-01'),
      to: null,
    });
    const suspended = open.deadlines.find((d) => d.slot === 'evaluationDeadline');
    expect(suspended).toMatchObject({ dueOn: null, suspendedSince: '2026-12-01' });
    const closed = await services.evaluations.recordAbsence(started.id, {
      absenceId,
      from: date('2026-12-01'),
      to: date('2026-12-10'),
    });
    const resumed = closed.deadlines.find((d) => d.slot === 'evaluationDeadline');
    expect(resumed?.suspendedSince).toBeNull();
    expect(resumed?.dueOn).not.toBeNull();
  });

  it('position change shows current position', async () => {
    const { services } = setup([employee({ positionTitle: 'Specialist', orgUnit: 'Unit A' })]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    expect(started.currentPosition).toEqual({ positionTitle: 'Specialist', orgUnit: 'Unit A' });
    const changed = await services.evaluations.recordPositionChange(started.id, {
      changedOn: date('2027-06-01'),
      significant: true,
      justification: 'Promotion',
      positionTitle: 'Senior specialist',
      orgUnit: 'Unit B',
    });
    expect(changed.currentPosition).toEqual({
      positionTitle: 'Senior specialist',
      orgUnit: 'Unit B',
    });
    expect(changed.snapshot.positionTitle).toBe('Specialist');
  });

  it('view signals grade by law for civil servant', async () => {
    const qualifying = reg.gradeByLaw.qualifyingLevels[0] ?? 'x';
    const history: HistoryEntry[] = Array.from(
      { length: reg.gradeByLaw.consecutiveEvaluations },
      (_, index) => ({
        drafted: date(`${String(2020 + index)}-03-01`),
        levelCode: qualifying,
        outcome: 'positive' as const,
        acquaintedOn: date(`${String(2020 + index)}-03-10`),
      }),
    );
    const { services } = setup(
      [employee({ serviceStatus: 'civil_servant', gradeGrantedOn: date('2018-01-01') })],
      [],
      history,
    );
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    expect(started.signals.gradeByLaw).not.toBeNull();
    expect(started.signals.secondConsecutiveNegative).toBe(false);
  });

  it('view signals nothing for a plain employee', async () => {
    const { services } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    expect(started.signals).toEqual({ gradeByLaw: null, secondConsecutiveNegative: false });
  });
});

describe('fix wave 1: staffing review findings', () => {
  const negativeBefore: HistoryEntry[] = [
    {
      drafted: date('2020-03-01'),
      levelCode: 'D',
      outcome: 'negative',
      acquaintedOn: date('2020-03-10'),
    },
  ];

  async function deliverNegative(services: ReturnType<typeof setup>['services']) {
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    const id = started.id;
    const run = (command: Parameters<typeof services.evaluations.transition>[1]) =>
      services.evaluations.transition(id, command);
    await run({ type: 'approve_part_one', startingInterviewOn: date('2024-09-20') });
    await run({ type: 'record_part_one_signature', signedOn: date('2024-09-21') });
    await run({ type: 'record_evaluation_interview', heldOn: date('2026-05-20') });
    await services.evaluations.saveDraft(id, completeContent('C', points('far-below')));
    await run({ type: 'approve_sheet', draftedOn: date('2026-05-25') });
    const delivered = await run({
      type: 'record_acquaintance',
      acquaintedOn: date('2026-06-15'),
      signatureRefused: false,
    });
    return { id, run, delivered };
  }

  it('interrupt keeps the reason in the event payload', async () => {
    const { services, store } = setup([employee()]);
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    await services.evaluations.transition(started.id, {
      type: 'interrupt',
      interruptedOn: date('2026-12-01'),
      reason: 'Employee left the office',
    });
    const event = store.get(started.id)?.events.find((e) => e.kind === 'interrupted');
    expect(event?.payload).toEqual({ reason: 'Employee left the office' });
  });

  it('maps a denied role (42501) to forbidden', async () => {
    const denied = () =>
      Promise.reject(new RepositoryError('rpc', { message: 'denied', code: '42501' }));
    const { services } = setup([employee()], [], [], {
      correctSheet: denied,
      changeEvaluator: denied,
      applyTransition: denied,
    });
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    await expectCode(
      services.evaluations.changeEvaluator(started.id, {
        accountId: 'acc-x',
        occurredOn: today,
        reason: 'Leave',
      }),
      'forbidden',
    );
    await expectCode(
      services.evaluations.correctSheet(started.id, {
        content: completeContent('C', 4),
        reason: 'Typo',
      }),
      'forbidden',
    );
    await expectCode(
      services.evaluations.transition(started.id, {
        type: 'interrupt',
        interruptedOn: today,
        reason: 'x',
      }),
      'forbidden',
    );
  });

  it('maps an evaluator outside the office to invalid_evaluator', async () => {
    const { services } = setup([employee()], [], [], {
      changeEvaluator: () =>
        Promise.reject(
          new RepositoryError('rpc', { message: 'invalid_evaluator', code: 'invalid_evaluator' }),
        ),
    });
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    await expectCode(
      services.evaluations.changeEvaluator(started.id, {
        accountId: 'acc-x',
        occurredOn: today,
        reason: 'Leave',
      }),
      'invalid_evaluator',
    );
  });

  it('maps a missing locked sheet to no_locked_sheet', async () => {
    const { services } = setup([employee()], [], [], {
      correctSheet: () =>
        Promise.reject(
          new RepositoryError('rpc', {
            message: 'no locked sheet to correct',
            code: 'no_locked_sheet',
          }),
        ),
    });
    const started = await services.evaluations.start({ employeeId: 'emp1', today });
    await expectCode(
      services.evaluations.correctSheet(started.id, {
        content: completeContent('C', 4),
        reason: 'Typo',
      }),
      'no_locked_sheet',
    );
  });

  it('changed outcome with an incomplete sheet is blocked', async () => {
    const { services } = setup([employee()]);
    const { id, run } = await (async () => {
      const started = await services.evaluations.start({ employeeId: 'emp1', today });
      const runner = (command: Parameters<typeof services.evaluations.transition>[1]) =>
        services.evaluations.transition(started.id, command);
      await runner({ type: 'approve_part_one', startingInterviewOn: date('2024-09-20') });
      await runner({ type: 'record_part_one_signature', signedOn: date('2024-09-21') });
      await runner({ type: 'record_evaluation_interview', heldOn: date('2026-05-20') });
      await services.evaluations.saveDraft(started.id, completeContent('C', points('meets')));
      await runner({ type: 'approve_sheet', draftedOn: date('2026-05-25') });
      await runner({
        type: 'record_acquaintance',
        acquaintedOn: date('2026-06-15'),
        signatureRefused: false,
      });
      return { id: started.id, run: runner };
    })();
    await run({ type: 'file_objection', filedOn: date('2026-06-16') });
    const incomplete = completeContent('C', points('meets'));
    incomplete.partTwo.ratings = {};
    await expectCode(
      services.evaluations.decideObjection(id, {
        outcome: 'changed',
        decidedOn: date('2026-06-20'),
        content: incomplete,
      }),
      'approval_blocked',
    );
  });

  it('signals count a delivered evaluation', async () => {
    const { services } = setup([employee()], [], negativeBefore);
    const { delivered } = await deliverNegative(services);
    expect(delivered.signals.secondConsecutiveNegative).toBe(true);
  });

  it('signals ignore the redrafted copy and an interrupted evaluation', async () => {
    const redraft = setup([employee()], [], negativeBefore);
    const first = await deliverNegative(redraft.services);
    await first.run({ type: 'file_objection', filedOn: date('2026-06-16') });
    const redrafted = await redraft.services.evaluations.decideObjection(first.id, {
      outcome: 'redraft',
      decidedOn: date('2026-06-20'),
    });
    expect(redrafted.status).toBe('interview');
    expect(redrafted.signals.secondConsecutiveNegative).toBe(false);

    const interrupt = setup([employee()], [], negativeBefore);
    const second = await deliverNegative(interrupt.services);
    const interrupted = await second.run({
      type: 'interrupt',
      interruptedOn: date('2026-06-20'),
      reason: 'Left',
    });
    expect(interrupted.signals.secondConsecutiveNegative).toBe(false);
  });

  describe('refusal note, place and objection addressee', () => {
    const settingsWith = (patch: Partial<OfficeSettings>): OfficeSettingsRepository => ({
      get: () =>
        Promise.resolve({
          officeId: 'o1',
          aiEnabled: true,
          notesRetentionMonths: 36,
          reminderLeadDays: [14, 3],
          evaluationVisibility: 'office',
          defaultPlace: null,
          objectionAddresseeSheetA: null,
          smtp: { host: null, port: null, user: null, from: null, passwordSet: false },
          ...patch,
        }),
      update: () => Promise.reject(new Error('unused')),
      setSmtpPassword: () => Promise.reject(new Error('unused')),
    });

    async function toDrafted(
      services: ReturnType<typeof setup>['services'],
      sheetId?: string,
      place?: string,
    ) {
      const started = await services.evaluations.start({
        employeeId: 'emp1',
        today,
        ...(sheetId === undefined ? {} : { sheetId }),
      });
      const id = started.id;
      const run = (command: Parameters<typeof services.evaluations.transition>[1]) =>
        services.evaluations.transition(id, command);
      await run({
        type: 'approve_part_one',
        startingInterviewOn: date('2024-09-20'),
        ...(place === undefined ? {} : { place }),
      });
      await run({ type: 'record_part_one_signature', signedOn: date('2024-09-21') });
      await run({ type: 'record_evaluation_interview', heldOn: date('2026-05-20') });
      await services.evaluations.saveDraft(id, completeContent(started.sheetId, points('meets')));
      await run({ type: 'approve_sheet', draftedOn: date('2026-05-25') });
      return { id, run };
    }

    const payloadOf = (store: ReturnType<typeof setup>['store'], id: string, kind: string) =>
      store.get(id)?.events.find((event) => event.kind === kind)?.payload;

    it('a refused signature gets the default note, a given note and witnesses are kept', async () => {
      const first = setup([employee()]);
      const a = await toDrafted(first.services);
      await a.run({
        type: 'record_acquaintance',
        acquaintedOn: date('2026-06-15'),
        signatureRefused: true,
      });
      expect(payloadOf(first.store, a.id, 'signature_refused')).toEqual({
        refusalNote: 'oceniany odmówił podpisania zapoznania się z oceną',
      });

      const second = setup([employee()]);
      const b = await toDrafted(second.services);
      await b.run({
        type: 'record_acquaintance',
        acquaintedOn: date('2026-06-15'),
        signatureRefused: true,
        refusalNote: 'Odmowa po rozmowie',
        witnesses: ['Anna Nowak', 'Jan Kowalski'],
      });
      expect(payloadOf(second.store, b.id, 'signature_refused')).toEqual({
        refusalNote: 'Odmowa po rozmowie',
        witnesses: ['Anna Nowak', 'Jan Kowalski'],
      });
    });

    it('place defaults to the office setting and an explicit place wins', async () => {
      const { services, store } = setup(
        [employee()],
        [],
        [],
        {},
        settingsWith({ defaultPlace: 'Warszawa' }),
      );
      const a = await toDrafted(services, undefined, 'Kraków');
      await a.run({
        type: 'record_acquaintance',
        acquaintedOn: date('2026-06-15'),
        signatureRefused: false,
      });
      expect(payloadOf(store, a.id, 'part_one_approved')).toEqual({ place: 'Kraków' });
      expect(payloadOf(store, a.id, 'sheet_approved')).toEqual({ place: 'Warszawa' });
      expect(payloadOf(store, a.id, 'acquainted')).toEqual({ place: 'Warszawa' });
    });

    it('no place is stored when nothing is given and no default is set', async () => {
      const { services, store } = setup([employee()], [], [], {}, settingsWith({}));
      const a = await toDrafted(services);
      expect(payloadOf(store, a.id, 'sheet_approved')).toEqual({});
    });

    it('objectionAddressee: office override for sheet A, rules text for A without override and for C', async () => {
      const rules = (id: string) => reg.sheets.find((s) => s.id === id)?.objectionAddressee ?? null;
      const override = setup(
        [employee()],
        [],
        [],
        {},
        settingsWith({ objectionAddresseeSheetA: 'Wojewoda' }),
      );
      const withOverride = await override.services.evaluations.start({
        employeeId: 'emp1',
        today,
        sheetId: 'A',
      });
      expect(withOverride.objectionAddressee).toBe('Wojewoda');

      const plain = setup([employee()], [], [], {}, settingsWith({}));
      const sheetA = await plain.services.evaluations.start({
        employeeId: 'emp1',
        today,
        sheetId: 'A',
      });
      expect(sheetA.objectionAddressee).toBe(rules('A'));

      const other = setup(
        [employee()],
        [],
        [],
        {},
        settingsWith({ objectionAddresseeSheetA: 'Wojewoda' }),
      );
      const sheetC = await other.services.evaluations.start({
        employeeId: 'emp1',
        today,
        sheetId: 'C',
      });
      expect(sheetC.objectionAddressee).toBe(rules('C'));
      expect(rules('C')).not.toBeNull();
    });
  });
});
