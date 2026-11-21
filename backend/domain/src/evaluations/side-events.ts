import { z } from 'zod';
import { addMonths } from '../deadlines/add-months';
import type { Absence } from '../deadlines/absences';
import { type CalendarDate, calendarDate } from '../deadlines/calendar-date';
import {
  type RegulationDocument,
  termChangeReasonSchema,
} from '../regulations/regulation-document';

const dateField = z.string().transform((value, ctx) => {
  try {
    return calendarDate(value);
  } catch {
    ctx.issues.push({ code: 'custom', message: `invalid date ${value}`, input: value });
    return z.NEVER;
  }
});

/** A later entry with the same `absenceId` replaces the earlier one (e.g. adding the return date). */
export const absencePayloadSchema = z.strictObject({
  absenceId: z.uuid(),
  from: dateField,
  to: dateField.nullable(),
});

export const termChangePayloadSchema = z.strictObject({
  newDueOn: dateField,
  reason: termChangeReasonSchema,
  noticeOn: dateField,
});

export const positionChangePayloadSchema = z.strictObject({
  changedOn: dateField,
  significant: z.boolean(),
  justification: z.string().min(1),
  positionTitle: z.string().nullable(),
  orgUnit: z.string().nullable(),
});

export type AbsencePayload = z.output<typeof absencePayloadSchema>;
export type TermChangePayload = z.output<typeof termChangePayloadSchema>;
export type PositionChangePayload = z.output<typeof positionChangePayloadSchema>;

export type TermChangeIssue = 'term_change_too_early' | 'term_change_reason_unknown';

/** art. 81 ust. 8: the term changes only after more than the minimum elapsed months, for a listed reason. */
export function termChangeIssues(
  regulation: RegulationDocument,
  input: { cycleStart: CalendarDate; changedOn: CalendarDate; reason: string },
): TermChangeIssue[] {
  const issues: TermChangeIssue[] = [];
  const earliest = addMonths(input.cycleStart, regulation.termChange.minimumElapsedMonths);
  if (input.changedOn <= earliest) issues.push('term_change_too_early');
  if (!(regulation.termChange.reasons as readonly string[]).includes(input.reason)) {
    issues.push('term_change_reason_unknown');
  }
  return issues;
}

interface EventLike {
  readonly kind: string;
  readonly payload: Record<string, unknown>;
}

/** The last entry per `absenceId`, in order of first appearance. */
export function latestAbsences(events: readonly EventLike[]): Absence[] {
  const byId = new Map<string, Absence>();
  events.forEach((event, index) => {
    if (event.kind !== 'absence') return;
    const { absenceId, from, to } = event.payload as {
      absenceId?: string;
      from: string;
      to?: string | null;
    };
    byId.set(absenceId ?? `legacy-${String(index)}`, {
      from: calendarDate(from),
      to: to === undefined || to === null ? null : calendarDate(to),
    });
  });
  return [...byId.values()];
}
