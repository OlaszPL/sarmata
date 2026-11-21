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

  it('counts days between dates', () => {
    expect(daysUntil(d('2026-11-21'), d('2026-12-04'))).toBe(13);
    expect(daysUntil(d('2026-11-21'), d('2026-11-18'))).toBe(-3);
  });

  it('formats dates', () => {
    expect(formatDate(d('2026-12-04'))).toBe('04.12.2026');
    expect(formatShortDate(d('2026-12-04'))).toBe('04.12');
    expect(longDate(d('2026-11-21'))).toBe('Sobota, 21 listopada 2026');
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
