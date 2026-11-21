import { describe, expect, it } from 'vitest';
import { calendarDate } from '../deadlines/calendar-date';
import { RECORDS_RETENTION_YEARS, retentionEndsOn } from './retention';

describe('retention period', () => {
  it('retention ends on the last day of the tenth year after the end year', () => {
    expect(retentionEndsOn(calendarDate('2026-03-15'))).toBe('2036-12-31');
  });

  it('december end gives the same year rule', () => {
    expect(retentionEndsOn(calendarDate('2026-12-31'))).toBe('2036-12-31');
    expect(retentionEndsOn(calendarDate('2026-01-01'))).toBe('2036-12-31');
  });

  it('the period is ten years', () => {
    expect(RECORDS_RETENTION_YEARS).toBe(10);
  });
});
