import { describe, expect, it } from 'vitest';
import { calendarDate } from '../deadlines/calendar-date';
import { type NoteFact, fitNotesToBudget } from './facts';

const note = (id: string, occurredOn: string, length: number): NoteFact => ({
  id,
  version: 1,
  kind: 'observation',
  occurredOn: calendarDate(occurredOn),
  criterionId: null,
  sign: 'plus',
  communicated: false,
  body: 'x'.repeat(length),
});

describe('fitNotesToBudget', () => {
  it('budget keeps newest notes and reports dropped', () => {
    const notes = [
      note('old', '2026-01-10', 40),
      note('newest', '2026-03-10', 40),
      note('middle', '2026-02-10', 40),
      note('oldest', '2025-12-01', 5),
    ];
    const { kept, droppedIds } = fitNotesToBudget(notes, 100);
    expect(kept.map((n) => n.id)).toEqual(['newest', 'middle']);
    expect(droppedIds).toEqual(['old', 'oldest']);
  });

  it('keeps everything within the default budget', () => {
    const { kept, droppedIds } = fitNotesToBudget([note('a', '2026-01-10', 100)]);
    expect(kept).toHaveLength(1);
    expect(droppedIds).toEqual([]);
  });
});
