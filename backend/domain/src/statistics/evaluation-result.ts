import { type CalendarDate } from '../deadlines/calendar-date';
import type { ServiceStatus } from '../employees/employee';
import { sheetCriteria } from '../evaluations/criteria';
import { scoreSheet } from '../evaluations/score';
import type { SheetContent } from '../evaluations/sheet-content';
import {
  type HistoryEntry,
  gradeByLawDue,
  secondConsecutiveNegative,
} from '../evaluations/signals';
import type { RegulationDocument } from '../regulations/regulation-document';

export interface EvaluationResult {
  readonly levelCode: string | null;
  readonly outcome: 'positive' | 'negative' | null;
  readonly mean: number | null;
  readonly secondConsecutiveNegative: boolean;
  readonly gradeByLawDueOn: CalendarDate | null;
}

export interface EvaluationResultInput {
  readonly sheetId: string;
  readonly content: SheetContent;
  readonly serviceStatus: ServiceStatus;
  readonly gradeGrantedOn: CalendarDate | null;
  readonly drafted: CalendarDate;
  readonly acquaintedOn: CalendarDate | null;
  readonly history: readonly HistoryEntry[];
}

/**
 * Level, outcome and signals of one locked sheet. An off-scale partial rating gives an empty
 * level and outcome, like in the evaluation history. The history may hold later entries, they are
 * ignored. The function does not know where the history came from.
 */
export function evaluationResult(
  regulation: RegulationDocument,
  input: EvaluationResultInput,
): EvaluationResult {
  const criteria = sheetCriteria(
    regulation,
    input.sheetId,
    input.content.partOne.additionalCriteria,
  );
  let levelCode: string | null = null;
  let outcome: 'positive' | 'negative' | null = null;
  let mean: number | null = null;
  try {
    ({ levelCode, outcome, mean } = scoreSheet(
      regulation,
      criteria,
      input.content.partTwo.ratings,
    ));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
  const history: HistoryEntry[] = [
    ...input.history.filter((entry) => entry.drafted < input.drafted),
    { drafted: input.drafted, levelCode, outcome, acquaintedOn: input.acquaintedOn },
  ];
  const due = gradeByLawDue(regulation, {
    serviceStatus: input.serviceStatus,
    gradeGrantedOn: input.gradeGrantedOn,
    history,
  });
  return {
    levelCode,
    outcome,
    mean,
    secondConsecutiveNegative: secondConsecutiveNegative(history),
    gradeByLawDueOn: due === null ? null : due.dueOn,
  };
}
