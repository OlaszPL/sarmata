import {
  type CalendarDate,
  type EvaluationEvent,
  type EvaluationStatus,
  type EvaluationView,
  type ObjectionOutcome,
  type TermChangeReason,
  calendarDate,
} from '@sarmata/services';
import { eventLabel } from '@/lib/evaluations/event-labels';
import { daysUntil, formatDate } from '@/lib/format';

export type EventPanel =
  | 'acquaintance'
  | 'closing'
  | 'objectionFiling'
  | 'objectionDecision'
  | 'interruption'
  | 'sideEvents'
  | 'evaluatorChange'
  | 'correction';

export interface PanelInput {
  status: EvaluationStatus;
  sheetState: string;
  canWrite: boolean;
  isHr: boolean;
  isAdmin: boolean;
}

/** Every status except the two final ones. */
export const OPEN_STATUSES: ReadonlySet<EvaluationStatus> = new Set<EvaluationStatus>([
  'criteria',
  'criteria_awaiting_signature',
  'period',
  'interview',
  'drafted',
  'delivered',
  'objection',
]);

/** The forms a person may see on the events tab. SQL enforces the same rules. */
export function eventPanels(input: PanelInput): ReadonlySet<EventPanel> {
  const { status, sheetState, canWrite, isHr, isAdmin } = input;
  const open = OPEN_STATUSES.has(status);
  const writer = canWrite || isHr;
  const panels = new Set<EventPanel>();
  if (status === 'drafted' && writer) panels.add('acquaintance');
  if (status === 'delivered' && writer) panels.add('closing');
  if (status === 'delivered' && isHr) panels.add('objectionFiling');
  if (status === 'objection' && isHr) panels.add('objectionDecision');
  if (open && isHr) panels.add('interruption');
  if (open && writer) panels.add('sideEvents');
  if (open && isHr) panels.add('evaluatorChange');
  if (isAdmin && sheetState === 'locked') panels.add('correction');
  return panels;
}

export const termChangeReasonLabels: Record<TermChangeReason, string> = {
  evaluatorChange: 'Zmiana osoby oceniającej',
  expectedAbsenceOfEvaluated: 'Przewidywana nieobecność osoby ocenianej',
  expectedAbsenceOfEvaluator: 'Przewidywana nieobecność osoby oceniającej',
  requestOfEvaluated: 'Wniosek osoby ocenianej',
};

export const objectionOutcomeLabels: Record<ObjectionOutcome, string> = {
  rejected: 'Sprzeciw nieuwzględniony',
  changed: 'Zmiana oceny',
  redraft: 'Ponowne sporządzenie oceny',
};

export type SavedKey =
  | 'acquaintance'
  | 'closing'
  | 'objection'
  | 'decision'
  | 'interruption'
  | 'absence'
  | 'return'
  | 'term'
  | 'position'
  | 'evaluator'
  | 'correction';

export const savedMessages: Record<SavedKey, string> = {
  acquaintance: 'Odnotowano zapoznanie z oceną.',
  closing: 'Ocena została zamknięta.',
  objection: 'Odnotowano wniesienie sprzeciwu.',
  decision: 'Zapisano wynik rozpatrzenia sprzeciwu.',
  interruption: 'Ocena została przerwana.',
  absence: 'Zapisano nieobecność.',
  return: 'Zapisano powrót z nieobecności.',
  term: 'Zapisano zmianę terminu. Pobierz zawiadomienie z tabeli zdarzeń bocznych.',
  position: 'Zapisano zmianę stanowiska.',
  evaluator: 'Zmieniono osobę oceniającą.',
  correction: 'Arkusz został skorygowany.',
};

/** The `saved` query value as a known key, anything else is ignored. */
export function savedKeyOf(value: string | string[] | undefined): SavedKey | null {
  if (typeof value !== 'string') return null;
  return Object.hasOwn(savedMessages, value) ? (value as SavedKey) : null;
}

export interface AbsenceEntry {
  absenceId: string;
  from: CalendarDate;
  to: CalendarDate | null;
}

interface AbsencePayload {
  absenceId?: string;
  from: string;
  to?: string | null;
}

