import { type AiRun } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { appreciationModel, hrPartnerModel } from './hr-partner';

function run(overrides: Record<string, unknown>): AiRun {
  return {
    id: 'r',
    kind: 'hr_signals',
    status: 'done',
    requestedAt: '2026-11-01T10:00:00Z',
    startedAt: '2026-11-01T10:00:01Z',
    finishedAt: '2026-11-01T10:01:00Z',
    failure: null,
    decisions: [],
    output: null,
    ...overrides,
  } as unknown as AiRun;
}

const output = {
  signals: [
    {
      signal: 'overload',
      present: true,
      probability: 0.71,
      fragments: [{ noteId: 'n1', quote: 'Zostaje po godzinach' }],
    },
    { signal: 'sentiment', present: true, probability: 0.9, fragments: [] },
    { signal: 'burnout_risk', present: false, probability: 0.1, fragments: [] },
  ],
  questions: ['Jak wygląda obciążenie?'],
  actions: [{ framework: 'jd_r', signal: 'overload', text: 'Przejrzyj zadania' }],
};

const notes = [{ id: 'n1', occurredOn: '2026-10-20' as never }];

describe('hrPartnerModel', () => {
  it('is none without runs', () => {
    expect(hrPartnerModel([], true, [])).toEqual({ kind: 'none' });
    expect(hrPartnerModel(null, true, [])).toEqual({ kind: 'none' });
  });

  it('is disabled when AI is off', () => {
    expect(hrPartnerModel([run({ output })], false, [])).toEqual({ kind: 'disabled' });
  });

  it('has no access when the account does not read the notes', () => {
    expect(hrPartnerModel(null, true, null)).toEqual({ kind: 'no_access' });
  });

  it('says AI is off before it talks about access', () => {
    expect(hrPartnerModel(null, false, null)).toEqual({ kind: 'disabled' });
  });

  it('is running with the previous result', () => {
    const state = hrPartnerModel(
      [run({ id: 'new', status: 'running', finishedAt: null }), run({ id: 'old', output })],
      true,
      notes,
    );
    expect(state.kind).toBe('running');
    if (state.kind === 'running') expect(state.previous?.runId).toBe('old');
  });

  it('is failed, also for the disabled reason while AI is on', () => {
    const failure = { reason: 'disabled', message: null };
    expect(hrPartnerModel([run({ status: 'failed', failure })], true, [])).toEqual({
      kind: 'failed',
      previous: null,
    });
  });

  it('builds the result with rejected signals, quotes and absent labels', () => {
    const state = hrPartnerModel(
      [
        run({
          output,
          decisions: [
            { fragment: 'signal.overload', decision: 'accepted' },
            { fragment: 'signal.overload', decision: 'rejected' },
          ],
        }),
      ],
      true,
      notes,
    );
    expect(state.kind).toBe('done');
    if (state.kind !== 'done') return;
    expect(state.result.analysedOn).toBe('01.11.2026');
    expect(state.result.signals.map((signal) => signal.name)).toEqual(['sentiment', 'overload']);
    const overload = state.result.signals[1];
    expect(overload).toMatchObject({
      label: 'Możliwe przeciążenie',
      probability: 0.71,
      rejected: true,
      quotes: [{ quote: 'Zostaje po godzinach', occurredOn: '20.10.2026' }],
    });
    expect(state.result.signals[0]?.rejected).toBe(false);
    expect(state.result.absent).toEqual(['Ryzyko wypalenia']);
    expect(state.result.questions).toEqual([
      { fragment: 'question.0', text: 'Jak wygląda obciążenie?' },
    ]);
    expect(state.result.actions).toEqual([
      {
        fragment: 'action.0',
        framework: 'Model JD-R',
        text: 'Przejrzyj zadania',
      },
    ]);
  });
});

describe('appreciationModel', () => {
  it('is null without a list or a done run', () => {
    expect(appreciationModel(null)).toBeNull();
    expect(appreciationModel([run({ kind: 'appreciation_moments', status: 'failed' })])).toBeNull();
  });

  it('reads the latest done run', () => {
    const model = appreciationModel([
      run({
        kind: 'appreciation_moments',
        output: {
          gap: {
            lastAppreciationOn: '2026-08-01',
            daysSince: 112,
            thresholdDays: 60,
            overdue: true,
          },
          moments: [{ noteIds: [], reason: 'Dobra robota', sbi: { situation: 'Wdrożenie' } }],
        },
      }),
    ]);
    expect(model).toEqual({
      overdue: true,
      daysSince: 112,
      thresholdDays: 60,
      lastOn: '01.08.2026',
      moments: [{ reason: 'Dobra robota', situation: 'Wdrożenie' }],
    });
  });
});
