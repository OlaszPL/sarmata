import { type AiRun } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import {
  DRAFT_TIMEOUT_MS,
  appendSentence,
  draftProposals,
  sheetDraftState,
  type SheetDraftRun,
} from './sheet-draft';

const now = new Date('2026-11-22T12:00:00Z');
const view = { id: 'e1', cycleStart: '2025-12-01' } as never;

const output = {
  status: 'draft',
  ratings: [
    { criterionId: 'reliability', points: 7, sentences: [] },
    { criterionId: 'communication', points: 5, sentences: [] },
    { criterionId: 'focus', points: 6, sentences: [] },
  ],
  justification: [{ text: 'Uzasadnienie.', noteIds: ['n1'] }],
  developmentConclusions: [{ text: 'Szkolenie.', noteIds: [] }],
  questions: ['Co poszło dobrze?'],
};

function run(overrides: Record<string, unknown> = {}): AiRun {
  return {
    id: 'r1',
    kind: 'sheet_draft',
    status: 'done',
    evaluationId: 'e1',
    requestedAt: '2026-11-22T11:59:00Z',
    failure: null,
    contentDeletedAt: null,
    decisions: [],
    output,
    partialOutput: null,
    ...overrides,
  } as unknown as AiRun;
}

function state(runs: AiRun[], aiEnabled = true) {
  return sheetDraftState({ aiEnabled, runs, view, now });
}

describe('sheetDraftState', () => {
  it('is disabled without a run when AI is off', () => {
    expect(state([], false)).toEqual({ kind: 'disabled' });
  });

  it('is none without a run', () => {
    expect(state([])).toEqual({ kind: 'none' });
  });

  it('waits and lists the finished criteria', () => {
    const waiting = run({
      status: 'running',
      output: null,
      partialOutput: { ratings: [{ criterionId: 'reliability' }] },
    });
    expect(state([waiting])).toEqual({ kind: 'waiting', finished: ['reliability'] });
    expect(state([run({ status: 'queued', output: null })])).toEqual({
      kind: 'waiting',
      finished: [],
    });
  });

  it('times out after ten minutes', () => {
    const at = (ms: number) =>
      run({
        status: 'running',
        output: null,
        requestedAt: new Date(now.getTime() - ms).toISOString(),
      });
    expect(state([at(DRAFT_TIMEOUT_MS)]).kind).toBe('waiting');
    expect(state([at(DRAFT_TIMEOUT_MS + 1)])).toEqual({ kind: 'timed_out' });
  });

  it('explains a failure', () => {
    expect(
      state([
        run({ status: 'failed', output: null, failure: { reason: 'disabled', message: null } }),
      ]),
    ).toEqual({ kind: 'failed', message: 'AI jest wyłączone w ustawieniach urzędu.' });
    expect(
      state([
        run({ status: 'failed', output: null, failure: { reason: 'model_error', message: 'x' } }),
      ]),
    ).toEqual({
      kind: 'failed',
      message:
        'Nie udało się przygotować szkicu. Możesz spróbować ponownie albo wypełnić arkusz bez AI.',
    });
  });

  it('knows deleted content', () => {
    expect(state([run({ output: null, contentDeletedAt: '2026-11-20T00:00:00Z' })])).toEqual({
      kind: 'deleted',
    });
  });

  it('passes the questions of insufficient data', () => {
    const insufficient = run({
      output: { ...output, status: 'insufficient_data', questions: ['Q?'] },
    });
    expect(state([insufficient])).toEqual({ kind: 'insufficient_data', questions: ['Q?'] });
  });

  it('is done with the run', () => {
    const done = run();
    expect(state([done])).toEqual({ kind: 'done', run: done });
  });

  it('shows a done run although AI was switched off later', () => {
    expect(state([run()], false).kind).toBe('done');
  });

  describe('run pick', () => {
    it('prefers the run of this evaluation', () => {
      const other = run({ id: 'null', evaluationId: null, requestedAt: '2026-11-22T11:59:30Z' });
      const own = run({ id: 'own' });
      expect(state([other, own])).toMatchObject({ run: { id: 'own' } });
    });

    it('falls back to a run without evaluation after the cycle start', () => {
      expect(state([run({ id: 'null', evaluationId: null })])).toMatchObject({
        run: { id: 'null' },
      });
    });

    it('ignores a run without evaluation from before the cycle start', () => {
      const old = run({ evaluationId: null, requestedAt: '2025-11-30T10:00:00Z' });
      expect(state([old])).toEqual({ kind: 'none' });
    });

    it('ignores runs of other evaluations and kinds', () => {
      expect(state([run({ evaluationId: 'e2' }), run({ kind: 'quality_check' })])).toEqual({
        kind: 'none',
      });
    });

    it('picks the newest', () => {
      const older = run({ id: 'old', requestedAt: '2026-11-20T10:00:00Z' });
      const newer = run({ id: 'new', requestedAt: '2026-11-21T10:00:00Z' });
      expect(state([older, newer])).toMatchObject({ run: { id: 'new' } });
      expect(state([newer, older])).toMatchObject({ run: { id: 'new' } });
    });
  });
});

describe('draftProposals', () => {
  it('maps the output with decisions and counts the open ones', () => {
    const decided = run({
      decisions: [
        {
          fragment: 'rating.communication',
          decision: 'accepted',
          decidedAt: '2026-11-22T11:00:00Z',
        },
        {
          fragment: 'rating.communication',
          decision: 'rejected',
          decidedAt: '2026-11-22T11:30:00Z',
        },
      ],
    }) as SheetDraftRun;
    const result = draftProposals(decided);
    expect(result.ratings).toHaveLength(3);
    expect(result.ratings.find((r) => r.criterionId === 'communication')).toMatchObject({
      fragment: 'rating.communication',
      points: 5,
      decided: 'rejected',
    });
    expect(result.sentences).toEqual([
      {
        fragment: 'justification.0',
        target: 'justification',
        text: 'Uzasadnienie.',
        noteIds: ['n1'],
        decided: null,
      },
      {
        fragment: 'developmentConclusions.0',
        target: 'developmentConclusions',
        text: 'Szkolenie.',
        noteIds: [],
        decided: null,
      },
    ]);
    expect(result.questions).toEqual(['Co poszło dobrze?']);
    expect(result.open).toBe(4);
  });

  it('does not count a rating without points', () => {
    const noPoints = run({
      output: { ...output, ratings: [{ criterionId: 'a', points: null, sentences: [] }] },
    }) as SheetDraftRun;
    expect(draftProposals(noPoints).open).toBe(2);
  });
});

describe('appendSentence', () => {
  it('starts an empty text', () => {
    expect(appendSentence('', 'A')).toBe('A');
  });

  it('adds a line after the text', () => {
    expect(appendSentence('X \n', 'A')).toBe('X\nA');
  });
});
