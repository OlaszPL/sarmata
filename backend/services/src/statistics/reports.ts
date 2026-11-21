import {
  type CalendarDate,
  type EvaluatorFlagThresholds,
  type RegulationDocument,
  calendarDate,
  nationalBenchmark,
} from '@sarmata/domain';
import type {
  CriterionRatingRow,
  DistributionRow,
  DscOckCounts,
  EvaluatorRow,
  ScheduleRow,
} from '@sarmata/repositories';

export interface DscOckAnswer {
  readonly question: number;
  readonly label: string;
  readonly value: number | null;
}

export interface LevelShare {
  readonly code: string;
  readonly name: string;
  readonly count: number;
  readonly share: number;
  /** National share of the level, `null` when the national report gives none for it. */
  readonly nationalShare: number | null;
  /** Office share minus national share, in percentage points. */
  readonly differencePoints: number | null;
}

export interface UnitDistribution {
  readonly orgUnit: string | null;
  readonly total: number;
  readonly levels: Readonly<Record<string, number>>;
}

export interface DevelopmentNeed {
  readonly criterionId: string;
  readonly name: string;
  readonly ratings: number;
  readonly belowExpectations: number;
  readonly share: number;
}

export interface OfficeReport {
  readonly year: number;
  readonly total: number;
  readonly levels: LevelShare[];
  readonly negative: { count: number; share: number; nationalShare: number };
  readonly byUnit: UnitDistribution[];
  readonly developmentConclusionsShare: number;
  readonly developmentNeeds: DevelopmentNeed[];
  readonly dscOck: DscOckAnswer[];
}

export type EvaluatorFlag = 'central_tendency' | 'lenient' | 'strict';

export interface EvaluatorSummary {
  readonly evaluatorAccountId: string;
  readonly evaluatorName: string | null;
  readonly evaluations: number;
  /** Mean of the partial points the evaluator gave, `null` without ratings. */
  readonly mean: number | null;
  /** Share of the evaluator's evaluations at the middle level of the scale. */
  readonly centralShare: number;
  /** Evaluator mean minus office mean, in points. */
  readonly leniency: number | null;
  readonly levels: Readonly<Record<string, number>>;
  readonly flags: EvaluatorFlag[];
}

export interface EvaluatorReport {
  readonly year: number;
  readonly officeMean: number | null;
  readonly thresholds: EvaluatorFlagThresholds;
  readonly evaluators: EvaluatorSummary[];
}

export interface ScheduleItem extends ScheduleRow {
  readonly overdue: boolean;
  readonly withoutInterview: boolean;
  readonly startingInterviewSoon: boolean;
}

export interface ScheduleReport {
  readonly today: CalendarDate;
  readonly horizonDays: number;
  readonly rows: ScheduleItem[];
  readonly summary: {
    readonly inProgress: number;
    readonly overdue: number;
    readonly withoutInterview: number;
    readonly startingInterviews: number;
  };
}

const share = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);
const sum = (rows: readonly DistributionRow[], pick: (row: DistributionRow) => number): number =>
  rows.reduce((total, row) => total + pick(row), 0);

/** Levels from the highest, like the DSC-OCK form lists them. */
function levelsDescending(regulation: RegulationDocument): { code: string; name: string }[] {
  return [...regulation.partialScale.levels]
    .sort((a, b) => b.points - a.points)
    .map(({ code, name }) => ({ code, name }));
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return calendarDate(moved.toISOString().slice(0, 10));
}

export function levelShares(
  regulation: RegulationDocument,
  distribution: readonly DistributionRow[],
): LevelShare[] {
  const total = sum(distribution, (row) => row.evaluations);
  const national: Readonly<Record<string, number>> = nationalBenchmark.levelShares;
  return levelsDescending(regulation).map(({ code, name }) => {
    const count = sum(
      distribution.filter((row) => row.levelCode === code),
      (row) => row.evaluations,
    );
    const levelShare = share(count, total);
    const nationalShare = national[code] ?? null;
    return {
      code,
      name,
      count,
      share: levelShare,
      nationalShare,
      differencePoints: nationalShare === null ? null : (levelShare - nationalShare) * 100,
    };
  });
}

export function unitDistribution(distribution: readonly DistributionRow[]): UnitDistribution[] {
  const units = new Map<string | null, { total: number; levels: Record<string, number> }>();
  for (const row of distribution) {
    const unit = units.get(row.orgUnit) ?? { total: 0, levels: {} };
    unit.total += row.evaluations;
    if (row.levelCode !== null) {
      unit.levels[row.levelCode] = (unit.levels[row.levelCode] ?? 0) + row.evaluations;
    }
    units.set(row.orgUnit, unit);
  }
  return [...units.entries()]
    .map(([orgUnit, unit]) => ({ orgUnit, ...unit }))
    .sort((a, b) => {
      if (a.orgUnit === null) return b.orgUnit === null ? 0 : 1;
      if (b.orgUnit === null) return -1;
      return a.orgUnit.localeCompare(b.orgUnit, 'pl');
    });
}

