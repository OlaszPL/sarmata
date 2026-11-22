import { type AiRun } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import {
  PREP_TIMEOUT_MS,
  type PrepRun,
  pickPrepRun,
  prepSections,
  prepSnapshot,
  prepState,
} from './conversation-prep';

const now = new Date('2026-11-22T12:00:00Z');

const output = {
  goal: 'Omówić obciążenie pracą.',
  plan: ['Powitanie', 'Przegląd zadań'],
  questions: [
    { criterionId: 'reliability', questions: ['Co pomogło dotrzymać terminu?', 'Co przeszkadza?'] },
    { criterionId: 'empty', questions: [] },
  ],
  difficultSituations: [{ situation: 'defensive_reaction', hint: 'Odwołaj się do faktów.' }],
};

function run(overrides: Record<string, unknown> = {}): PrepRun {
  return {
    id: 'r1',
    kind: 'conversation_prep',
    status: 'done',
    employeeId: 'p1',
    evaluationId: null,
    requestedAt: '2026-11-22T11:59:00Z',
    failure: null,
    contentDeletedAt: null,
    decisions: [],
    output,
    partialOutput: null,
    ...overrides,
  } as unknown as PrepRun;
}

describe('pickPrepRun', () => {
  const runs = [
    run({ id: 'ongoing', requestedAt: '2026-11-20T10:00:00Z' }),
    run({ id: 'starting', evaluationId: 'e1', requestedAt: '2026-11-01T10:00:00Z' }),
    run({ id: 'evaluation', evaluationId: 'e1', requestedAt: '2026-11-21T10:00:00Z' }),
    { ...run({ id: 'draft' }), kind: 'sheet_draft' } as unknown as AiRun,
  ];

  it('takes the newest run of the scope, other kinds aside', () => {
    expect(pickPrepRun(runs, { evaluationId: null })?.id).toBe('ongoing');
    expect(pickPrepRun(runs, { evaluationId: 'e1' })?.id).toBe('evaluation');
  });

  it('splits the starting and the evaluation conversation at the approval of part I', () => {
    const approvedAt = '2026-11-10T09:00:00Z';
    expect(pickPrepRun(runs, { evaluationId: 'e1', before: approvedAt })?.id).toBe('starting');
    expect(pickPrepRun(runs, { evaluationId: 'e1', after: approvedAt })?.id).toBe('evaluation');
    expect(pickPrepRun(runs, { evaluationId: 'e2' })).toBeNull();
  });
});

describe('prepState', () => {
  it('says AI is off before anything else', () => {
    expect(prepState({ aiEnabled: false, run: prepSnapshot(run()), now }).kind).toBe('disabled');
    expect(prepState({ aiEnabled: true, run: null, now }).kind).toBe('none');
  });

  it('shows the finished part while the run is in progress', () => {
    const waiting = prepSnapshot(
      run({
        status: 'running',
        output: null,
        partialOutput: { goal: 'Cel', plan: ['Krok'], questions: [] },
      }),
    );
    expect(prepState({ aiEnabled: true, run: waiting, now })).toEqual({
      kind: 'waiting',
      progress: { goal: true, planSteps: 1, criteria: 0 },
    });
  });

  it('times out a run that waits too long', () => {
    const old = new Date(now.getTime() - PREP_TIMEOUT_MS - 1000).toISOString();
    const queued = prepSnapshot(run({ status: 'queued', output: null, requestedAt: old }));
    expect(prepState({ aiEnabled: true, run: queued, now }).kind).toBe('timed_out');
  });

  it('maps failure, retention and the result', () => {
    const failed = prepSnapshot(
      run({ status: 'failed', output: null, failure: { reason: 'disabled', message: null } }),
    );
    expect(prepState({ aiEnabled: true, run: failed, now })).toEqual({
      kind: 'failed',
      message: 'AI jest wyłączone w ustawieniach urzędu.',
    });
    const deleted = prepSnapshot(run({ contentDeletedAt: '2026-11-22T00:00:00Z', output: null }));
    expect(prepState({ aiEnabled: true, run: deleted, now }).kind).toBe('deleted');
    expect(prepState({ aiEnabled: true, run: prepSnapshot(run()), now }).kind).toBe('done');
  });
});

describe('prepSections', () => {
  it('lists the fragments with the paths of ai.decide and the latest decision', () => {
    const decided = prepSnapshot(
      run({
        decisions: [
          {
            fragment: 'plan.1',
            decision: 'rejected',
            finalText: null,
            decidedAt: '2026-11-22T11:59:30Z',
          },
          {
            fragment: 'plan.1',
            decision: 'edited',
            finalText: 'Przegląd zadań z ostatniego miesiąca',
            decidedAt: '2026-11-22T11:59:40Z',
          },
          {
            fragment: 'goal',
            decision: 'accepted',
            finalText: null,
            decidedAt: '2026-11-22T11:59:35Z',
          },
        ],
      }),
    );
    const sections = prepSections(decided, { reliability: 'Rzetelność' });
    expect(sections?.goal).toMatchObject({ fragment: 'goal', decided: 'accepted' });
    expect(sections?.plan[1]).toEqual({
      fragment: 'plan.1',
      text: 'Przegląd zadań',
      decided: 'edited',
      finalText: 'Przegląd zadań z ostatniego miesiąca',
    });
    expect(sections?.questions).toHaveLength(1);
    expect(sections?.questions[0]?.name).toBe('Rzetelność');
    expect(sections?.questions[0]?.items.map((item) => item.fragment)).toEqual([
      'question.reliability.0',
      'question.reliability.1',
    ]);
    expect(sections?.situations[0]).toMatchObject({
      fragment: 'situation.0',
      label: 'Reakcja obronna',
    });
    // plan.0, two questions and the situation are still open.
    expect(sections?.open).toBe(4);
  });

  it('keeps the criterion id when the name is unknown', () => {
    expect(prepSections(prepSnapshot(run()), {})?.questions[0]?.name).toBe('reliability');
  });
});
