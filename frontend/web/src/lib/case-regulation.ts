import { type EvaluationView, type RegulationDocument } from '@sarmata/services';

export interface CaseCriterion {
  id: string;
  name: string;
  /** Behaviour indicators ("Wskaźniki zachowań") of the criterion. */
  indicators: string[];
  /** Fixed by the sheet. The other criteria are the additional ones chosen in part I. */
  mandatory: boolean;
}

export interface CaseScaleLevel {
  /** Points of the partial scale, e.g. 7. */
  value: number;
  /** Short label of a rating tile, e.g. "Powyżej". */
  label: string;
  /** Full name from the regulation, e.g. "powyżej oczekiwań". */
  name: string;
}

export interface CaseBand {
  code: string;
  /** Range as shown in "Jak liczony jest wynik", e.g. "6 do 8". */
  label: string;
  /** Name of the overall level, e.g. "powyżej oczekiwań". */
  name: string;
  min: number;
  max: number;
  minInclusive: boolean;
}

/**
 * The regulation as a case screen needs it. `criteria`, `scale` and `catalog` are the plan's
 * contract, the other fields are there so no stream has to read `RegulationDocument` itself.
 */
export interface CaseRegulation {
  /** Criteria of this case in rating order: mandatory ones first, then the chosen additional ones. */
  criteria: CaseCriterion[];
  scale: CaseScaleLevel[];
  /** Whole catalog, the source of additional criteria in part I. */
  catalog: { id: string; name: string }[];
  /** Regulation document id, e.g. `regulation-2016`. */
  id: string;
  name: string;
  /** Mandatory criteria of the sheet of this case. */
  mandatoryIds: string[];
  /** Limits of additional criteria and whether a mandatory one may be repeated. */
  additionalMin: number;
  additionalMax: number;
  /** Bands of the overall level (arithmetic mean of the partial ratings). */
  bands: CaseBand[];
  /** Points of the partial rating that makes the whole evaluation negative, e.g. 1. */
  negativePoints: number | null;
  /** Whether a negative evaluation needs a justification. */
  justificationRequiredForNegative: boolean;
}

const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "znacznie poniżej oczekiwań" becomes the tile label "Znacznie poniżej". */
function tileLabel(name: string): string {
  return capitalize(name.replace(/\s+oczekiwań$/u, ''));
}

function bandLabel(band: { min: number; max: number }, index: number, count: number): string {
  if (index === 0) return `do ${number.format(band.max)}`;
  if (index === count - 1) return `ponad ${number.format(band.min)}`;
  return `${number.format(band.min)} do ${number.format(band.max)}`;
}

/** Pure part of `regulationForEvaluation`: the regulation document cut to one case. */
export function caseRegulationOf(
  document: RegulationDocument,
  view: EvaluationView,
): CaseRegulation {
  const sheet = document.sheets.find((candidate) => candidate.id === view.sheetId);
  const mandatoryIds = sheet ? [...sheet.mandatoryCriteria] : [];
  const byId = new Map(document.criteria.catalog.map((criterion) => [criterion.id, criterion]));
  const levelNames = new Map(document.partialScale.levels.map((level) => [level.code, level.name]));
  const { bands } = document.overallLevel;
  const negative = document.partialScale.levels.find(
    (level) => level.code === document.outcome.negativeIfAnyPartialIs,
  );

  return {
    criteria: view.criteria.map((id) => {
      const criterion = byId.get(id);
      return {
        id,
        name: criterion?.name ?? id,
        indicators: criterion ? [...criterion.indicators] : [],
        mandatory: mandatoryIds.includes(id),
      };
    }),
    scale: document.partialScale.levels.map((level) => ({
      value: level.points,
      label: tileLabel(level.name),
      name: level.name,
    })),
    catalog: document.criteria.catalog.map(({ id, name }) => ({ id, name })),
    id: document.id,
    name: document.name,
    mandatoryIds,
    additionalMin: document.additionalCriteria.min,
    additionalMax: document.additionalCriteria.max,
    bands: bands.map((band, index) => ({
      code: band.code,
      label: bandLabel(band, index, bands.length),
      name: levelNames.get(band.code) ?? band.code,
      min: band.min,
      max: band.max,
      minInclusive: band.minInclusive,
    })),
    negativePoints: negative?.points ?? null,
    justificationRequiredForNegative: document.justification.requiredForNegative,
  };
}

/** Name of an overall level code (`view.score.levelCode`), e.g. "powyżej oczekiwań". */
export function levelName(regulation: CaseRegulation, code: string | null): string | null {
  if (code === null) return null;
  return regulation.bands.find((band) => band.code === code)?.name ?? null;
}

/** Name of a criterion of the catalog, the id when it is unknown. */
export function criterionName(regulation: CaseRegulation, id: string): string {
  return regulation.catalog.find((criterion) => criterion.id === id)?.name ?? id;
}
