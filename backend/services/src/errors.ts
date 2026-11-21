export type ServiceErrorCode =
  'no_regulation_in_force' | 'unknown_regulation' | 'missing_deadline_slot' | 'regulation_drift';

/** An expected failure of a service. The frontend maps `code` to a message for the user. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}
