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
  'form' | 'not_civil_servant' | 'max_grade' | 'negative' | 'incomplete' | 'read';

/** In this order: not a civil servant, grade 9, negative outcome, no outcome yet, then the form or read only. */
export function gradeRequestMode(
  view: Pick<EvaluationView, 'status' | 'snapshot' | 'score'>,
  canWrite: boolean,
): GradeRequestMode {
  if (view.snapshot.serviceStatus !== 'civil_servant') return 'not_civil_servant';
  if (view.snapshot.grade === 9) return 'max_grade';
  if (view.score.outcome === 'negative') return 'negative';
  if (view.score.outcome === null) return 'incomplete';
  if (canWrite && (view.status === 'period' || view.status === 'interview')) return 'form';
  return 'read';
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
