import { type CalendarDate, calendarDate, recommendDevelopment } from '@sarmata/domain';
import { describe, expect, it } from 'vitest';
import { officialRegulations, trainingCatalog } from './index';

const regulation = officialRegulations[0];
if (!regulation) throw new Error('missing official regulation');
const criterionIds = regulation.criteria.catalog.map((criterion) => criterion.id);

const ratings = (points: number[], sheetId = 'C') => {
  const sheet = regulation.sheets.find((candidate) => candidate.id === sheetId);
  const ids = [...(sheet?.mandatoryCriteria ?? []), 'creativity'];
  return Object.fromEntries(ids.map((id, index) => [id, points[index] ?? 5]));
};

const recommend = (
  points: number[],
  options: { sheetId?: string; on?: CalendarDate; catalog?: typeof trainingCatalog } = {},
) =>
  recommendDevelopment({
    regulation,
    sheetId: options.sheetId ?? 'C',
    ratings: ratings(points, options.sheetId ?? 'C'),
    catalog: options.catalog ?? trainingCatalog,
    on: options.on ?? calendarDate('2026-11-21'),
  });

describe('training catalog', () => {
  it('catalog has 249 items', () => {
    expect(trainingCatalog).toHaveLength(249);
    expect(new Set(trainingCatalog.map((item) => item.id)).size).toBe(249);
  });

  it('every criterion id exists in regulation-2016', () => {
    for (const item of trainingCatalog) {
      for (const id of [...item.criteria, item.mainCriterion]) {
        expect(criterionIds, `${item.id} ${id}`).toContain(id);
      }
    }
  });

  it('all 14 criteria have items', () => {
    for (const id of criterionIds) {
      expect(
        trainingCatalog.some((item) => item.criteria.includes(id)),
        id,
      ).toBe(true);
    }
  });
});

describe('recommendDevelopment', () => {
  // EX-9: sheet C, mandatory knowledge-use, reliability, work-organization, cooperation, communication
  // and creativity as the additional one, rated 5, 1, 5, 1, 1, 5.
  it('EX-9 ratings focus on the 1-point criteria', () => {
    const { focus } = recommend([5, 1, 5, 1, 1, 5]);
    expect(focus.map((item) => [item.criterionId, item.points])).toEqual([
      ['communication', 1],
      ['reliability', 1],
      ['cooperation', 1],
    ]);
  });

  it('free items come first', () => {
    const { focus } = recommend([5, 1, 5, 1, 1, 5]);
    for (const item of focus) {
      const flags = item.trainings.map((training) => training.free);
      expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
      expect(item.trainings.length).toBeGreaterThan(0);
      expect(item.trainings.length).toBeLessThanOrEqual(5);
    }
  });

  it('finished items are skipped', () => {
    const finished = trainingCatalog.filter((item) => item.status === 'finished');
    expect(finished.length).toBeGreaterThan(0);
    const ids = new Set(finished.map((item) => item.id));
    const result = recommend([1, 1, 1, 1, 1, 1]);
    for (const item of result.focus) {
      for (const training of item.trainings) expect(ids.has(training.id)).toBe(false);
    }
  });

  it('manager-only items are hidden for sheet C', () => {
    const managerOnly = new Set(
      trainingCatalog.filter((item) => item.audience === 'managers').map((item) => item.id),
    );
    expect(managerOnly.size).toBeGreaterThan(0);
    const result = recommend([5, 5, 5, 5, 1, 5]);
    const shown = result.focus.flatMap((item) => item.trainings.map((training) => training.id));
    expect(shown.some((id) => managerOnly.has(id))).toBe(false);
  });

  it('items for managers and coordinators are open to sheet C', () => {
    for (const id of ['SK072', 'SK078', 'SK249']) {
      expect(trainingCatalog.find((item) => item.id === id)?.audience).toBe('all');
    }
  });

  it('manager-only items are offered for sheet A', () => {
    const catalog = trainingCatalog
      .filter((item) => item.audience === 'managers' && item.status !== 'finished')
      .slice(0, 1);
    const [only] = catalog;
    if (!only) throw new Error('no manager item');
    const result = recommendDevelopment({
      regulation,
      sheetId: 'A',
      ratings: { [only.criteria[0] ?? '']: 1 },
      catalog,
      on: calendarDate('2026-11-21'),
    });
    expect(result.focus[0]?.trainings.map((training) => training.id)).toEqual([only.id]);
  });

  it('priority flag follows the year', () => {
    const item = trainingCatalog.find((candidate) => candidate.priorityYears.includes(2025));
    if (!item) throw new Error('no 2025 priority item');
    const probe = { ...item, status: 'available' as const, audience: 'all' as const };
    const run = (year: string) =>
      recommendDevelopment({
        regulation,
        sheetId: 'C',
        ratings: { [item.criteria[0] ?? '']: 1 },
        catalog: [probe],
        on: calendarDate(`${year}-06-01`),
      }).focus[0]?.trainings[0]?.priority;
    expect(run('2025')).toBe(true);
    expect(run('2026')).toBe(false);
  });

  it('priority items rank before others of the same cost', () => {
    const base = trainingCatalog.find((item) => item.free && item.status === 'available');
    if (!base) throw new Error('no free item');
    const criterion = base.criteria[0] ?? '';
    const plain = { ...base, id: 'SK900', channel: 'sc-elearning' as const, priorityYears: [] };
    const priority = { ...base, id: 'SK901', channel: 'mooc' as const, priorityYears: [2026] };
    const result = recommendDevelopment({
      regulation,
      sheetId: 'C',
      ratings: { [criterion]: 1 },
      catalog: [plain, priority],
      on: calendarDate('2026-11-21'),
    });
    expect(result.focus[0]?.trainings.map((training) => training.id)).toEqual(['SK901', 'SK900']);
  });

  it('all top ratings give no focus', () => {
    const result = recommend([9, 9, 9, 9, 9, 9]);
    expect(result.focus).toEqual([]);
    expect(result.conclusionsDraft).toContain('najwyższym poziomie');
  });

  it('empty ratings give no focus', () => {
    const result = recommendDevelopment({
      regulation,
      sheetId: 'C',
      ratings: {},
      catalog: trainingCatalog,
      on: calendarDate('2026-11-21'),
    });
    expect(result.focus).toEqual([]);
  });

  it('actions follow 70-20-10', () => {
    const [first] = recommend([5, 1, 5, 5, 5, 5]).focus;
    expect(first?.actions.map((action) => [action.kind, action.share])).toEqual([
      ['development-task', 70],
      ['substitution', 70],
      ['mentoring', 20],
    ]);
  });

  it('the conclusions draft names the criteria and a first proposal', () => {
    const { conclusionsDraft, focus } = recommend([5, 1, 5, 5, 5, 5]);
    expect(conclusionsDraft).toContain(focus[0]?.name);
    expect(conclusionsDraft).toContain(focus[0]?.trainings[0]?.title);
  });

  it('shows at most three focus criteria, the lowest first', () => {
    const { focus } = recommend([3, 1, 3, 1, 3, 1]);
    expect(focus.map((item) => item.points)).toEqual([1, 1, 1]);
  });
});
