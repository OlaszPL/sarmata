import type { CalendarDate } from '../deadlines/calendar-date';
import type { RegulationDocument } from '../regulations/regulation-document';
import type { SheetScore } from './score';

export type ObjectionOutcome = 'rejected' | 'changed' | 'redraft';

/** An objection filed after the deadline is late. A missing deadline never blocks. */
export function objectionFilingIssue(
  objectionDue: CalendarDate | null,
  filedOn: CalendarDate,
): 'objection_late' | null {
  return objectionDue !== null && filedOn > objectionDue ? 'objection_late' : null;
}

/**
 * True when the changed sheet gives a lower overall level (position in `overallLevel.bands`)
 * or turns a positive outcome into a negative one. Incomplete scores never count as lowered.
 */
export function outcomeLowered(
  regulation: RegulationDocument,
  before: SheetScore,
  after: SheetScore,
): boolean {
  if (before.levelCode === null || after.levelCode === null) return false;
  if (before.outcome === 'positive' && after.outcome === 'negative') return true;
  const order = regulation.overallLevel.bands.map((band) => band.code);
  return order.indexOf(after.levelCode) < order.indexOf(before.levelCode);
}