/** Partial ratings that do not reach the expectations: the levels outside `outcome.positiveLevels`. */
export function developmentNeeds(
  regulation: RegulationDocument,
  criteria: readonly CriterionRatingRow[],
): DevelopmentNeed[] {
  const positive = new Set(regulation.outcome.positiveLevels);
  const belowPoints = new Set(
    regulation.partialScale.levels
      .filter((level) => !positive.has(level.code))
      .map((level) => level.points),
  );
  const names = new Map(regulation.criteria.catalog.map((item) => [item.id, item.name]));
  const perCriterion = new Map<string, { ratings: number; below: number }>();
  for (const row of criteria) {
    const entry = perCriterion.get(row.criterionId) ?? { ratings: 0, below: 0 };
    entry.ratings += row.ratings;
    if (belowPoints.has(row.points)) entry.below += row.ratings;
    perCriterion.set(row.criterionId, entry);
  }
  return [...perCriterion.entries()]
    .map(([criterionId, entry]) => ({
      criterionId,
      name: names.get(criterionId) ?? criterionId,
      ratings: entry.ratings,
      belowExpectations: entry.below,
      share: share(entry.below, entry.ratings),
    }))
    .sort((a, b) => b.share - a.share || a.criterionId.localeCompare(b.criterionId));
}

/** Answers to questions 4 to 17 of section 1 of the DSC-OCK form (questions 1 to 3 are out of scope). */
export function dscOckAnswers(
  regulation: RegulationDocument,
  distribution: readonly DistributionRow[],
  counts: DscOckCounts,
): DscOckAnswer[] {
  const levels = levelsDescending(regulation);
  const civil = distribution.filter((row) => row.civilServant);
  const levelRows = (question: number, rows: readonly DistributionRow[], prefix: string) => [
    ...levels.map(({ code, name }) => ({
      question,
      label: `${prefix}, ${name}`,
      value: sum(
        rows.filter((row) => row.levelCode === code),
        (row) => row.evaluations,
      ),
    })),
    {
      question,
      label: `${prefix}, ogółem`,
      value: sum(rows, (row) => row.evaluations),
    },
  ];
  const objections = counts.objectionsUpheld + counts.objectionsRejected + counts.objectionsPending;
  return [
    {
      question: 4,
      label: 'Pracownicy na czas nieokreślony (stan na 31 grudnia)',
      value: counts.indefiniteEmployees,
    },
    {
      question: 5,
      label: 'Urzędnicy służby cywilnej zatrudnieni na podstawie mianowania (stan na 31 grudnia)',
      value: counts.civilServants,
    },
    ...levelRows(6, distribution, 'Oceny okresowe według poziomów'),
    ...levelRows(7, civil, 'Oceny okresowe urzędników według poziomów'),
    {
      question: 8,
      label: 'Oceny negatywne',
      value: sum(distribution, (row) => row.negative),
    },
    {
      question: 9,
      label: 'Oceny negatywne urzędników',
      value: sum(civil, (row) => row.negative),
    },
    {
      question: 10,
      label: 'Drugie kolejne oceny negatywne',
      value: sum(distribution, (row) => row.secondNegative),
    },
    {
      question: 11,
      label: 'Drugie kolejne oceny negatywne urzędników',
      value: sum(civil, (row) => row.secondNegative),
    },
    { question: 12, label: 'Sprzeciwy od ocen sporządzonych w roku', value: objections },
    { question: 13, label: 'Sprzeciwy uwzględnione', value: counts.objectionsUpheld },
    { question: 13, label: 'Sprzeciwy nieuwzględnione', value: counts.objectionsRejected },
    { question: 13, label: 'Sprzeciwy nierozpatrzone', value: counts.objectionsPending },
    { question: 13, label: 'Sprzeciwy ogółem', value: objections },
    {
      question: 14,
      label: 'Odwołania do sądu pracy w sprawach ocen okresowych',
      value: counts.labourCourtAppeals,
    },
    {
      question: 15,
      label: 'Wnioski o kolejny stopień służbowy (art. 89 ust. 1)',
      value: sum(civil, (row) => row.gradeRequests),
    },
    {
      question: 16,
      label: 'Stopnie służbowe przyznane na wniosek (art. 89 ust. 1)',
      value: counts.gradesOnRequest,
    },
    {
      question: 17,
      label: 'Stopnie służbowe przyznane z mocy prawa (art. 89 ust. 2)',
      value: counts.gradesByLaw,
    },
  ];
}

