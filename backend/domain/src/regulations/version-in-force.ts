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

/**
 * The version in force for an office: like `versionInForce`, but when an office version and an
 * official one start on the same day the office version wins.
 */
export function officeVersionInForce<
  T extends { readonly effectiveFrom: CalendarDate; readonly isOfficial: boolean },
>(versions: readonly T[], on: CalendarDate): T | null {
  let best: T | null = null;
  for (const version of versions) {
    if (version.effectiveFrom > on) continue;
    if (
      best === null ||
      version.effectiveFrom > best.effectiveFrom ||
      (version.effectiveFrom === best.effectiveFrom && best.isOfficial && !version.isOfficial)
    ) {
      best = version;
    }
  }
  return best;
}
