import { type HistoryEntry, calendarDate, evaluationResult, sheetCriteria } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from './index';

const regulation = officialRegulations[0];
if (!regulation) throw new Error('missing official regulation');

const criteriaC = sheetCriteria(regulation, 'C', []);
const content = (points: readonly number[]) => ({
  partOne: { additionalCriteria: [], dueOn: null },
  partTwo: {
    interviewOn: null,
    periodFrom: null,
    periodTo: null,
    ratings: Object.fromEntries(criteriaC.map((id, index) => [id, points[index] ?? 5])),
    justification: '',
    developmentConclusions: '',
    gradeRequest: null,
  },
});
const entry = (
  drafted: string,
  levelCode: string | null,
  outcome: 'positive' | 'negative' | null,
  acquainted: string | null = null,
): HistoryEntry => ({
  drafted: calendarDate(drafted),
  levelCode,
  outcome,
  acquaintedOn: acquainted === null ? null : calendarDate(acquainted),
});
const base = {
  sheetId: 'C',
  serviceStatus: 'employee' as const,
  gradeGrantedOn: null,
  drafted: calendarDate('2026-03-01'),
  acquaintedOn: calendarDate('2026-03-05'),
  history: [] as HistoryEntry[],
};
const all = (points: number) => criteriaC.map(() => points);

describe('evaluationResult', () => {
  it('meets with a far-below partial is negative', () => {
    const points = all(5);
    points[0] = 1;
    points[1] = 7;
    points[2] = 7;
    const result = evaluationResult(regulation, { ...base, content: content(points) });
    expect(result.levelCode).toBe('meets');
    expect(result.outcome).toBe('negative');
  });

  it('off-scale rating gives an empty result', () => {
    const points = all(5);
    points[0] = 4;
    const result = evaluationResult(regulation, { ...base, content: content(points) });
    expect(result.levelCode).toBeNull();
    expect(result.outcome).toBeNull();
    expect(result.mean).toBeNull();
  });

  it('second negative after an earlier negative', () => {
    const result = evaluationResult(regulation, {
      ...base,
      content: content(all(1)),
      history: [entry('2024-03-01', 'below', 'negative')],
    });
    expect(result.outcome).toBe('negative');
    expect(result.secondConsecutiveNegative).toBe(true);
  });

  it('later history entries are ignored', () => {
    const result = evaluationResult(regulation, {
      ...base,
      content: content(all(1)),
      history: [entry('2027-03-01', 'below', 'negative')],
    });
    expect(result.secondConsecutiveNegative).toBe(false);
  });

  it('grade by law due for a civil servant after two above levels', () => {
    const result = evaluationResult(regulation, {
      ...base,
      serviceStatus: 'civil_servant',
      gradeGrantedOn: calendarDate('2020-01-10'),
      content: content(all(7)),
      history: [entry('2023-03-01', 'above', 'positive', '2023-03-06')],
    });
    expect(result.levelCode).toBe('above');
    expect(result.gradeByLawDueOn).not.toBeNull();
  });

  it('employee never gets grade by law', () => {
    const result = evaluationResult(regulation, {
      ...base,
      gradeGrantedOn: calendarDate('2020-01-10'),
      content: content(all(7)),
      history: [entry('2023-03-01', 'above', 'positive', '2023-03-06')],
    });
    expect(result.gradeByLawDueOn).toBeNull();
  });
});
