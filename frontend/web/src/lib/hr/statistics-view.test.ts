import { describe, expect, it } from 'vitest';
import { formatPoints, formatShare, parseYear, yearOptions } from './statistics-view';

describe('parseYear', () => {
  it('accepts an integer in range', () => {
    expect(parseYear('2025', 2026)).toBe(2025);
    expect(parseYear('2000', 2026)).toBe(2000);
    expect(parseYear('2100', 2026)).toBe(2100);
  });

  it('falls back on anything else', () => {
    expect(parseYear(undefined, 2026)).toBe(2026);
    expect(parseYear('', 2026)).toBe(2026);
    expect(parseYear('abc', 2026)).toBe(2026);
    expect(parseYear('2025.5', 2026)).toBe(2026);
    expect(parseYear('1999', 2026)).toBe(2026);
    expect(parseYear('2101', 2026)).toBe(2026);
    expect(parseYear(['2025', '2024'], 2026)).toBe(2026);
  });
});

describe('yearOptions', () => {
  it('lists the current year down to five years back', () => {
    expect(yearOptions(2026)).toEqual([2026, 2025, 2024, 2023, 2022, 2021]);
  });
});

describe('formatShare', () => {
  it('writes whole percents without decimals', () => {
    expect(formatShare(0.43)).toBe('43%');
    expect(formatShare(0)).toBe('0%');
    expect(formatShare(1)).toBe('100%');
  });

  it('writes one decimal with a comma otherwise', () => {
    expect(formatShare(0.0039)).toBe('0,4%');
    expect(formatShare(0.125)).toBe('12,5%');
  });
});

describe('formatPoints', () => {
  it('signs the value and uses a comma', () => {
    expect(formatPoints(3.1)).toBe('+3,1 p.p.');
    expect(formatPoints(-2)).toBe('-2 p.p.');
    expect(formatPoints(0)).toBe('0 p.p.');
  });

  it('says Brak for null', () => {
    expect(formatPoints(null)).toBe('Brak');
  });
});
