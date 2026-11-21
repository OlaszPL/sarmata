import { addDays, weekday } from './calendar';
import { type CalendarDate, fromParts, toParts } from './calendar-date';

/** Gregorian Easter Sunday (Meeus, Jones and Butcher algorithm). */
function easterSunday(year: number): CalendarDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return fromParts(year, month, day);
}

const holidaysByYear = new Map<number, ReadonlySet<CalendarDate>>();

/**
 * Public holidays under art. 1 of the act of 18 January 1951 on days off work:
 * 6 January since 2011, 24 December since 2025 (Dz.U. 2024 poz. 1965).
 * Easter Sunday and Pentecost are Sundays anyway, listed so the set mirrors the act.
 */
function publicHolidays(year: number): ReadonlySet<CalendarDate> {
  const cached = holidaysByYear.get(year);
  if (cached) return cached;
  const fixed: [number, number][] = [
    [1, 1],
    [5, 1],
    [5, 3],
    [8, 15],
    [11, 1],
    [11, 11],
    [12, 25],
    [12, 26],
  ];
  if (year >= 2011) fixed.push([1, 6]);
  if (year >= 2025) fixed.push([12, 24]);
  const easter = easterSunday(year);
  const holidays = new Set<CalendarDate>([
    ...fixed.map(([month, day]) => fromParts(year, month, day)),
    easter,
    addDays(easter, 1),
    addDays(easter, 49),
    addDays(easter, 60),
  ]);
  holidaysByYear.set(year, holidays);
  return holidays;
}

/** Internal: not a Saturday, not a Sunday and not a public holiday. */
export function isWorkingDay(date: CalendarDate): boolean {
  const day = weekday(date);
  return day !== 0 && day !== 6 && !publicHolidays(toParts(date).year).has(date);
}

/** Internal: art. 115 Kc, an end of term on a day off or a Saturday moves to the next working day. */
export function nextWorkingDayOnOrAfter(date: CalendarDate): CalendarDate {
  let current = date;
  while (!isWorkingDay(current)) current = addDays(current, 1);
  return current;
}
