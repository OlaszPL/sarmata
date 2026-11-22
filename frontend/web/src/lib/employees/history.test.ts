import {
  type ArchivedEvaluation,
  type EvaluationView,
  type RegulationDocument,
  calendarDate,
} from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { employeeHistory } from './history';

const document = {
  partialScale: {
    levels: [
      { code: 'below', name: 'poniżej oczekiwań', points: 3 },
      { code: 'above', name: 'powyżej oczekiwań', points: 7 },
    ],
  },
  criteria: {
    catalog: [
      { id: 'a', name: 'Rzetelność', indicators: ['x'] },
      { id: 'b', name: 'Współpraca', indicators: ['x'] },
    ],
  },
} as unknown as RegulationDocument;

function archived(overrides: Partial<ArchivedEvaluation>): ArchivedEvaluation {
  return {
    id: 'arch-1',
    employeeId: 'emp',
    draftedOn: calendarDate('2023-05-10'),
    acquaintedOn: null,
    levelCode: 'above',
    outcome: 'positive',
    ratings: null,
    ...overrides,
  };
}

interface ViewOptions {
  id: string;
  status: string;
  cycleStart: string;
  mean?: number | null;
  levelCode?: string | null;
  approvedOn?: string;
  ratings?: Record<string, number>;
  deadline?: string;
}

function view(options: ViewOptions): EvaluationView {
  return {
    id: options.id,
    status: options.status,
    cycleStart: options.cycleStart,
    score: { mean: options.mean ?? null, levelCode: options.levelCode ?? null },
    events: options.approvedOn ? [{ kind: 'sheet_approved', occurredOn: options.approvedOn }] : [],
    deadlines: options.deadline ? [{ slot: 'evaluationDeadline', dueOn: options.deadline }] : [],
    sheet: { content: { partTwo: { ratings: options.ratings ?? {} } } },
  } as unknown as EvaluationView;
}

const base = { archived: [], views: [], document, current: null };

describe('employeeHistory rows', () => {
  it('builds an archived row without ratings', () => {
    const { rows } = employeeHistory({ ...base, archived: [archived({})] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: 'archived-arch-1',
      period: 'Ocena 2023',
      source: 'Archiwalna, wpisana ręcznie',
      mean: null,
      levelName: 'powyżej oczekiwań',
      ratings: null,
      open: false,
      evaluationId: null,
      dateKey: '2023-05-10',
    });
  });

  it('averages the ratings of an archived row', () => {
    const { rows } = employeeHistory({
      ...base,
      archived: [archived({ ratings: { a: 7, b: 9 } })],
    });
    expect(rows[0]?.mean).toBe(8);
    expect(rows[0]?.ratings).toEqual({ a: 7, b: 9 });
  });

  it('describes a closed evaluation with the approval date', () => {
    const { rows } = employeeHistory({
      ...base,
      views: [
        view({
          id: 'ev1',
          status: 'closed',
          cycleStart: '2024-01-01',
          mean: 5.6,
          levelCode: 'above',
          approvedOn: '2024-12-12',
          deadline: '2026-01-31',
        }),
      ],
    });
    expect(rows[0]).toMatchObject({
      key: 'evaluation-ev1',
      period: 'Ocena 2024 do 2026',
      source: 'Sporządzona w Sarmacie 12.12.2024',
      mean: 5.6,
      levelName: 'powyżej oczekiwań',
      open: false,
      evaluationId: 'ev1',
    });
  });

  it('skips interrupted evaluations and marks open ones', () => {
    const { rows } = employeeHistory({
      ...base,
      views: [
        view({ id: 'x', status: 'interrupted', cycleStart: '2022-01-01' }),
        view({ id: 'y', status: 'period', cycleStart: '2025-01-01' }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      open: true,
      source: 'W toku, Okres oceny',
      mean: null,
      period: 'Ocena 2025',
    });
  });

  it('sorts rows from the oldest', () => {
    const { rows } = employeeHistory({
      ...base,
      archived: [archived({ id: 'new', draftedOn: calendarDate('2024-03-01') }), archived({})],
    });
    expect(rows.map((row) => row.dateKey)).toEqual(['2023-05-10', '2024-03-01']);
  });
});

describe('employeeHistory criteria', () => {
  const two = (first: number, second: number) =>
    employeeHistory({
      ...base,
      archived: [
        archived({ id: 'o', draftedOn: calendarDate('2022-05-10'), ratings: { a: first } }),
        archived({ id: 'n', draftedOn: calendarDate('2024-05-10'), ratings: { a: second } }),
      ],
    }).criteria;

  it('reports a drop', () => {
    const criteria = two(7, 5);
    expect(criteria.columns.map((column) => column.period)).toEqual(['Ocena 2022', 'Ocena 2024']);
    expect(criteria.rows[0]).toMatchObject({
      criterionId: 'a',
      name: 'Rzetelność',
      values: [7, 5],
      change: { kind: 'down', by: 2 },
    });
  });

  it('reports no change', () => {
    expect(two(7, 7).rows[0]?.change).toEqual({ kind: 'same', by: 0 });
  });

  it('has no change with a single source', () => {
    const { criteria } = employeeHistory({
      ...base,
      archived: [archived({ ratings: { a: 7 } })],
    });
    expect(criteria.rows[0]?.change).toBeNull();
  });
});

describe('employeeHistory stats', () => {
  it('shows an empty state without evaluations', () => {
    expect(employeeHistory(base).stats).toEqual([
      { label: 'Ostatnia ocena', value: 'Brak', hint: 'Ta osoba nie ma jeszcze ocen' },
    ]);
  });

  it('shows the level when the archived row has no mean', () => {
    const { stats } = employeeHistory({ ...base, archived: [archived({})] });
    expect(stats).toEqual([
      { label: 'Ostatnia ocena', value: 'Powyżej', hint: 'Ocena archiwalna' },
    ]);
  });

  it('computes the change between the oldest and the latest mean', () => {
    const { stats } = employeeHistory({
      ...base,
      views: [
        view({
          id: 'a',
          status: 'closed',
          cycleStart: '2022-01-01',
          mean: 7.4,
          levelCode: 'above',
        }),
        view({
          id: 'b',
          status: 'closed',
          cycleStart: '2024-01-01',
          mean: 5.6,
          levelCode: 'below',
        }),
      ],
    });
    expect(stats[0]).toEqual({ label: 'Ostatnia ocena', value: '5,60', hint: 'Poniżej oczekiwań' });
    expect(stats[1]).toEqual({
      label: 'Zmiana od 2022',
      value: '−1,80',
      hint: 'spadek w 2 ocenach',
    });
  });

  it('adds the due date of the open evaluation', () => {
    const { stats } = employeeHistory({
      ...base,
      current: { dueOn: '2026-03-31' as never, stage: 'Okres oceny' },
    });
    expect(stats.at(-1)).toEqual({
      label: 'Termin oceny',
      value: '31.03',
      hint: '2026 r., Okres oceny',
    });
  });
});
