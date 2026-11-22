import type { CalendarDate, DeadlineSlot, InboxItem } from '@sarmata/services';
import { daysUntil, formatDate, relativeDays } from '@/lib/format';
import { routes } from '@/lib/routes';

export type InboxGroup = 'unread' | 'read' | 'resolved';

export interface InboxEntry {
  id: string;
  group: InboxGroup;
  employeeName: string;
  /** What to do, e.g. "Sporządzenie oceny". */
  title: string;
  /** One sentence about the deadline. */
  summary: string;
  kindLabel: 'Przypomnienie' | 'Zadanie';
  /** `dd.mm.rrrr`. */
  dueOn: string;
  /** Relative days, "załatwione" for a resolved entry. */
  dueText: string;
  /** Open and past due. */
  overdue: boolean;
  /** Case tab that holds the action. */
  href: string;
}

export interface InboxView {
  /** Service order kept inside each group. */
  groups: Record<InboxGroup, InboxEntry[]>;
  unread: number;
  openTasks: number;
  resolved: number;
}

/** Shown when RLS hides the employee, for example after a change of evaluator. */
const NO_ACCESS_NAME = 'Pracownik bez dostępu';

const slotLabels: Record<DeadlineSlot, string> = {
  startingInterview: 'Rozmowa rozpoczynająca',
  startingInterviewAfterNegative: 'Rozmowa rozpoczynająca po ocenie negatywnej',
  evaluationDeadline: 'Sporządzenie oceny',
  reevaluationAfterNegative: 'Ponowna ocena po ocenie negatywnej',
  criteriaResetAfterPositionChange: 'Nowe kryteria po zmianie stanowiska',
  evaluationOnPositionChange: 'Ocena przy zmianie stanowiska',
  objection: 'Termin na sprzeciw',
  objectionDecision: 'Rozpatrzenie sprzeciwu',
  labourCourtAppeal: 'Odwołanie do sądu pracy',
  gradeByLawGrant: 'Przyznanie stopnia z mocy prawa',
};

function hrefFor(slot: DeadlineSlot, evaluationId: string): string {
  switch (slot) {
    case 'startingInterview':
    case 'startingInterviewAfterNegative':
    case 'criteriaResetAfterPositionChange':
      return routes.evaluationPart1(evaluationId);
    case 'objection':
    case 'objectionDecision':
    case 'labourCourtAppeal':
      return routes.evaluationEvents(evaluationId);
    // No screen records the grant yet, the case overview explains where hr does it.
    case 'gradeByLawGrant':
      return routes.evaluation(evaluationId);
    default:
      return routes.evaluation(evaluationId);
  }
}

function summaryFor(item: InboxItem, due: string): string {
  switch (item.kind) {
    case 'deadline_reminder':
      return item.leadDays === null
        ? `Termin mija ${due}.`
        : `Termin mija ${due}. Przypomnienie ${item.leadDays} ${item.leadDays === 1 ? 'dzień' : 'dni'} przed terminem.`;
    case 'deadline_overdue':
      return `Termin minął ${due}.`;
    case 'objection_decision':
      return `Wpisz rozstrzygnięcie sprzeciwu do ${due}.`;
    case 'grade_by_law':
      return `Przyznaj stopień z mocy prawa w rejestrze kadr do ${due}.`;
  }
}

function groupOf(item: InboxItem): InboxGroup {
  if (item.status === 'resolved') return 'resolved';
  return item.readAt === null ? 'unread' : 'read';
}

function entryOf(item: InboxItem, today: CalendarDate): InboxEntry {
  const group = groupOf(item);
  const due = formatDate(item.dueOn);
  const days = daysUntil(today, item.dueOn);
  return {
    id: item.id,
    group,
    employeeName: item.employeeName.trim() === '' ? NO_ACCESS_NAME : item.employeeName,
    title: slotLabels[item.slot],
    summary: summaryFor(item, due),
    kindLabel: item.kind === 'deadline_reminder' ? 'Przypomnienie' : 'Zadanie',
    dueOn: due,
    dueText: group === 'resolved' ? 'załatwione' : relativeDays(days),
    overdue: group !== 'resolved' && days < 0,
    href: hrefFor(item.slot, item.evaluationId),
  };
}

/** Splits the inbox into unread, read and resolved entries and counts them for the page hero. */
export function inboxView(items: readonly InboxItem[], today: CalendarDate): InboxView {
  const groups: Record<InboxGroup, InboxEntry[]> = { unread: [], read: [], resolved: [] };
  let openTasks = 0;
  for (const item of items) {
    const entry = entryOf(item, today);
    groups[entry.group].push(entry);
    if (item.status === 'open' && item.kind !== 'deadline_reminder') openTasks += 1;
  }
  return {
    groups,
    unread: groups.unread.length,
    openTasks,
    resolved: groups.resolved.length,
  };
}
