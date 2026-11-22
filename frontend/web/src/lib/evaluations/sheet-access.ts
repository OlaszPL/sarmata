import { type EvaluationStatus, type EvaluationView } from '@sarmata/services';

export type PartTwoMode = 'not_open' | 'period' | 'edit' | 'read';

/** What part II shows: the notice before it opens, a draft in the period, the editor, or read only. */
export function partTwoMode(status: EvaluationStatus, canWrite: boolean): PartTwoMode {
  if (status === 'criteria' || status === 'criteria_awaiting_signature') return 'not_open';
  if (status === 'period') return canWrite ? 'period' : 'read';
  if (status === 'interview') return canWrite ? 'edit' : 'read';
  return 'read';
}

export type GradeRequestMode =
  'form' | 'not_civil_servant' | 'no_grade' | 'max_grade' | 'negative' | 'incomplete' | 'read';

/** The status in which the evaluator still changes the sheet. */
function sheetOpen(status: EvaluationStatus): boolean {
  return status === 'period' || status === 'interview';
}

/**
 * In this order: not a civil servant, no grade in the data, grade 9, negative outcome, no outcome
 * yet, then the form or read only.
 */
export function gradeRequestMode(
  view: Pick<EvaluationView, 'status' | 'snapshot' | 'score'>,
  canWrite: boolean,
): GradeRequestMode {
  if (view.snapshot.serviceStatus !== 'civil_servant') return 'not_civil_servant';
  if (view.snapshot.grade === null) return 'no_grade';
  if (view.snapshot.grade === 9) return 'max_grade';
  if (view.score.outcome === 'negative') return 'negative';
  if (view.score.outcome === null) return 'incomplete';
  if (canWrite && sheetOpen(view.status)) return 'form';
  return 'read';
}

/**
 * A saved grade request that the mode no longer allows (e.g. the outcome turned negative) would block
 * the approval, so the evaluator gets a button that removes it while the sheet is open.
 */
export function canRemoveGradeRequest(
  view: Pick<EvaluationView, 'status' | 'snapshot' | 'score' | 'sheet'>,
  canWrite: boolean,
): boolean {
  const mode = gradeRequestMode(view, canWrite);
  return (
    canWrite &&
    sheetOpen(view.status) &&
    mode !== 'form' &&
    mode !== 'read' &&
    view.sheet.content.partTwo.gradeRequest !== null
  );
}

export type CheckMode = 'approve' | 'blocked' | 'period' | 'approved' | 'read';

export function checkMode(
  status: EvaluationStatus,
  canWrite: boolean,
  issueCount: number,
): CheckMode {
  if (status === 'interview' && canWrite) return issueCount > 0 ? 'blocked' : 'approve';
  if (status === 'period' && canWrite) return 'period';
  if (
    status === 'drafted' ||
    status === 'delivered' ||
    status === 'objection' ||
    status === 'closed'
  ) {
    return 'approved';
  }
  return 'read';
}
