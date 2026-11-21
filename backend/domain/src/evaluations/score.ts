import type { RegulationDocument } from '../regulations/regulation-document';

export interface SheetScore {
  complete: boolean;
  mean: number | null;
  levelCode: string | null;
  outcome: 'positive' | 'negative' | null;
}

const incomplete: SheetScore = { complete: false, mean: null, levelCode: null, outcome: null };

/**
 * Overall level and outcome of a sheet (§ 11 ust. 1 rozporządzenia). The mean is not rounded.
 * Throws `RangeError` for points outside the partial scale.
 */
export function scoreSheet(
  regulation: RegulationDocument,
  criteria: readonly string[],
  ratings: Readonly<Record<string, number>>,
): SheetScore {
  const levels = regulation.partialScale.levels;
  const allowed = new Set(levels.map((level) => level.points));
  for (const [criterion, points] of Object.entries(ratings)) {
    if (!allowed.has(points))
      throw new RangeError(`Points ${points} outside scale for ${criterion}`);
  }
  const given = criteria.map((id) => ratings[id]);
  const points = given.filter((value): value is number => value !== undefined);
  if (criteria.length === 0 || points.length !== criteria.length) return incomplete;

  const mean = points.reduce((sum, value) => sum + value, 0) / points.length;
  const band = regulation.overallLevel.bands.find(
    (candidate) =>
      (mean > candidate.min || (candidate.minInclusive && mean === candidate.min)) &&
      mean <= candidate.max,
  );
  if (!band) throw new RangeError(`Mean ${mean} outside all bands`);
  const negativePoints = levels.find(
    (level) => level.code === regulation.outcome.negativeIfAnyPartialIs,
  )?.points;
  const negative =
    !regulation.outcome.positiveLevels.includes(band.code) ||
    points.some((value) => value === negativePoints);
  return {
    complete: true,
    mean,
    levelCode: band.code,
    outcome: negative ? 'negative' : 'positive',
  };
}
