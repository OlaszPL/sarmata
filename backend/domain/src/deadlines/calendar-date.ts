declare const brand: unique symbol;

/** A date without time and zone in `YYYY-MM-DD` format. Only `calendarDate` creates it, so it always exists. */
export type CalendarDate = string & { readonly [brand]: 'CalendarDate' };

const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;

const twoDigits = (n: number): string => String(n).padStart(2, '0');

export const lastDayOfMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Validates the format and that the day exists. Throws `RangeError` for a bad date. */
export function calendarDate(iso: string): CalendarDate {
  const match = DATE_FORMAT.exec(iso);
  if (!match) throw new RangeError(`Invalid date format: ${iso}`);
  return fromParts(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Internal: year, month (1 to 12) and day of a valid date. */
export function toParts(date: CalendarDate): { year: number; month: number; day: number } {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

/** Internal: builds a date from parts, throws `RangeError` when the day does not exist or the year is outside 1000 to 9999. */
export function fromParts(year: number, month: number, day: number): CalendarDate {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < MIN_YEAR ||
    year > MAX_YEAR ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > lastDayOfMonth(year, month)
  ) {
    throw new RangeError(`Date does not exist: ${year}-${twoDigits(month)}-${twoDigits(day)}`);
  }
  return `${year}-${twoDigits(month)}-${twoDigits(day)}` as CalendarDate;
}
