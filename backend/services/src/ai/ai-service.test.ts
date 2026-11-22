/* eslint-disable @typescript-eslint/unbound-method -- the vi.fn mocks are asserted through the repository object */
import { calendarDate, emptySheetContent } from '@sarmata/domain';
import { officialRegulations } from '@sarmata/regulations';
import {
  type AiRun,
  type AiRunRepository,
  type Note,
  type NoteRepository,
  type OfficeSettings,
  type OfficeSettingsRepository,
  type RegulationVersionRepository,
  RepositoryError,
} from '@sarmata/repositories';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { ServiceError } from '../errors';
import { type EvaluationService, type EvaluationView } from '../evaluations/evaluation-service';
import { createAiService } from './ai-service';

const EMPLOYEE = '11111111-1111-4111-8111-111111111111';
const EVALUATION = '22222222-2222-4222-8222-222222222222';
const RUN = '33333333-3333-4333-8333-333333333333';

const regulation = officialRegulations[0];
if (regulation === undefined) throw new Error('No official regulation');

const settings: OfficeSettings = {
  officeId: 'o1',
  aiEnabled: true,
  notesRetentionMonths: 36,
  reminderLeadDays: [14, 3],
  evaluationVisibility: 'office',
  defaultPlace: null,
  objectionAddresseeSheetA: null,
  appreciationGapDays: 30,
  evaluatorFlags: { minEvaluations: 5, centralShare: 0.8, leniencyPoints: 1 },
  accessibility: {
    officeAddress: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    architecture: null,
    signLanguage: null,
  },
  smtp: { host: null, port: null, user: null, from: null, passwordSet: false },
};

const note = (id: string, occurredOn: string, body: string): Note => ({
  id,
  officeId: 'o1',
  employeeId: EMPLOYEE,
  authorAccountId: 'a1',
  kind: 'observation',
  occurredOn: calendarDate(occurredOn),
  criterionId: null,
  sign: 'plus',
  communicated: false,
  body,
  version: 2,
  createdAt: `${occurredOn}T10:00:00Z`,
  updatedAt: `${occurredOn}T10:00:00Z`,
});

const view = {
  id: EVALUATION,
  employeeId: EMPLOYEE,
  regulationId: regulation.id,
  sheetId: 'C',
  status: 'period',
  cycleStart: calendarDate('2026-01-01'),
  criteria: ['knowledge-use', 'reliability', 'work-organization', 'cooperation', 'communication'],
  sheet: { version: 3, state: 'draft', content: emptySheetContent() },
} as unknown as EvaluationView;

const baseRun = {
  status: 'done' as const,
  id: RUN,
  officeId: 'o1',
  requestedBy: 'a1',
  employeeId: EMPLOYEE,
  evaluationId: null,
  inputRefs: { noteIds: [] as { id: string; version: number }[], droppedNoteIds: [] as string[] },
  question: null,
  promptVersion: 'hr-signals.v1',
  model: 'bielik-test',
  failure: null,
  requestedAt: '2026-11-21T10:00:00Z',
  startedAt: null,
  finishedAt: null,
  contentDeletedAt: null,
  decisions: [],
  partialText: null,
  partialOutput: null,
  outputTokens: null,
  progressUpdatedAt: null,
};

const signalsRun: AiRun = {
  ...baseRun,
  kind: 'hr_signals',
  status: 'done',
  output: {
    signals: [{ signal: 'overload', present: true, probability: 0.8, fragments: [] }],
    questions: ['Które zadania można przesunąć?'],
    actions: [],
  },
};

