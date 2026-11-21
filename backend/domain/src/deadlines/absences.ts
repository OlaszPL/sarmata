import { addMonths } from './add-months';
import { addDays } from './calendar';
import { type CalendarDate } from './calendar-date';
import { isWorkingDay } from './working-days';

/** A justified absence of the evaluated person, both days included. `to` is null while it lasts. */
export interface Absence {
  readonly from: CalendarDate;
  readonly to: CalendarDate | null;
}

const laterEnd = (a: CalendarDate | null, b: CalendarDate | null): CalendarDate | null =>
  a === null || b === null ? null : a > b ? a : b;

function continues(period: Absence, next: Absence): boolean {
  if (period.to === null) return true;
  for (let day = addDays(period.to, 1); day < next.from; day = addDays(day, 1)) {
    if (isWorkingDay(day)) return false;
  }
  return true;
}

/**
 * Internal: continuous absences (KPRM rules). Overlapping, adjacent or separated only by days off
 * merge into one period that runs from the first day of the first absence to the last day of the last.
 */
export function mergeAbsences(absences: readonly Absence[]): Absence[] {
  const sorted = [...absences].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const merged: Absence[] = [];
  for (const absence of sorted) {
    if (absence.to !== null && absence.to < absence.from) {
      throw new RangeError(`Absence ends before it starts: ${absence.from} to ${absence.to}`);
    }
    const last = merged.at(-1);
    if (last && continues(last, absence)) {
      merged[merged.length - 1] = { from: last.from, to: laterEnd(last.to, absence.to) };
    } else {
      merged.push(absence);
    }
  }
  return merged;
}

/**
 * Internal: art. 81 ust. 7 "dłużej niż miesiąc", compared by calendar (art. 112 Kc, P-04).
 * An absence from 5 October to 4 November lasts exactly one month, until 5 November it lasts longer.
 */
export const lastsLongerThanMonth = (from: CalendarDate, to: CalendarDate): boolean =>
  to >= addMonths(from, 1);
