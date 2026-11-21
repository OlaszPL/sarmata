import { type CalendarDate } from '../deadlines/calendar-date';

/**
 * The version in force on a day: the latest one whose `effectiveFrom` is not after it.
 * An evaluation pins the version in force on the day it starts (GLOSSARY.md, Wersja przepisów).
 */
export function versionInForce<T extends { readonly effectiveFrom: CalendarDate }>(
  versions: readonly T[],
  on: CalendarDate,
): T | null {
  let best: T | null = null;
  for (const version of versions) {
    if (
      version.effectiveFrom <= on &&
      (best === null || version.effectiveFrom > best.effectiveFrom)
    ) {
      best = version;
    }
  }
  return best;
}
