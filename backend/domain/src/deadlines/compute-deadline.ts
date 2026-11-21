import { type Absence, lastsLongerThanMonth, mergeAbsences } from './absences';
import { addMonths } from './add-months';
import { addDays, daysInclusive } from './calendar';
import { type CalendarDate } from './calendar-date';
import { type DeadlineRule } from './deadline-rule';
import { nextWorkingDayOnOrAfter } from './working-days';

export interface DeadlineFacts {
  /** Date of the event named by `rule.event`. */
  readonly eventDate: CalendarDate;
  /** Justified absences of the evaluated person in the current cycle. Only some strategies use them. */
  readonly absences?: readonly Absence[];
}

export type DeadlineResult =
  | {
      readonly kind: 'due';
      /** First day of a window (e.g. § 9 ust. 2), null for a plain deadline. */
      readonly windowStart: CalendarDate | null;
      /** End of term before the art. 115 Kc shift, after any extension. */
      readonly nominalDue: CalendarDate;
      /** Last day to act. */
      readonly due: CalendarDate;
      /** Calendar days added for absences longer than a month (art. 81 ust. 7). */
      readonly extendedByDays: number;
    }
  | {
      /** An absence without an end date started before the deadline: the deadline waits for the return. */
      readonly kind: 'suspended';
      readonly since: CalendarDate;
    };

type Strategy<S extends DeadlineRule['strategy']> = (
  rule: Extract<DeadlineRule, { strategy: S }>,
  facts: DeadlineFacts,
) => DeadlineResult;

function due(
  rule: DeadlineRule,
  windowStart: CalendarDate | null,
  nominalDue: CalendarDate,
  extendedByDays: number,
): DeadlineResult {
  return {
    kind: 'due',
    windowStart,
    nominalDue,
    due: rule.shiftToWorkingDay ? nextWorkingDayOnOrAfter(nominalDue) : nominalDue,
    extendedByDays,
  };
}

type Extension =
  | { readonly kind: 'extended'; readonly end: CalendarDate; readonly days: number }
  | { readonly kind: 'suspended'; readonly since: CalendarDate };

function extendByAbsences(
  eventDate: CalendarDate,
  end: CalendarDate,
  absences: readonly Absence[],
): Extension {
  let current = end;
  let days = 0;
  for (const period of mergeAbsences(absences)) {
    if (period.to !== null && period.to < eventDate) continue;
    const from = period.from < eventDate ? eventDate : period.from;
    if (from > current) break;
    if (period.to === null) return { kind: 'suspended', since: from };
    if (!lastsLongerThanMonth(from, period.to)) continue;
    const length = daysInclusive(from, period.to);
    current = addDays(current, length);
    days += length;
  }
  return { kind: 'extended', end: current, days };
}

/** Registry of named deadline strategies. A new strategy needs a schema variant and an entry here. */
const strategies: { [S in DeadlineRule['strategy']]: Strategy<S> } = {
  monthsFromEvent: (rule, facts) => {
    const end = addMonths(facts.eventDate, rule.months);
    if (!rule.extendByAbsencesLongerThanMonth) return due(rule, null, end, 0);
    const extension = extendByAbsences(facts.eventDate, end, facts.absences ?? []);
    if (extension.kind === 'suspended') return extension;
    return due(rule, null, extension.end, extension.days);
  },
  daysFromEvent: (rule, facts) => due(rule, null, addDays(facts.eventDate, rule.days), 0),
  windowAroundEvent: (rule, facts) =>
    due(
      rule,
      addDays(facts.eventDate, -rule.daysBefore),
      addDays(facts.eventDate, rule.daysAfter),
      0,
    ),
};

/** Computes a deadline of one slot of a regulation version from the facts of one evaluation. */
export function computeDeadline(rule: DeadlineRule, facts: DeadlineFacts): DeadlineResult {
  const strategy = strategies[rule.strategy] as (
    rule: DeadlineRule,
    facts: DeadlineFacts,
  ) => DeadlineResult;
  return strategy(rule, facts);
}
