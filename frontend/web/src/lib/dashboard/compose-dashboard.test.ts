import { type AiRun, type EvaluationView, calendarDate } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { type DashboardSources, composeDashboard, todoMeta } from './compose-dashboard';

const today = calendarDate('2026-11-21');
const now = new Date('2026-11-21T10:00:00Z');

interface ViewOptions {
  id: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  /** Due date of the single deadline the status looks at. */
  dueOn?: string | null;
  /** Dates of `closed` events in the log, oldest first. */
  closedOn?: string[];
}

/** `drafted` has no date and is an evaluator step, `delivered` waits for nobody, `objection` for HR. */
function view(options: ViewOptions): EvaluationView {
  const status = options.status ?? 'criteria';
  const slot = {
    criteria: 'startingInterview',
    delivered: 'objection',
    objection: 'objectionDecision',
  }[status];
  return {
    id: options.id,
    sheetId: `sheet-${options.id}`,
    employeeId: options.employeeId ?? `emp-${options.id}`,
    status,
    snapshot: { firstName: options.firstName ?? 'Anna', lastName: options.lastName ?? 'Nowak' },
    sheet: { content: { partTwo: { ratings: {}, developmentConclusions: '' } } },
    criteria: [],
    events: (options.closedOn ?? []).map((occurredOn) => ({
      kind: 'closed',
      occurredOn: calendarDate(occurredOn),
    })),
    deadlines:
      slot && options.dueOn
        ? [{ slot, windowStart: null, dueOn: calendarDate(options.dueOn), suspendedSince: null }]
        : [],
  } as unknown as EvaluationView;
}

function run(fields: Record<string, unknown>): AiRun {
  return {
    id: `run-${Math.random()}`,
    status: 'done',
    employeeId: 'emp-1',
    requestedAt: '2026-11-21T09:50:00Z',
    finishedAt: '2026-11-20T10:00:00Z',
    output: null,
    partialText: null,
    ...fields,
  } as unknown as AiRun;
}

function hrRun(
  signals: { signal: string; present: boolean; probability: number; quote?: string }[],
  fields: Record<string, unknown> = {},
): AiRun {
  return run({
    kind: 'hr_signals',
    output: {
      signals: signals.map((s) => ({
        signal: s.signal,
        present: s.present,
        probability: s.probability,
        fragments: s.quote ? [{ noteId: 'n1', quote: s.quote }] : [],
      })),
      questions: [],
      actions: [],
    },
    ...fields,
  });
}

function appreciationRun(
  output: { overdue: boolean; daysSince: number | null; reasons?: string[] },
  fields: Record<string, unknown> = {},
): AiRun {
  return run({
    kind: 'appreciation_moments',
    output: {
      gap: {
        lastAppreciationOn: null,
        daysSince: output.daysSince,
        thresholdDays: 30,
        overdue: output.overdue,
      },
      moments: (output.reasons ?? []).map((reason) => ({ noteIds: ['n1'], reason, sbi: {} })),
    },
    ...fields,
  });
}

function sources(overrides: Partial<DashboardSources> = {}): DashboardSources {
  return {
    views: [],
    closed: [],
    aiEnabled: true,
    hrRuns: [],
    appreciationRuns: [],
    draftRuns: [],
    ...overrides,
  };
}

