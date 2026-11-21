export type ServiceErrorCode =
  | 'no_regulation_in_force'
  | 'unknown_regulation'
  | 'missing_deadline_slot'
  | 'regulation_drift'
  | 'not_eligible'
  | 'invalid_transition'
  | 'approval_blocked'
  | 'criteria_invalid'
  | 'part_locked'
  | 'stale_status'
  | 'objection_late'
  | 'objection_lowers_outcome'
  | 'term_change_invalid'
  | 'forbidden'
  | 'invalid_evaluator'
  | 'no_locked_sheet'
  | 'not_found'
  | 'sensitive_data'
  | 'hr_entry_rejected'
  | 'ai_disabled'
  | 'ai_run_not_done'
  | 'ai_fragment_unknown'
  | 'regulation_invalid'
  | 'regulation_cases_failed'
  | 'regulation_not_draft'
  | 'already_ended'
  | 'not_ended'
  | 'invalid_end_date'
  | 'invalid_csv'
  | 'account_exists'
  | 'last_admin'
  | 'invalid_account';

/** An expected failure of a service. The frontend maps `code` to a message for the user. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  /** Machine-readable detail, e.g. a list of `ApprovalIssue` or `CriteriaIssue`. */
  readonly details: unknown;

  constructor(code: ServiceErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.details = details;
  }
}
