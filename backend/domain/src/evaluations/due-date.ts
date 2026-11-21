import type { CalendarDate } from '../deadlines/calendar-date';

/** The chosen due date counts only when it is not later than the computed one (ISO dates compare as text). */
export function effectiveDueOn(computed: CalendarDate, chosen: CalendarDate | null): CalendarDate {
  return chosen !== null && chosen <= computed ? chosen : computed;
}
