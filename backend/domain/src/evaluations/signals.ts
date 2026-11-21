import { type CalendarDate } from '../deadlines/calendar-date';
import { computeDeadline } from '../deadlines/compute-deadline';
import type { ServiceStatus } from '../employees/employee';
import type { RegulationDocument } from '../regulations/regulation-document';
import { effectiveDueOn } from './due-date';

export interface HistoryEntry {
  readonly drafted: CalendarDate;
  readonly levelCode: string | null;
  readonly outcome: 'positive' | 'negative' | null;
  readonly acquaintedOn: CalendarDate | null;
}

/** True when the two most recent evaluations are both negative. */
export function secondConsecutiveNegative(history: readonly HistoryEntry[]): boolean {
  const sorted = [...history].sort((a, b) => (a.drafted < b.drafted ? -1 : 1));
  const last = sorted.slice(-2);
  return last.length === 2 && last.every((entry) => entry.outcome === 'negative');
}

/**
 * art. 89 ust. 2: a civil servant gets the next grade when the last consecutive evaluations after the
 * grade was granted all have a qualifying level. The due date counts from acquaintance with the last.
 */
export function gradeByLawDue(
  regulation: RegulationDocument,
  input: {
    serviceStatus: ServiceStatus;
    gradeGrantedOn: CalendarDate | null;
    history: readonly HistoryEntry[];
  },
): { dueOn: CalendarDate } | null {
  if (input.serviceStatus !== 'civil_servant') return null;
  const { consecutiveEvaluations, qualifyingLevels, sameLevelRequired } = regulation.gradeByLaw;
  const rule = regulation.deadlines.gradeByLawGrant;
  if (rule === undefined) return null;
  const grantedOn = input.gradeGrantedOn;
  const since = input.history
    .filter((entry) => grantedOn === null || entry.drafted > grantedOn)
    .sort((a, b) => (a.drafted < b.drafted ? -1 : 1));
  const recent = since.slice(-consecutiveEvaluations);
  if (recent.length < consecutiveEvaluations) return null;
  const levels = recent.map((entry) => entry.levelCode);
  if (!levels.every((level) => level !== null && qualifyingLevels.includes(level))) return null;
  if (sameLevelRequired && new Set(levels).size > 1) return null;
  const acquaintedOn = recent.at(-1)?.acquaintedOn ?? null;
  if (acquaintedOn === null) return null;
  const result = computeDeadline(rule, { eventDate: acquaintedOn, absences: [] });
  if (result.kind === 'suspended') return null;
  return { dueOn: effectiveDueOn(result.due, null) };
}
