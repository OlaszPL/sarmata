import { type CalendarDate, fromParts, toParts } from './calendar-date';

const DAY_MS = 86_400_000;

const toUtcMs = (date: CalendarDate): number => {
  const { year, month, day } = toParts(date);
  return Date.UTC(year, month - 1, day);
};

const fromUtcMs = (ms: number): CalendarDate => {
  const date = new Date(ms);
  return fromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};

/** Internal: the date `days` calendar days later (a negative number goes back). */
export const addDays = (date: CalendarDate, days: number): CalendarDate =>
  fromUtcMs(toUtcMs(date) + days * DAY_MS);

/** Internal: 0 is Sunday, 6 is Saturday. */
export const weekday = (date: CalendarDate): number => new Date(toUtcMs(date)).getUTCDay();

/** Internal: number of days from `from` to `to`, both included. */
export const daysInclusive = (from: CalendarDate, to: CalendarDate): number =>
  Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS) + 1;
