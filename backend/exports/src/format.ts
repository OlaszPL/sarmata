/** Display helpers shared by the PDF, DOCX and CSV adapters. Dates in documents are `dd.mm.rrrr`. */

const WARSAW = 'Europe/Warsaw';

/** `2026-06-15` to `15.06.2026`. Empty text for a missing date. */
export function formatDate(date: string | null | undefined): string {
  if (date === null || date === undefined || date === '') return '';
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day ?? ''}.${month ?? ''}.${year ?? ''}`;
}

/** An ISO instant as `dd.mm.rrrr hh:mm` in the Warsaw time zone. */
export function formatDateTime(instant: string): string {
  const parts = new Intl.DateTimeFormat('pl-PL', {
    timeZone: WARSAW,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('day')}.${part('month')}.${part('year')} ${part('hour')}:${part('minute')}`;
}

/** The arithmetic mean with a decimal comma and at most two decimals (6,75). */
export function formatMean(mean: number): string {
  return String(Math.round(mean * 100) / 100).replace('.', ',');
}

/** Polish plural of "punkt" for the band ranges (1 punktu, 2 punktów). */
export const pointsWord = (points: number): string => (points === 1 ? 'punktu' : 'punktów');

/** `Kowalska-Zofia` style fragment of a file name. Keeps Polish letters, drops what a file system rejects. */
export function fileNamePart(text: string): string {
  return text
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
