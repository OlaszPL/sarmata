import { describe, expect, it } from 'vitest';
import type { AiRun } from '@sarmata/services';
import {
  aiKindLabels,
  aiLogRows,
  decisionCounts,
  formatDateTime,
  fragmentLabel,
  parseAiLogFilter,
  runStatusTag,
} from './ai-log';

const EMPLOYEE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function decision(decision: 'accepted' | 'edited' | 'rejected', fragment: string) {
  return {
    fragment,
    decision,
    finalText: null,
    contentDeletedAt: null,
    decidedBy: USER_ID,
    decidedAt: '2026-11-20T10:00:00Z',
  };
}

function run(overrides: Partial<AiRun> = {}): AiRun {
  return {
    id: 'run-1',
    officeId: 'office',
    kind: 'quality_check',
    status: 'done',
    requestedBy: USER_ID,
    employeeId: EMPLOYEE_ID,
    evaluationId: 'eval-1',
    inputRefs: {},
    promptVersion: null,
    failure: null,
    requestedAt: '2026-11-20T10:05:00Z',
    startedAt: null,
    finishedAt: null,
    contentDeletedAt: null,
    decisions: [],
    partialText: null,
    outputTokens: null,
    progressUpdatedAt: null,
    output: null,
    partialOutput: null,
    ...overrides,
  } as AiRun;
}

describe('aiLogRows', () => {
  const people = new Map([
    [EMPLOYEE_ID, 'Ewa Ewidencyjna'],
    [USER_ID, 'Jan Kowalski'],
  ]);

  it('counts decisions and resolves names from the people map', () => {
    const [row] = aiLogRows(
      [
        run({
          decisions: [
            decision('accepted', 'issue.0'),
            decision('accepted', 'issue.1'),
            decision('edited', 'issue.2'),
          ],
        }),
      ],
      people,
    );
    expect(row).toMatchObject({
      id: 'run-1',
      kind: 'Sprawdzenie jakości',
      employee: 'Ewa Ewidencyjna',
      requestedBy: 'Jan Kowalski',
      decisions: '2 przyjęte, 1 poprawiona, 0 odrzuconych',
      evaluationId: 'eval-1',
      contentDeleted: false,
      status: { tone: 'done', label: 'Gotowe' },
    });
  });

  it('shows an author outside the records and a run without decisions', () => {
    const [row] = aiLogRows([run({ requestedBy: 'unknown', employeeId: null })], people);
    expect(row?.requestedBy).toBe('Konto spoza akt');
    expect(row?.employee).toBeNull();
    expect(row?.decisions).toBe('Bez decyzji');
  });

  it('flags runs whose content retention removed', () => {
    const [row] = aiLogRows([run({ contentDeletedAt: '2026-11-21T00:00:00Z' })], people);
    expect(row?.contentDeleted).toBe(true);
  });
});

describe('decisionCounts', () => {
  it('marks a run with no decisions as pending', () => {
    expect(decisionCounts(run())).toEqual({ accepted: 0, edited: 0, rejected: 0, pending: true });
  });
});

describe('formatDateTime', () => {
  it('formats in Warsaw time as dd.mm.rrrr gg:mm', () => {
    expect(formatDateTime('2026-11-20T10:05:00Z')).toBe('20.11.2026 11:05');
    expect(formatDateTime('2026-07-01T22:30:00Z')).toBe('02.07.2026 00:30');
  });
});

describe('fragmentLabel', () => {
  it('names the fragment paths of every kind', () => {
    expect(fragmentLabel('criteria.0.rating')).toBe('Kryterium 1, ocena');
    expect(fragmentLabel('rating.c2')).toBe('Ocena, kryterium c2');
    expect(fragmentLabel('justification.1')).toBe('Uzasadnienie 2');
    expect(fragmentLabel('signal.burnout_risk')).toBe('Sygnał, ryzyko wypalenia');
    expect(fragmentLabel('goal')).toBe('Cel rozmowy');
    expect(fragmentLabel('answer')).toBe('Odpowiedź');
  });

  it('falls back to the fragment with dots replaced by spaces', () => {
    expect(fragmentLabel('weird.path.here')).toBe('weird path here');
  });
});

describe('parseAiLogFilter', () => {
  it('drops invalid values', () => {
    expect(parseAiLogFilter({ rodzaj: 'hr_signals', pracownik: 'nie-uuid' })).toEqual({
      kind: 'hr_signals',
    });
    expect(parseAiLogFilter({ rodzaj: 'x', pracownik: EMPLOYEE_ID })).toEqual({
      employeeId: EMPLOYEE_ID,
    });
    expect(parseAiLogFilter({})).toEqual({});
  });
});

describe('labels', () => {
  it('has a status tag per status and a label per kind', () => {
    expect(runStatusTag('failed').label).toBe('Nieudane');
    expect(runStatusTag('queued')).toEqual({ tone: 'waiting', label: 'W kolejce' });
    expect(Object.keys(aiKindLabels)).toHaveLength(8);
  });
});
