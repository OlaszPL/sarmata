import { type CalendarDate, fromParts, toParts } from '../deadlines/calendar-date';

/** Name of the daily job that purges expired content and anonymizes due employees. Same literal in SQL. */
export const RETENTION_JOB_TYPE = 'retention.run';

/** Years the records of a former employee are kept (art. 94 pkt 9b Kodeksu pracy, 10 years). */
export const RECORDS_RETENTION_YEARS = 10;

/**
 * Last day of the retention period of a former employee's records. The period counts from the end of
 * the calendar year in which employment ended (art. 94 pkt 9b KP), so it ends on 31 December of the
 * end year plus ten. Anonymization may start the day after. The only place of this rule: SQL guards
 * the stored date with a check, it never computes it.
 */
export function retentionEndsOn(employmentEndedOn: CalendarDate): CalendarDate {
  const { year } = toParts(employmentEndedOn);
  return fromParts(year + RECORDS_RETENTION_YEARS, 12, 31);
}