function setup(
  options: {
    settings?: Partial<OfficeSettings>;
    notes?: Note[];
    runs?: Partial<AiRunRepository>;
  } = {},
) {
  const runs: AiRunRepository = {
    create: vi.fn((run) =>
      Promise.resolve({ ...baseRun, ...run, status: 'queued', output: null } as unknown as AiRun),
    ),
    get: vi.fn(() => Promise.resolve(signalsRun)),
    list: vi.fn(() => Promise.resolve([signalsRun])),
    addDecisions: vi.fn(() => Promise.resolve(true)),
    usageLog: vi.fn(() => Promise.resolve([])),
    ...options.runs,
  };
  const notes = {
    listForEmployee: vi.fn(() =>
      Promise.resolve(options.notes ?? [note('n1', '2026-10-01', 'Raport.')]),
    ),
  } as unknown as NoteRepository;
  const settingsRepository = {
    get: vi.fn(() => Promise.resolve({ ...settings, ...options.settings })),
  } as unknown as OfficeSettingsRepository;
  const evaluations = {
    get: vi.fn((id: string) => Promise.resolve(id === EVALUATION ? view : null)),
    list: vi.fn(() => Promise.resolve([])),
  } as unknown as EvaluationService;
  const regulations: RegulationVersionRepository = {
    listOfficial: () => Promise.resolve([...officialRegulations]),
    findOfficialById: (id) =>
      Promise.resolve(officialRegulations.find((version) => version.id === id) ?? null),
    findOfficialRowId: () => Promise.resolve(null),
    listInForceCandidates: () =>
      Promise.resolve(
        officialRegulations.map((document) => ({
          rowId: `row-${document.id}`,
          code: document.id,
          isOfficial: true,
          document,
        })),
      ),
    findByCode: (code) => {
      const document = officialRegulations.find((version) => version.id === code);
      return Promise.resolve(
        document === undefined ? null : { rowId: `row-${code}`, code, isOfficial: true, document },
      );
    },
  };
  const service = createAiService({
    runs,
    notes,
    settings: settingsRepository,
    evaluations,
    regulations,
  });
  return { service, runs };
}

async function failureOf(promise: Promise<unknown>): Promise<ServiceError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ServiceError))
    throw new Error(`Expected a ServiceError, got ${String(error)}`);
  return error;
}

const created = (runs: AiRunRepository) => vi.mocked(runs.create).mock.calls[0]?.[0];

describe('ai service start', () => {
  it('start with ai disabled fails ai_disabled', async () => {
    const { service, runs } = setup({ settings: { aiEnabled: false } });
    const error = await failureOf(service.start({ kind: 'hr_signals', employeeId: EMPLOYEE }));
    expect(error.code).toBe('ai_disabled');
    expect(runs.create).not.toHaveBeenCalled();
  });

  it('sheet draft input has notes criteria and scale', async () => {
    const { service, runs } = setup();
    await service.start({ kind: 'sheet_draft', evaluationId: EVALUATION });
    expect(created(runs)).toMatchObject({
      kind: 'sheet_draft',
      employeeId: EMPLOYEE,
      evaluationId: EVALUATION,
      input: {
        sheetId: 'C',
        criteria: [
          { id: 'knowledge-use' },
          { id: 'reliability' },
          { id: 'work-organization' },
          { id: 'cooperation' },
          { id: 'communication' },
        ],
        scale: [{ points: 1 }, { points: 3 }, { points: 5 }, { points: 7 }, { points: 9 }],
        notes: [{ id: 'n1', version: 2, body: 'Raport.' }],
      },
      inputRefs: {
        noteIds: [{ id: 'n1', version: 2 }],
        droppedNoteIds: [],
        sheetVersion: 3,
        regulationId: 'regulation-2016',
      },
    });
  });

  it('unknown evaluation fails not_found', async () => {
    const { service } = setup();
    const error = await failureOf(
      service.start({ kind: 'sheet_draft', evaluationId: '44444444-4444-4444-8444-444444444444' }),
    );
    expect(error.code).toBe('not_found');
  });

  it('notes over budget are listed as dropped', async () => {
    const { service, runs } = setup({
      notes: [
        note('new', '2026-10-02', 'x'.repeat(4000)),
        note('old', '2026-09-01', 'y'.repeat(4000)),
      ],
    });
    await service.start({ kind: 'hr_signals', employeeId: EMPLOYEE });
    expect(created(runs)?.inputRefs).toEqual({
      noteIds: [{ id: 'new', version: 2 }],
      droppedNoteIds: ['old'],
    });
  });

  it('sensitive data input carries keyword warnings', async () => {
    const { service, runs } = setup();
    await service.start({
      kind: 'sensitive_data',
      employeeId: EMPLOYEE,
      text: 'Był na zwolnieniu lekarskim.',
    });
    expect(created(runs)?.input).toEqual({
      text: 'Był na zwolnieniu lekarskim.',
      keywordWarnings: [{ category: 'health', fragment: 'zwolnieniu lekarskim' }],
    });
  });

  it('conversation prep includes latest signals', async () => {
    const { service, runs } = setup();
    await service.start({
      kind: 'conversation_prep',
      employeeId: EMPLOYEE,
      conversation: 'ongoing',
      evaluationId: EVALUATION,
    });
    expect(runs.list).toHaveBeenCalledWith({
      employeeId: EMPLOYEE,
      kind: 'hr_signals',
      status: 'done',
    });
    expect(created(runs)).toMatchObject({
      input: { conversation: 'ongoing', signals: signalsRun.output },
      inputRefs: { signalsRunId: RUN, sheetVersion: 3 },
    });
  });

  it('procedure corpus comes from regulation in force', async () => {
    const { service, runs } = setup();
    await service.start({
      kind: 'procedure_question',
      question: 'Jaki jest termin sprzeciwu?',
      today: '2026-11-21',
    });
    expect(created(runs)).toMatchObject({
      employeeId: null,
      input: {
        regulationId: 'regulation-2016',
        corpus: regulation.sources.map((source) => ({ sourceId: source.id, path: source.text })),
      },
      inputRefs: { regulationId: 'regulation-2016' },
    });
  });

  it('appreciation input carries the office gap days', async () => {
    const { service, runs } = setup({ settings: { appreciationGapDays: 14 } });
    await service.start({
      kind: 'appreciation_moments',
      employeeId: EMPLOYEE,
      today: '2026-11-21',
    });
    expect(created(runs)?.input).toMatchObject({ today: '2026-11-21', gapDays: 14 });
  });
});

