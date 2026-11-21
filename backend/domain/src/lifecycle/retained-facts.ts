import { type CalendarDate, toParts } from '../deadlines/calendar-date';
import type { ServiceStatus } from '../employees/employee';
import { type HistoryEntry } from '../evaluations/signals';
import type { SheetContent } from '../evaluations/sheet-content';
import { type EvaluationStatus } from '../evaluations/state-machine';
import type { RegulationDocument } from '../regulations/regulation-document';
import { evaluationResult } from '../statistics/evaluation-result';

/**
 * What statistics keep of an evaluation after its employee was anonymized: counts without a person.
 * No name, text or date finer than a year. The evaluator account is a pseudonymous id, it stays
 * because the evaluator report groups by it.
 */
export interface RetainedEvaluationFacts {
  readonly evaluationId: string;
  readonly sheetId: string;
  /** Year of the sheet approval, the year the reports count the evaluation in. */
  readonly year: number;
  readonly orgUnit: string | null;
  readonly civilServant: boolean;
  readonly levelCode: string | null;
  readonly outcome: 'positive' | 'negative' | null;
  readonly mean: number | null;
  readonly secondConsecutiveNegative: boolean;
  readonly gradeByLawDueYear: number | null;
  readonly withConclusions: boolean;
  readonly gradeRequested: boolean;
  readonly ratings: readonly { readonly criterionId: string; readonly points: number }[];
  readonly objection: 'none' | 'pending' | 'rejected' | 'changed' | 'redraft';
  readonly labourCourtAppealYear: number | null;
  readonly evaluatorAccountId: string;
}

/** Everything `retainedFacts` reads about one evaluation. The store assembles it. */
export interface RetainedFactsInput {
  readonly evaluationId: string;
  readonly status: EvaluationStatus;
  readonly sheetId: string;
  /** Content of the current sheet version when it is locked, `null` otherwise. */
  readonly lockedContent: SheetContent | null;
  readonly orgUnit: string | null;
  readonly serviceStatus: ServiceStatus;
  readonly gradeGrantedOn: CalendarDate | null;
  /** Date of the last sheet approval. */
  readonly drafted: CalendarDate | null;
  readonly acquaintedOn: CalendarDate | null;
  readonly history: readonly HistoryEntry[];
  readonly objection: RetainedEvaluationFacts['objection'];
  readonly labourCourtAppealOn: CalendarDate | null;
  readonly evaluatorAccountId: string;
}

/** Statuses the statistics count, as in the statistics_evaluation_facts view. */
const COUNTED_STATUSES: readonly EvaluationStatus[] = [
  'drafted',
  'delivered',
  'closed',
  'objection',
];

/**
 * Facts of one evaluation for the statistics, or `null` when the reports do not count it (no locked
 * current sheet, interrupted, still being written). The result comes from `evaluationResult`, the
 * same function that fills the projection of the reports, so the numbers stay the same.
 */
export function retainedFacts(
  regulation: RegulationDocument,
  input: RetainedFactsInput,
): RetainedEvaluationFacts | null {
  const { lockedContent, drafted } = input;
  if (lockedContent === null || drafted === null || !COUNTED_STATUSES.includes(input.status)) {
    return null;
  }
  const result = evaluationResult(regulation, {
    sheetId: input.sheetId,
    content: lockedContent,
    serviceStatus: input.serviceStatus,
    gradeGrantedOn: input.gradeGrantedOn,
    drafted,
    acquaintedOn: input.acquaintedOn,
    history: input.history,
  });
  const civilServant = input.serviceStatus === 'civil_servant';
  return {
    evaluationId: input.evaluationId,
    sheetId: input.sheetId,
    year: toParts(drafted).year,
    orgUnit: input.orgUnit,
    civilServant,
    levelCode: result.levelCode,
    outcome: result.outcome,
    mean: result.mean,
    secondConsecutiveNegative: result.secondConsecutiveNegative,
    gradeByLawDueYear:
      result.gradeByLawDueOn === null ? null : toParts(result.gradeByLawDueOn).year,
    withConclusions: lockedContent.partTwo.developmentConclusions.trim() !== '',
    gradeRequested: civilServant && lockedContent.partTwo.gradeRequest !== null,
    ratings: Object.entries(lockedContent.partTwo.ratings).map(([criterionId, points]) => ({
      criterionId,
      points,
    })),
    objection: input.objection,
    labourCourtAppealYear:
      input.labourCourtAppealOn === null ? null : toParts(input.labourCourtAppealOn).year,
    evaluatorAccountId: input.evaluatorAccountId,
  };
}
