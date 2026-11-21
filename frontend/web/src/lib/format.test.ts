import { calendarDate } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  formatDate,
  formatShortDate,
  longDate,
  pluralPl,
  relativeDays,
  todayInWarsaw,
} from './format';

const d = calendarDate;

describe('pluralPl', () => {
  it.each([
    [1, 'sprawę'],
    [3, 'sprawy'],
    [5, 'spraw'],
    [12, 'spraw'],
    [22, 'sprawy'],
    [0, 'spraw'],
  ])('picks the form for %i', (n, expected) => {
    expect(pluralPl(n, 'sprawę', 'sprawy', 'spraw')).toBe(expected);
  });
});

describe('dates', () => {
  it('rolls over at midnight in Warsaw', () => {
    expect(todayInWarsaw(new Date('2026-11-21T23:30:00Z'))).toBe('2026-11-22');
  });

  it('rolls over at midnight in Warsaw in summer time', () => {
    expect(todayInWarsaw(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
    expect(todayInWarsaw(new Date('2026-06-30T21:30:00Z'))).toBe('2026-06-30');
  });

  it('counts days between dates', () => {
    expect(daysUntil(d('2026-11-21'), d('2026-12-04'))).toBe(13);
    expect(daysUntil(d('2026-11-21'), d('2026-11-18'))).toBe(-3);
  });

  it('formats dates', () => {
    expect(formatDate(d('2026-12-04'))).toBe('04.12.2026');
    expect(formatShortDate(d('2026-12-04'), d('2026-11-21'))).toBe('04.12');
    expect(longDate(d('2026-11-21'))).toBe('Sobota, 21 listopada 2026');
  });

  it('adds the year to a short date outside the current year', () => {
    expect(formatShortDate(d('2028-11-21'), d('2026-11-21'))).toBe('21.11.2028');
    expect(formatShortDate(d('2025-12-30'), d('2026-01-02'))).toBe('30.12.2025');
    expect(formatShortDate(d('2026-01-05'), d('2026-12-30'))).toBe('05.01');
  });

  it.each([
    [0, 'dziś'],
    [1, 'jutro'],
    [13, 'za 13 dni'],
    [-1, '1 dzień po terminie'],
    [-3, '3 dni po terminie'],
  ])('describes %i days', (days, expected) => {
    expect(relativeDays(days)).toBe(expected);
  });
});