describe('composeDashboard', () => {
  it('handles empty sources', () => {
    expect(composeDashboard(sources(), today)).toEqual({
      today,
      headline: 'Nie masz spraw do zrobienia.',
      todo: [],
      others: [],
      summary: { todo: 0, overdue: 0, awaitingEmployee: 0, closedThisYear: 0, nearestDueOn: null },
      aiEnabled: true,
      hrSignal: null,
      appreciation: null,
      runningDrafts: [],
    });
  });

  describe('rows', () => {
    it('puts evaluator rows first, ordered by days left with undated last', () => {
      const data = composeDashboard(
        sources({
          views: [
            view({ id: 'wait', status: 'objection', dueOn: '2026-11-22' }),
            view({ id: 'undated', status: 'drafted' }),
            view({ id: 'late', dueOn: '2026-11-18' }),
            view({ id: 'soon', dueOn: '2026-11-25' }),
            view({ id: 'later', dueOn: '2026-12-10' }),
          ],
        }),
        today,
      );
      expect(data.todo.map((row) => row.evaluationId)).toEqual(['late', 'soon', 'later']);
      expect(data.others.map((row) => row.evaluationId)).toEqual(['undated', 'wait']);
      expect(data.todo[0]).toMatchObject({
        employeeName: 'Anna Nowak',
        sheetId: 'sheet-late',
        daysLeft: -3,
      });
      expect(data.others[0]?.daysLeft).toBeNull();
      expect(data.others[1]?.daysLeft).toBe(1);
    });

    it('caps todo at three and moves the rest to others', () => {
      const data = composeDashboard(
        sources({
          views: ['a', 'b', 'c', 'd'].map((id, i) => view({ id, dueOn: `2026-12-0${i + 1}` })),
        }),
        today,
      );
      expect(data.todo.map((row) => row.evaluationId)).toEqual(['a', 'b', 'c']);
      expect(data.others.map((row) => row.evaluationId)).toEqual(['d']);
      expect(data.summary.todo).toBe(4);
    });

    it('skips evaluations without a next step', () => {
      const data = composeDashboard(
        sources({ views: [view({ id: 'done', status: 'closed' })] }),
        today,
      );
      expect(data.todo).toEqual([]);
      expect(data.others).toEqual([]);
    });
  });

  describe('summary and headline', () => {
    const views = [
      view({ id: 'a', dueOn: '2026-11-18' }),
      view({ id: 'b', dueOn: '2026-12-01' }),
      view({ id: 'c', status: 'drafted' }),
      view({ id: 'd', status: 'objection', dueOn: '2026-11-10' }),
      view({ id: 'e', status: 'delivered', dueOn: '2026-11-30' }),
    ];

    it('counts todo, overdue (own steps only), awaiting the employee and closed this year', () => {
      const closed = [
        view({ id: 'x', status: 'closed', closedOn: ['2026-01-02'] }),
        view({ id: 'y', status: 'closed', closedOn: ['2025-12-30'] }),
        view({ id: 'z', status: 'closed', closedOn: ['2026-11-20'] }),
      ];
      const data = composeDashboard(sources({ views, closed }), today);
      expect(data.summary).toEqual({
        todo: 3,
        overdue: 1,
        awaitingEmployee: 1,
        closedThisYear: 2,
        nearestDueOn: '2026-11-18',
      });
      expect(data.headline).toBe('Masz 3 sprawy do zrobienia.');
    });

    it('dates a closed evaluation by its newest closing event and skips one without it', () => {
      const closed = [
        view({ id: 'reclosed', status: 'closed', closedOn: ['2025-06-01', '2026-02-01'] }),
        view({ id: 'no-event', status: 'closed' }),
      ];
      expect(composeDashboard(sources({ closed }), today).summary.closedThisYear).toBe(1);
    });

    it('uses the singular form for one case', () => {
      const data = composeDashboard(
        sources({ views: [view({ id: 'a', dueOn: '2026-12-01' })] }),
        today,
      );
      expect(data.headline).toBe('Masz 1 sprawę do zrobienia.');
    });

    it('uses the genitive form for five cases', () => {
      const five = ['a', 'b', 'c', 'd', 'e'].map((id) => view({ id, dueOn: '2026-12-01' }));
      expect(composeDashboard(sources({ views: five }), today).headline).toBe(
        'Masz 5 spraw do zrobienia.',
      );
    });
  });

  describe('HR signal', () => {
    const views = [view({ id: '1', employeeId: 'emp-1' }), view({ id: '2', employeeId: 'emp-2' })];

    it('picks the strongest present signal with its quote and label', () => {
      const data = composeDashboard(
        sources({
          views,
          hrRuns: [
            hrRun([
              { signal: 'sentiment', present: true, probability: 0.4 },
              { signal: 'overload', present: true, probability: 0.72, quote: 'Znowu nadgodziny' },
            ]),
          ],
        }),
        today,
      );
      expect(data.hrSignal).toEqual({
        employeeId: 'emp-1',
        employeeName: 'Anna Nowak',
        signal: { label: 'Możliwe przeciążenie', probability: 0.72, quote: 'Znowu nadgodziny' },
      });
    });

    it.each([
      ['overload', 'Możliwe przeciążenie'],
      ['burnout_risk', 'Ryzyko wypalenia'],
      ['engagement_drop', 'Spadek zaangażowania'],
      ['sentiment', 'Negatywny wydźwięk notatek'],
    ])('labels %s', (signal, label) => {
      const data = composeDashboard(
        sources({ views, hrRuns: [hrRun([{ signal, present: true, probability: 0.5 }])] }),
        today,
      );
      expect(data.hrSignal?.signal).toEqual({ label, probability: 0.5, quote: null });
    });

    it('wins by probability across employees', () => {
      const data = composeDashboard(
        sources({
          views,
          hrRuns: [
            hrRun([{ signal: 'overload', present: true, probability: 0.6 }], {
              employeeId: 'emp-1',
            }),
            hrRun([{ signal: 'burnout_risk', present: true, probability: 0.8 }], {
              employeeId: 'emp-2',
            }),
          ],
        }),
        today,
      );
      expect(data.hrSignal?.employeeId).toBe('emp-2');
    });

    it('counts only the newest done run of an employee', () => {
      const data = composeDashboard(
        sources({
          views,
          hrRuns: [
            hrRun([{ signal: 'overload', present: true, probability: 0.9 }], {
              finishedAt: '2026-11-01T10:00:00Z',
            }),
            hrRun([{ signal: 'sentiment', present: true, probability: 0.3 }], {
              finishedAt: '2026-11-19T10:00:00Z',
            }),
          ],
        }),
        today,
      );
      expect(data.hrSignal?.signal.label).toBe('Negatywny wydźwięk notatek');
    });

    it('ignores employees without an evaluation in progress', () => {
      const data = composeDashboard(
        sources({
          views,
          hrRuns: [
            hrRun([{ signal: 'overload', present: true, probability: 0.9 }], {
              employeeId: 'other',
            }),
          ],
        }),
        today,
      );
      expect(data.hrSignal).toBeNull();
    });

    it('ignores failed, running, empty and absent-signal runs', () => {
      const data = composeDashboard(
        sources({
          views,
          hrRuns: [
            hrRun([{ signal: 'overload', present: true, probability: 0.9 }], { status: 'failed' }),
            hrRun([{ signal: 'overload', present: true, probability: 0.9 }], { status: 'running' }),
            hrRun([], { output: null, employeeId: 'emp-2' }),
            hrRun([{ signal: 'overload', present: false, probability: 0.9 }], {
              employeeId: 'emp-2',
              finishedAt: '2026-11-21T10:00:00Z',
            }),
          ],
        }),
        today,
      );
      expect(data.hrSignal).toBeNull();
    });

    it('is null when the fetch failed', () => {
      expect(composeDashboard(sources({ views, hrRuns: null }), today).hrSignal).toBeNull();
    });
  });

  describe('appreciation', () => {
    const views = [view({ id: '1', employeeId: 'emp-1' })];

    it('suggests an overdue appreciation with the first moment as reason', () => {
      const data = composeDashboard(
        sources({
          views,
          appreciationRuns: [
            appreciationRun({
              overdue: true,
              daysSince: 45,
              reasons: ['Dobrze poprowadziła projekt'],
            }),
          ],
        }),
        today,
      );
      expect(data.appreciation).toEqual({
        employeeId: 'emp-1',
        employeeName: 'Anna Nowak',
        reason: 'Dobrze poprowadziła projekt',
        daysSince: 45,
      });
    });

    it('falls back to a default reason when there are no moments', () => {
      const data = composeDashboard(
        sources({ views, appreciationRuns: [appreciationRun({ overdue: true, daysSince: null })] }),
        today,
      );
      expect(data.appreciation?.reason).toBe('Od dawna brak notatki z docenieniem');
      expect(data.appreciation?.daysSince).toBeNull();
    });

    it('suggests moments even when the gap is not overdue', () => {
      const data = composeDashboard(
        sources({
          views,
          appreciationRuns: [appreciationRun({ overdue: false, daysSince: 5, reasons: ['Pomoc'] })],
        }),
        today,
      );
      expect(data.appreciation?.reason).toBe('Pomoc');
    });

    it('stays empty without overdue gap or moments, for other employees and on failed fetch', () => {
      const quiet = appreciationRun({ overdue: false, daysSince: 5 });
      const foreign = appreciationRun({ overdue: true, daysSince: 50 }, { employeeId: 'other' });
      expect(
        composeDashboard(sources({ views, appreciationRuns: [quiet, foreign] }), today)
          .appreciation,
      ).toBeNull();
      expect(
        composeDashboard(sources({ views, appreciationRuns: null }), today).appreciation,
      ).toBeNull();
    });

    it('uses the newest done run only', () => {
      const data = composeDashboard(
        sources({
          views,
          appreciationRuns: [
            appreciationRun(
              { overdue: true, daysSince: 50 },
              { finishedAt: '2026-11-01T10:00:00Z' },
            ),
            appreciationRun(
              { overdue: false, daysSince: 2 },
              { finishedAt: '2026-11-20T10:00:00Z' },
            ),
          ],
        }),
        today,
      );
      expect(data.appreciation).toBeNull();
    });
  });

  describe('running drafts', () => {
    const views = [view({ id: '1', employeeId: 'emp-1' })];

    it('lists queued and running sheet drafts of employees in progress', () => {
      const data = composeDashboard(
        sources({
          views,
          draftRuns: [
            run({ id: 'r1', kind: 'sheet_draft', status: 'running', partialText: 'Anna ' }),
            run({ id: 'r2', kind: 'sheet_draft', status: 'queued' }),
            run({ id: 'r3', kind: 'sheet_draft', status: 'done' }),
            run({ id: 'r4', kind: 'sheet_draft', status: 'running', employeeId: 'other' }),
          ],
        }),
        today,
        now,
      );
      expect(data.runningDrafts).toEqual([
        { runId: 'r1', employeeName: 'Anna Nowak', partialText: 'Anna ' },
        { runId: 'r2', employeeName: 'Anna Nowak', partialText: null },
      ]);
    });

    it('drops drafts stuck for more than 30 minutes', () => {
      const data = composeDashboard(
        sources({
          views,
          draftRuns: [
            run({
              id: 'fresh',
              kind: 'sheet_draft',
              status: 'running',
              requestedAt: '2026-11-21T09:31:00Z',
            }),
            run({
              id: 'stuck',
              kind: 'sheet_draft',
              status: 'queued',
              requestedAt: '2026-11-21T09:29:00Z',
            }),
            run({
              id: 'dead',
              kind: 'sheet_draft',
              status: 'running',
              requestedAt: '2026-11-20T08:00:00Z',
            }),
          ],
        }),
        today,
        now,
      );
      expect(data.runningDrafts.map((draft) => draft.runId)).toEqual(['fresh']);
    });
  });

  it('hides all AI parts when AI is disabled', () => {
    const views = [view({ id: '1', employeeId: 'emp-1' })];
    const data = composeDashboard(
      sources({
        views,
        aiEnabled: false,
        hrRuns: [hrRun([{ signal: 'overload', present: true, probability: 0.9 }])],
        appreciationRuns: [appreciationRun({ overdue: true, daysSince: 40 })],
        draftRuns: [run({ id: 'r1', kind: 'sheet_draft', status: 'running' })],
      }),
      today,
    );
    expect(data.aiEnabled).toBe(false);
    expect(data.hrSignal).toBeNull();
    expect(data.appreciation).toBeNull();
    expect(data.runningDrafts).toEqual([]);
  });
});

describe('todoMeta', () => {
  const step = {
    stage: 'Część II',
    action: 'Wpisz wnioski do IPRZ i zatwierdź ocenę',
    owner: 'evaluator',
    dueOn: null,
  } as const;

  it('names the sheet and the stage in lower case, keeping the roman numeral', () => {
    expect(todoMeta({ sheetId: 'C', step: { ...step, missingFields: null } })).toBe(
      'Arkusz C, część II',
    );
    expect(todoMeta({ sheetId: 'C', step: { ...step, missingFields: 0 } })).toBe(
      'Arkusz C, część II',
    );
  });

  it.each([
    [1, 'brakuje 1 pola'],
    [2, 'brakuje 2 pól'],
    [4, 'brakuje 4 pól'],
    [5, 'brakuje 5 pól'],
  ])('adds %i missing fields', (missingFields, suffix) => {
    expect(todoMeta({ sheetId: 'C', step: { ...step, missingFields } })).toBe(
      `Arkusz C, część II, ${suffix}`,
    );
  });
});
