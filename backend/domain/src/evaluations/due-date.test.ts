import { describe, expect, it } from 'vitest';
import { calendarDate } from '../deadlines/calendar-date';
import { effectiveDueOn } from './due-date';

const computed = calendarDate('2026-06-30');

describe('effectiveDueOn', () => {
  it('ignores a chosen date later than computed', () => {
    expect(effectiveDueOn(computed, calendarDate('2026-07-15'))).toBe(computed);
  });

  it('keeps an earlier chosen date', () => {
    expect(effectiveDueOn(computed, calendarDate('2026-05-10'))).toBe('2026-05-10');
  });

  it('falls back to computed without a choice', () => {
    expect(effectiveDueOn(computed, null)).toBe(computed);
  });
});
