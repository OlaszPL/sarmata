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
  | 'not_found';

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
