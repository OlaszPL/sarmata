import { describe, expect, it } from 'vitest';
import { addMonths, calendarDate } from '../index';

describe('addMonths (art. 112 Kc, KPRM term counting rules)', () => {
  it.each([
    ['2024-03-16', 24, '2026-03-16'],
    ['2024-01-31', 13, '2025-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2016-04-04', 24, '2018-04-04'],
    ['2025-11-30', 3, '2026-02-28'],
    ['2025-12-15', 1, '2026-01-15'],
    ['2025-02-28', 1, '2025-03-28'],
    ['2024-02-29', 12, '2025-02-28'],
    ['2024-03-16', 0, '2024-03-16'],
  ])('%s + %i months = %s', (from, months, expected) => {
    expect(addMonths(calendarDate(from), months)).toBe(expected);
  });

  it('rejects a negative or fractional number of months', () => {
    const from = calendarDate('2024-03-16');
    expect(() => addMonths(from, -1)).toThrow(RangeError);
    expect(() => addMonths(from, 1.5)).toThrow(RangeError);
  });

  it('throws RangeError when the result leaves the supported year range', () => {
    expect(() => addMonths(calendarDate('9999-12-01'), 1)).toThrow(RangeError);
    expect(() => addMonths(calendarDate('2024-03-16'), Number.MAX_SAFE_INTEGER)).toThrow(
      RangeError,
    );
  });
});
