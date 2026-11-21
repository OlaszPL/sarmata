import { describe, expect, it } from 'vitest';
import { calendarDate } from '../index';

describe('calendarDate', () => {
  it('accepts an existing YYYY-MM-DD date', () => {
    expect(calendarDate('2024-02-29')).toBe('2024-02-29');
  });

  it.each([
    '2024-02-30',
    '2023-02-29',
    '2024-13-01',
    '16.03.2024',
    '2024-3-16',
    '0999-01-01',
    '0000-01-01',
  ])('rejects %s', (bad) => {
    expect(() => calendarDate(bad)).toThrow(RangeError);
  });
});
