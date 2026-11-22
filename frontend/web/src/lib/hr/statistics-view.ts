import type { EvaluatorFlag } from '@sarmata/services';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const YEARS_BACK = 5;

export function parseYear(value: string | string[] | undefined, fallback: number): number {
  if (typeof value !== 'string' || !/^\d{4}$/.test(value)) return fallback;
  const year = Number(value);
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : fallback;
}

export function yearOptions(current: number): number[] {
  return Array.from({ length: YEARS_BACK + 1 }, (_, i) => current - i);
}

const oneDecimal = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** `0.43` is `43%`, a fraction of a percent keeps one decimal: `0,4%`. */
export function formatShare(share: number): string {
  return `${oneDecimal.format(Math.round(share * 1000) / 10)}%`;
}

/** Percentage points with an explicit sign, `Brak` when the benchmark is missing. */
export function formatPoints(points: number | null): string {
  if (points === null) return 'Brak';
  const rounded = Math.round(points * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '';
  return `${sign}${oneDecimal.format(Math.abs(rounded))} p.p.`;
}

export const evaluatorFlagLabels: Record<EvaluatorFlag, string> = {
  central_tendency: 'Tendencja centralna',
  lenient: 'Łagodne oceny',
  strict: 'Surowe oceny',
};
