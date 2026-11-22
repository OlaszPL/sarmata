// Client components import this file: only types from the services and the UI, never a value import.
import type {
  DeadlineSlot,
  RegulationCheck,
  RegulationVersionDetail,
  RegulationVersionSummary,
} from '@sarmata/services';
import type { TagTone } from '@sarmata/ui';

/** The services do not export these two types, so they come from the detail and the check. */
export type RegulationGraph = RegulationVersionDetail['graph'];
export type CaseResult = RegulationCheck['cases'][number];

export type DeadlineStrategy = 'monthsFromEvent' | 'daysFromEvent' | 'windowAroundEvent';
export type DeadlineEvent =
  'cycleStart' | 'acquaintance' | 'positionChange' | 'objectionFiled' | 'objectionOutcome';

export const slotLabels: Record<DeadlineSlot, string> = {
  startingInterview: 'Rozmowa rozpoczynająca okres oceny',
  startingInterviewAfterNegative: 'Rozmowa rozpoczynająca po ocenie negatywnej',
  evaluationDeadline: 'Termin sporządzenia oceny',
  reevaluationAfterNegative: 'Ponowna ocena po ocenie negatywnej',
  criteriaResetAfterPositionChange: 'Nowe kryteria po zmianie stanowiska',
  evaluationOnPositionChange: 'Ocena przy zmianie stanowiska',
  objection: 'Termin na sprzeciw',
  objectionDecision: 'Rozpatrzenie sprzeciwu',
  labourCourtAppeal: 'Odwołanie do sądu pracy',
  gradeByLawGrant: 'Nadanie stopnia służbowego z mocy prawa',
};

export const strategyLabels: Record<DeadlineStrategy, string> = {
  monthsFromEvent: 'Miesiące od zdarzenia',
  daysFromEvent: 'Dni od zdarzenia',
  windowAroundEvent: 'Okno wokół zdarzenia',
};

export const eventLabels: Record<DeadlineEvent, string> = {
  cycleStart: 'Początek okresu oceny',
  acquaintance: 'Zapoznanie z oceną',
  positionChange: 'Zmiana stanowiska',
  objectionFiled: 'Wniesienie sprzeciwu',
  objectionOutcome: 'Rozstrzygnięcie sprzeciwu',
};

/** Parameter sections of a version, as the regulation graph names them (`param:<section>`). */
export const sectionLabels: Record<string, string> = {
  partialScale: 'Skala ocen cząstkowych',
  overallLevel: 'Poziom oceny',
  outcome: 'Wynik oceny',
  justification: 'Uzasadnienie oceny',
  criteria: 'Katalog kryteriów',
  additionalCriteria: 'Kryteria dodatkowe',
  termChange: 'Zmiana terminu oceny',
  gradeByLaw: 'Stopień służbowy z mocy prawa',
  feedback: 'Informacja zwrotna',
};

export const sheetLabel = (id: string): string => `Arkusz ${id}`;

/** A label of a known key, the key itself for one this frontend does not know yet. */
export function labelOf(labels: Readonly<Record<string, string>>, key: string): string {
  return Object.hasOwn(labels, key) ? (labels[key] ?? key) : key;
}

/** A node of the regulation graph by its id (`slot:objection`, `param:sheet-A`, ...). */
export function graphNodeLabel(id: string): string {
  const separator = id.indexOf(':');
  const kind = id.slice(0, separator);
  const key = id.slice(separator + 1);
  if (kind === 'slot') return labelOf(slotLabels, key);
  if (kind === 'strategy') return labelOf(strategyLabels, key);
  if (kind === 'event') return labelOf(eventLabels, key);
  if (kind === 'param') {
    return key.startsWith('sheet-')
      ? sheetLabel(key.slice('sheet-'.length))
      : labelOf(sectionLabels, key);
  }
  return id;
}

/** The state tag of a version. A version in force gets a separate „Obowiązuje” tag. */
export function versionStatusLabel(
  summary: Pick<RegulationVersionSummary, 'isOfficial' | 'status'>,
): { tone: TagTone; label: string } {
  if (summary.isOfficial) return { tone: 'neutral', label: 'Urzędowa' };
  if (summary.status === 'published') return { tone: 'neutral', label: 'Opublikowana' };
  return { tone: 'progress', label: 'Szkic' };
}

export const inForceLabel: { tone: TagTone; label: string } = { tone: 'done', label: 'Obowiązuje' };
