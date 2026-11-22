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

/**
 * The version a report of a past day is built on: the one in force on `on`, or the earliest version
 * when `on` is before all of them (such a report is empty but keeps the level names).
 * `null` only for an empty list.
 */
export function versionForReportDay<
  T extends { readonly effectiveFrom: CalendarDate; readonly isOfficial: boolean },
>(versions: readonly T[], on: CalendarDate): T | null {
  const inForce = officeVersionInForce(versions, on);
  if (inForce !== null) return inForce;
  let earliest: T | null = null;
  for (const version of versions) {
    if (earliest === null || version.effectiveFrom < earliest.effectiveFrom) earliest = version;
  }
  return earliest;
}
