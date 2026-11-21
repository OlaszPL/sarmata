import { type CalendarDate, calendarDate } from '@sarmata/services';

const TIME_ZONE = 'Europe/Warsaw';
const MS_PER_DAY = 86_400_000;

const isoParts = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const longParts = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function todayInWarsaw(now: Date = new Date()): CalendarDate {
  return calendarDate(isoParts.format(now));
}

function toUtcMs(d: CalendarDate): number {
  const [year, month, day] = d.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

export function daysUntil(from: CalendarDate, to: CalendarDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function formatDate(d: CalendarDate): string {
  const [year, month, day] = d.split('-');
  return `${day}.${month}.${year}`;
}

/** `dd.mm` within the year of `today`, the full `dd.mm.rrrr` for any other year. */
export function formatShortDate(d: CalendarDate, today: CalendarDate): string {
  const [year, month, day] = d.split('-');
  return year === today.slice(0, 4) ? `${day}.${month}` : `${day}.${month}.${year}`;
}

/** Polish plural: returns the form only, the caller adds the number. */
export function pluralPl(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const lastTwo = n % 100;
  const last = n % 10;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

export function relativeDays(days: number): string {
  if (days === 0) return 'dziś';
  if (days === 1) return 'jutro';
  if (days > 1) return `za ${days} dni`;
  const late = -days;
  return `${late} ${pluralPl(late, 'dzień', 'dni', 'dni')} po terminie`;
}

export function longDate(d: CalendarDate): string {
  const text = longParts.format(new Date(toUtcMs(d)));
  return text.charAt(0).toUpperCase() + text.slice(1);
}
