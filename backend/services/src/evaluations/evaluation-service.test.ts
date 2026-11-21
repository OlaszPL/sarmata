import { type RegulationDocument, calendarDate, sheetContentSchema } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import {
  type Employee,
  type EvaluationDetail,
  type EvaluationEvent,
  type EvaluationRepository,
  type Repositories,
  RepositoryError,
} from '@sarmata/repositories';
import { describe, expect, it } from 'vitest';
import { ServiceError, createServices } from '../index';

const [regulation] = officialRegulations;
if (regulation === undefined) throw new Error('The official regulation catalog is empty');
const reg: RegulationDocument = regulation;

const date = calendarDate;

function fakeEvaluations(seed: EvaluationDetail[] = []) {
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
    recordEvent: () => Promise.reject(new Error('unused')),
    applyObjectionOutcome: () => Promise.reject(new Error('unused')),
    correctSheet: () => Promise.reject(new Error('unused')),
    changeEvaluator: () => Promise.reject(new Error('unused')),
    history: () => Promise.resolve([]),
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

function setup(employees: Employee[], seed: EvaluationDetail[] = []) {
  const { repository, store } = fakeEvaluations(seed);
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
  };
  const services = createServices({
    repositories,
    currentAccountId: () => Promise.resolve('acc-current'),
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