/** The last entry per `absenceId`, in order of first appearance. Entries without an id are kept apart. */
export function absencesOf(events: readonly EvaluationEvent[]): AbsenceEntry[] {
  const byId = new Map<string, AbsenceEntry>();
  events.forEach((event, index) => {
    if (event.kind !== 'absence') return;
    const payload = event.payload as unknown as AbsencePayload;
    const absenceId = payload.absenceId ?? `legacy-${String(index)}`;
    byId.set(absenceId, {
      absenceId,
      from: calendarDate(payload.from),
      to: payload.to === undefined || payload.to === null ? null : calendarDate(payload.to),
    });
  });
  return [...byId.values()];
}

export interface SideEventRow {
  id: string;
  label: string;
  occurredOn: string;
  details: string;
  noticeEventId: string | null;
}

const SIDE_KINDS: ReadonlySet<string> = new Set([
  'absence',
  'term_changed',
  'position_changed',
  'evaluator_changed',
  'correction',
  'objection_outcome',
  'interrupted',
]);

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function dateText(value: unknown): string {
  return typeof value === 'string' && value !== '' ? formatDate(calendarDate(value)) : '';
}

function detailsOf(
  event: EvaluationEvent,
  names: { reason: (r: string) => string; account: (id: string) => string },
): string {
  const p = event.payload;
  switch (event.kind) {
    case 'absence': {
      const to = dateText(p.to);
      return to === '' ? `od ${dateText(p.from)}, trwa` : `od ${dateText(p.from)} do ${to}`;
    }
    case 'term_changed':
      return `Nowy termin ${dateText(p.newDueOn)}, ${names.reason(text(p.reason))}`;
    case 'position_changed': {
      const significance =
        p.significant === true ? 'istotna zmiana obowiązków' : 'bez istotnej zmiany obowiązków';
      return [text(p.positionTitle), text(p.orgUnit), significance]
        .filter((part) => part !== '')
        .join(', ');
    }
    case 'evaluator_changed': {
      const who = names.account(text(p.to));
      const reason = text(p.reason);
      return reason === '' ? who : `${who}, ${reason}`;
    }
    case 'objection_outcome': {
      const outcome = text(p.outcome);
      return Object.hasOwn(objectionOutcomeLabels, outcome)
        ? objectionOutcomeLabels[outcome as ObjectionOutcome]
        : outcome;
    }
    default:
      return text(p.reason);
  }
}

/** Rows of the side events table in journal order, one row per absence (its last entry). */
export function sideEventRows(
  view: EvaluationView,
  names: { reason: (r: string) => string; account: (id: string) => string },
): SideEventRow[] {
  const lastAbsence = new Map<string, string>();
  view.events.forEach((event, index) => {
    if (event.kind !== 'absence') return;
    const id = text(event.payload.absenceId) || `legacy-${String(index)}`;
    lastAbsence.set(id, event.id);
  });
  const rows: SideEventRow[] = [];
  for (const [index, event] of view.events.entries()) {
    if (!SIDE_KINDS.has(event.kind)) continue;
    if (event.kind === 'absence') {
      const id = text(event.payload.absenceId) || `legacy-${String(index)}`;
      if (lastAbsence.get(id) !== event.id) continue;
    }
    rows.push({
      id: event.id,
      label: eventLabel(event.kind),
      occurredOn: formatDate(event.occurredOn),
      details: detailsOf(event, names),
      noticeEventId: event.kind === 'term_changed' ? event.id : null,
    });
  }
  return rows;
}

export interface ObjectionWindow {
  dueOn: CalendarDate;
  daysLeft: number;
  open: boolean;
}

/** The objection deadline slot against today, null when the evaluation has none. */
export function objectionWindow(view: EvaluationView, today: CalendarDate): ObjectionWindow | null {
  const slot = view.deadlines.find((deadline) => deadline.slot === 'objection');
  if (slot === undefined || slot.dueOn === null) return null;
  const daysLeft = daysUntil(today, slot.dueOn);
  return { dueOn: slot.dueOn, daysLeft, open: daysLeft >= 0 };
}