describe('ai service decide', () => {
  it('decide on queued run fails ai_run_not_done', async () => {
    const { service } = setup({
      runs: { get: () => Promise.resolve({ ...signalsRun, status: 'queued', output: null }) },
    });
    const error = await failureOf(
      service.decide(RUN, [{ fragment: 'question.0', decision: 'accepted' }]),
    );
    expect(error.code).toBe('ai_run_not_done');
  });

  it('decide unknown fragment fails', async () => {
    const { service, runs } = setup();
    const error = await failureOf(
      service.decide(RUN, [
        { fragment: 'question.0', decision: 'accepted' },
        { fragment: 'question.7', decision: 'rejected' },
      ]),
    );
    expect(error).toMatchObject({ code: 'ai_fragment_unknown', details: ['question.7'] });
    expect(runs.addDecisions).not.toHaveBeenCalled();
  });

  it('decide rejected by access fails forbidden', async () => {
    const { service } = setup({ runs: { addDecisions: () => Promise.resolve(false) } });
    const error = await failureOf(
      service.decide(RUN, [{ fragment: 'signal.overload', decision: 'accepted' }]),
    );
    expect(error.code).toBe('forbidden');
  });

  it('decide saves an edited fragment with its text', async () => {
    const { service, runs } = setup();
    await service.decide(RUN, [
      { fragment: 'question.0', decision: 'edited', finalText: 'Co możemy przesunąć?' },
    ]);
    expect(runs.addDecisions).toHaveBeenCalledWith(RUN, [
      { fragment: 'question.0', decision: 'edited', finalText: 'Co możemy przesunąć?' },
    ]);
  });
});

describe('ai service usage log', () => {
  it('usageLog passes the default limit 100', async () => {
    const { service, runs } = setup();
    await service.usageLog();
    expect(runs.usageLog).toHaveBeenCalledWith(100);
  });

  it('usageLog passes a given limit through', async () => {
    const { service, runs } = setup();
    await service.usageLog({ limit: 1000 });
    expect(runs.usageLog).toHaveBeenCalledWith(1000);
  });

  it('usageLog rejects a non-integer limit before the repository call', async () => {
    const { service, runs } = setup();
    await expect(service.usageLog({ limit: 1.5 })).rejects.toBeInstanceOf(ZodError);
    expect(runs.usageLog).not.toHaveBeenCalled();
  });

  it('usageLog maps 42501 to forbidden', async () => {
    const { service } = setup({
      runs: {
        usageLog: () =>
          Promise.reject(
            new RepositoryError('aiRuns.usageLog', {
              code: '42501',
              message: 'insufficient_privilege',
            }),
          ),
      },
    });
    const error = await failureOf(service.usageLog());
    expect(error.code).toBe('forbidden');
  });
});
