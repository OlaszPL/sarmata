import { type EvaluationEvent } from '@sarmata/services';
import { eventLabel } from '@/lib/evaluations/event-labels';
import { formatDate } from '@/lib/format';

export interface JournalRow {
  id: string;
  /** dd.mm.rrrr */
  occurredOn: string;
  label: string;
  details: string[];
  recordedBy: string;
  /** dd.mm.rrrr, gg:mm in Europe/Warsaw */
  recordedAt: string;
}

const UNKNOWN_AUTHOR = 'Konto spoza listy pracowników';

const timestamp = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatTimestamp(iso: string): string {
  const parts = Object.fromEntries(
    timestamp.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
}

function detailsOf(payload: Record<string, unknown>): string[] {
  const details: string[] = [];
  if (typeof payload.place === 'string' && payload.place !== '') {
    details.push(`Miejscowość: ${payload.place}`);
  }
  if (Array.isArray(payload.witnesses) && payload.witnesses.length > 0) {
    details.push(`Świadkowie: ${payload.witnesses.map(String).join(', ')}`);
  }
  if (typeof payload.refusalNote === 'string' && payload.refusalNote !== '') {
    details.push(`Adnotacja: ${payload.refusalNote}`);
  }
  return details;
}

/** Journal rows of an evaluation, oldest occurrence first, ties by recording time. */
export function journalRows(
  events: readonly EvaluationEvent[],
  names: ReadonlyMap<string, string>,
): JournalRow[] {
  return [...events]
    .sort(
      (a, b) =>
        a.occurredOn.localeCompare(b.occurredOn) ||
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    )
    .map((event) => ({
      id: event.id,
      occurredOn: formatDate(event.occurredOn),
      label: eventLabel(event.kind),
      details: detailsOf(event.payload),
      recordedBy: names.get(event.recordedBy) ?? UNKNOWN_AUTHOR,
      recordedAt: formatTimestamp(event.recordedAt),
    }));
}
