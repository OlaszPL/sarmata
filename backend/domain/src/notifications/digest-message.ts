import type { CalendarDate } from '../deadlines/calendar-date';

/**
 * Facts the digest e-mail may carry. There is deliberately no field for a name or the content of an
 * evaluation, so the message cannot leak personal data.
 */
export interface DigestInput {
  readonly count: number;
  /** Nearest deadline that is not over yet. Null when every open task is overdue. */
  readonly nearestDueOn: CalendarDate | null;
  readonly link: string;
}

export interface DigestMessage {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

function taskNoun(count: number): string {
  if (count === 1) return 'zadanie';
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return 'zadania';
  return 'zadań';
}

const dayAndMonth = (date: CalendarDate): string => `${date.slice(8, 10)}.${date.slice(5, 7)}`;

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** The one e-mail an account gets per day: how many tasks wait, the nearest date and a link to the inbox. */
export function digestMessage(input: DigestInput): DigestMessage {
  const when =
    input.nearestDueOn === null
      ? 'wszystkie po terminie'
      : `najbliższy termin ${dayAndMonth(input.nearestDueOn)}`;
  const line = `Masz ${input.count} ${taskNoun(input.count)}, ${when}.`;
  const link = escapeHtml(input.link);
  return {
    subject: 'Sarmata: zadania do wykonania',
    text: `${line}\n\n${input.link}`,
    html: `<p>${line}</p><p><a href="${link}">${link}</a></p>`,
  };
}
