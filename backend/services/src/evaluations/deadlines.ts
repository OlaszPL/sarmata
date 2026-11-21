import {
  type Absence,
  addMonths,
  latestAbsences,
  positionChangePayloadSchema,
  termChangePayloadSchema,
  type CalendarDate,
  type DeadlineSlot,
  type RegulationDocument,
  calendarDate,
  computeDeadline,
  effectiveDueOn,
} from '@sarmata/domain';
import {
  type EvaluationDetail,
  type EvaluationEvent,
  type StoredDeadline,
} from '@sarmata/repositories';
import { ServiceError } from '../errors';

function slot(
  regulation: RegulationDocument,
  name: DeadlineSlot,
  eventDate: CalendarDate,
  absences: readonly Absence[],
  chosenDueOn: CalendarDate | null = null,
): StoredDeadline {
  const rule = regulation.deadlines[name];
  if (rule === undefined) {
    throw new ServiceError(
      'missing_deadline_slot',
      `Regulation version ${regulation.id} has no ${name} deadline`,
    );
  }
  const result = computeDeadline(rule, { eventDate, absences });
  if (result.kind === 'suspended') {
    return { slot: name, windowStart: null, dueOn: null, suspendedSince: result.since };
  }
  return {
    slot: name,
    windowStart: result.windowStart,
    dueOn: effectiveDueOn(result.due, chosenDueOn),
    suspendedSince: null,
  };
}

const lastEventDate = (
  events: readonly EvaluationEvent[],
  kinds: readonly EvaluationEvent['kind'][],
): CalendarDate | null =>
  events.filter((event) => kinds.includes(event.kind)).at(-1)?.occurredOn ?? null;

/**
 * The grade by law (art. 89 ust. 2) signal as a stored deadline. The signal itself lives only in the
 * view, so without this slot the notification collector would not see the hr task.
 */
export function gradeByLawSlot(signal: { readonly dueOn: CalendarDate } | null): StoredDeadline[] {
  if (signal === null) return [];
  return [
    { slot: 'gradeByLawGrant', windowStart: null, dueOn: signal.dueOn, suspendedSince: null },
  ];
}

/**
 * The deadline slots that apply to the evaluation in its current status. Slots not returned are
 * cleared by the repository. Pure: absences are read from the `absence` events.
 */
export function computeEvaluationDeadlines(
  detail: EvaluationDetail,
  regulation: RegulationDocument,
): StoredDeadline[] {
  const absences = latestAbsences(detail.events);
  const { status, cycleStart, afterNegative } = detail;
  const slots: StoredDeadline[] = [];

  if (status === 'criteria') {
    slots.push(
      slot(
        regulation,
        afterNegative ? 'startingInterviewAfterNegative' : 'startingInterview',
        cycleStart,
        absences,
      ),
    );
  }
  if (
    status === 'criteria' ||
    status === 'criteria_awaiting_signature' ||
    status === 'period' ||
    status === 'interview'
  ) {
    if (afterNegative) {
      const created = detail.events.find((event) => event.kind === 'created');
      const acquainted = created?.payload.previousAcquaintedOn;
      const eventDate = typeof acquainted === 'string' ? calendarDate(acquainted) : cycleStart;
      slots.push(slot(regulation, 'reevaluationAfterNegative', eventDate, absences));
    } else {
      const base = slot(
        regulation,
        'evaluationDeadline',
        cycleStart,
        absences,
        detail.sheet.content.partOne.dueOn,
      );
      const termChange = detail.events.filter((event) => event.kind === 'term_changed').at(-1);
      slots.push(
        termChange === undefined
          ? base
          : {
              ...base,
              dueOn: termChangePayloadSchema.parse(termChange.payload).newDueOn,
              suspendedSince: null,
            },
      );
    }
  }
  if (status === 'delivered') {
    const acquaintedOn = lastEventDate(detail.events, ['acquainted', 'signature_refused']);
    if (acquaintedOn !== null) slots.push(slot(regulation, 'objection', acquaintedOn, absences));
  }
  const positionChange = detail.events.filter((event) => event.kind === 'position_changed').at(-1);
  if (positionChange !== undefined) {
    const { changedOn, significant } = positionChangePayloadSchema.parse(positionChange.payload);
    if (significant) {
      // Rozporządzenie § 9 ust. 1 and ustawa art. 81 ust. 6: within 6 months the criteria are
      // reset (term unchanged), after more than 6 months the evaluation is drawn up.
      const slotName =
        changedOn > addMonths(cycleStart, 6)
          ? 'evaluationOnPositionChange'
          : 'criteriaResetAfterPositionChange';
      slots.push(slot(regulation, slotName, changedOn, absences));
    }
  }
  if (status === 'objection') {
    const filedOn = lastEventDate(detail.events, ['objection_filed']);
    if (filedOn !== null) slots.push(slot(regulation, 'objectionDecision', filedOn, absences));
  }
  // art. 83 ust. 5: only a rejected objection opens the appeal, and only the latest outcome counts.
  const lastOutcome = detail.events.filter((event) => event.kind === 'objection_outcome').at(-1);
  if (lastOutcome?.payload.outcome === 'rejected') {
    slots.push(slot(regulation, 'labourCourtAppeal', lastOutcome.occurredOn, absences));
  }
  return slots;
}
