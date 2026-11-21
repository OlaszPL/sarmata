import { type CalendarDate, lastDayOfMonth, toParts, fromParts } from './calendar-date';

/**
 * End of a term counted in months (art. 112 Kc): the day with the same number as the start day,
 * or the last day of the month when there is none.
 */
export function addMonths(from: CalendarDate, months: number): CalendarDate {
  if (!Number.isInteger(months) || months < 0) {
    throw new RangeError(`Months must be a non-negative integer: ${months}`);
  }
  const { year, month, day } = toParts(from);
  const index = year * 12 + (month - 1) + months;
  const newYear = Math.floor(index / 12);
  const newMonth = (index % 12) + 1;
  return fromParts(newYear, newMonth, Math.min(day, lastDayOfMonth(newYear, newMonth)));
}