export function officeReport(
  year: number,
  regulation: RegulationDocument,
  figures: {
    distribution: readonly DistributionRow[];
    counts: DscOckCounts;
    criteria: readonly CriterionRatingRow[];
  },
): OfficeReport {
  const { distribution } = figures;
  const total = sum(distribution, (row) => row.evaluations);
  const negative = sum(distribution, (row) => row.negative);
  return {
    year,
    total,
    levels: levelShares(regulation, distribution),
    negative: {
      count: negative,
      share: share(negative, total),
      nationalShare: nationalBenchmark.negativeShare,
    },
    byUnit: unitDistribution(distribution),
    developmentConclusionsShare: share(
      sum(distribution, (row) => row.withConclusions),
      total,
    ),
    developmentNeeds: developmentNeeds(regulation, figures.criteria),
    dscOck: dscOckAnswers(regulation, distribution, figures.counts),
  };
}

/**
 * Per evaluator breakdown with deterministic flags. The middle level is the middle element of the partial
 * scale. A flag needs at least `minEvaluations` evaluations of the evaluator in the year.
 */
export function evaluatorReport(
  year: number,
  regulation: RegulationDocument,
  rows: readonly EvaluatorRow[],
  thresholds: EvaluatorFlagThresholds,
): EvaluatorReport {
  const scale = regulation.partialScale.levels;
  const middle = scale[Math.floor((scale.length - 1) / 2)]?.code ?? null;
  const officePoints = rows.reduce((total, row) => total + row.pointsSum, 0);
  const officeRatings = rows.reduce((total, row) => total + row.ratings, 0);
  const officeMean = officeRatings === 0 ? null : officePoints / officeRatings;

  const byEvaluator = new Map<
    string,
    {
      name: string | null;
      evaluations: number;
      points: number;
      ratings: number;
      levels: Record<string, number>;
    }
  >();
  for (const row of rows) {
    const entry = byEvaluator.get(row.evaluatorAccountId) ?? {
      name: row.evaluatorName,
      evaluations: 0,
      points: 0,
      ratings: 0,
      levels: {},
    };
    entry.evaluations += row.evaluations;
    entry.points += row.pointsSum;
    entry.ratings += row.ratings;
    if (row.levelCode !== null) {
      entry.levels[row.levelCode] = (entry.levels[row.levelCode] ?? 0) + row.evaluations;
    }
    byEvaluator.set(row.evaluatorAccountId, entry);
  }

  const evaluators = [...byEvaluator.entries()].map(([evaluatorAccountId, entry]) => {
    const mean = entry.ratings === 0 ? null : entry.points / entry.ratings;
    const leniency = mean === null || officeMean === null ? null : mean - officeMean;
    const centralShare = share(
      middle === null ? 0 : (entry.levels[middle] ?? 0),
      entry.evaluations,
    );
    const flags: EvaluatorFlag[] = [];
    if (entry.evaluations >= thresholds.minEvaluations) {
      if (centralShare >= thresholds.centralShare) flags.push('central_tendency');
      if (leniency !== null && leniency >= thresholds.leniencyPoints) flags.push('lenient');
      if (leniency !== null && leniency <= -thresholds.leniencyPoints) flags.push('strict');
    }
    return {
      evaluatorAccountId,
      evaluatorName: entry.name,
      evaluations: entry.evaluations,
      mean,
      centralShare,
      leniency,
      levels: entry.levels,
      flags,
    };
  });
  evaluators.sort(
    (a, b) =>
      b.evaluations - a.evaluations ||
      (a.evaluatorName ?? '').localeCompare(b.evaluatorName ?? '', 'pl'),
  );
  return { year, officeMean, thresholds, evaluators };
}

const BEFORE_DRAFTED = new Set(['criteria', 'criteria_awaiting_signature', 'period', 'interview']);
const STARTING = new Set(['criteria', 'criteria_awaiting_signature']);

export function scheduleReport(
  rows: readonly ScheduleRow[],
  today: CalendarDate,
  horizonDays: number,
): ScheduleReport {
  const horizon = addDays(today, horizonDays);
  const items: ScheduleItem[] = rows.map((row) => {
    const beforeDrafted = BEFORE_DRAFTED.has(row.status);
    const due = row.evaluationDueOn;
    const overdue = beforeDrafted && !row.suspended && due !== null && due < today;
    const withoutInterview = beforeDrafted && !row.interviewHeld && due !== null && due <= horizon;
    const startingInterviewSoon =
      STARTING.has(row.status) &&
      row.startingInterviewDueOn !== null &&
      row.startingInterviewDueOn <= horizon;
    return { ...row, overdue, withoutInterview, startingInterviewSoon };
  });
  items.sort((a, b) => {
    if (a.evaluationDueOn === null) return b.evaluationDueOn === null ? 0 : 1;
    if (b.evaluationDueOn === null) return -1;
    return a.evaluationDueOn.localeCompare(b.evaluationDueOn);
  });
  return {
    today,
    horizonDays,
    rows: items,
    summary: {
      inProgress: items.length,
      overdue: items.filter((item) => item.overdue).length,
      withoutInterview: items.filter((item) => item.withoutInterview).length,
      startingInterviews: items.filter((item) => item.startingInterviewSoon).length,
    },
  };
}
