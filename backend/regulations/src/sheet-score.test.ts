import { additionalCriteriaIssues, proposeSheet, scoreSheet, sheetCriteria } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations } from './index';

const regulation = officialRegulations[0];
if (!regulation) throw new Error('missing official regulation');

const extraCriteria = (sheetId: string, count: number): string[] => {
  const mandatory =
    regulation.sheets.find((sheet) => sheet.id === sheetId)?.mandatoryCriteria ?? [];
  return regulation.criteria.catalog
    .map((criterion) => criterion.id)
    .filter((id) => !mandatory.includes(id))
    .slice(0, count);
};

const ratingsFor = (criteria: readonly string[], points: readonly number[]) =>
  Object.fromEntries(criteria.map((id, index) => [id, points[index] ?? 0]));

describe('scoreSheet on the KPRM examples', () => {
  it.each([
    ['EX-2', 'B', [9, 5, 7, 7, 7, 5, 7, 7], 6.75, 'above', 'positive'],
    ['EX-3', 'B', [9, 7, 9, 7, 7, 9, 7], 55 / 7, 'above', 'positive'],
    ['EX-4', 'C', [5, 1, 5, 5, 5], 4.2, 'meets', 'negative'],
    ['EX-6', 'A', [7, 5, 5, 5, 7, 5, 9, 5], 6, 'meets', 'positive'],
    ['EX-9', 'C', [5, 1, 5, 1, 1, 5], 3, 'below', 'negative'],
    ['EX-12', 'C', [5, 5, 5, 3, 3, 3, 3], 27 / 7, 'below', 'negative'],
  ] as const)('%s', (_example, sheetId, points, mean, levelCode, outcome) => {
    const mandatory = sheetCriteria(regulation, sheetId, []).length;
    const criteria = sheetCriteria(
      regulation,
      sheetId,
      extraCriteria(sheetId, points.length - mandatory),
    );
    expect(criteria).toHaveLength(points.length);
    expect(scoreSheet(regulation, criteria, ratingsFor(criteria, points))).toEqual({
      complete: true,
      mean,
      levelCode,
      outcome,
    });
  });

  it('incomplete ratings give no result', () => {
    const criteria = sheetCriteria(regulation, 'C', []);
    expect(scoreSheet(regulation, criteria, { [criteria[0] ?? '']: 5 })).toEqual({
      complete: false,
      mean: null,
      levelCode: null,
      outcome: null,
    });
  });

  it('points outside scale throw', () => {
    const criteria = sheetCriteria(regulation, 'C', []);
    expect(() => scoreSheet(regulation, criteria, ratingsFor(criteria, [5, 5, 5, 5, 4]))).toThrow(
      RangeError,
    );
  });

  it('mean exactly 2 is far-below band', () => {
    const criteria = sheetCriteria(regulation, 'C', extraCriteria('C', 1));
    const result = scoreSheet(regulation, criteria, ratingsFor(criteria, [1, 1, 1, 3, 3, 3]));
    expect(result).toMatchObject({ mean: 2, levelCode: 'far-below', outcome: 'negative' });
  });
});

describe('additional criteria rules', () => {
  const four = ['negotiation', 'creativity', 'crisis-management', 'public-speaking'];

  it('four additional give too_many', () => {
    expect(additionalCriteriaIssues(regulation, 'C', four)).toContainEqual({ code: 'too_many' });
  });
  it('a repeat gives duplicate', () => {
    expect(additionalCriteriaIssues(regulation, 'C', ['negotiation', 'negotiation'])).toEqual([
      { code: 'duplicate', criterionId: 'negotiation' },
    ]);
  });
  it('communication on sheet C gives mandatory_as_additional', () => {
    expect(additionalCriteriaIssues(regulation, 'C', ['communication'])).toEqual([
      { code: 'mandatory_as_additional', criterionId: 'communication' },
    ]);
  });
  it('negotiation on sheet C passes', () => {
    expect(additionalCriteriaIssues(regulation, 'C', ['negotiation'])).toEqual([]);
  });
  it('nonexistent gives unknown', () => {
    expect(additionalCriteriaIssues(regulation, 'C', ['nonexistent'])).toEqual([
      { code: 'unknown', criterionId: 'nonexistent' },
    ]);
  });
  it('lists mandatory criteria first, then additional', () => {
    expect(sheetCriteria(regulation, 'C', ['negotiation']).at(-1)).toBe('negotiation');
  });
});

describe('sheet selection', () => {
  it.each([
    ['office_head', 'A'],
    ['manages_people', 'B'],
    ['other', 'C'],
  ] as const)('%s gives %s', (kind, sheetId) => {
    expect(proposeSheet(regulation, kind)).toBe(sheetId);
  });
});
