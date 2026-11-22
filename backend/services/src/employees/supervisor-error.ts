import { RepositoryError } from '@sarmata/repositories';
import { ServiceError } from '../errors';

export type InvalidSupervisorReason = 'cycle' | 'self' | 'other_office' | 'not_allowed';

const RULES: readonly { code: string; text: string; reason: InvalidSupervisorReason }[] = [
  { code: 'P0001', text: 'supervisor cycle', reason: 'cycle' },
  { code: '23514', text: 'employees_not_own_supervisor', reason: 'self' },
  { code: '23503', text: 'employees_supervisor_fkey', reason: 'other_office' },
  { code: '42501', text: 'supervisor change requires hr or admin', reason: 'not_allowed' },
];

/** The supervisor rules of the employees table as `ServiceError('invalid_supervisor', ..., { reason })`, other errors unchanged. */
export function supervisorError(error: unknown): unknown {
  if (!(error instanceof RepositoryError)) return error;
  const rule = RULES.find((r) => error.code === r.code && error.message.includes(r.text));
  if (rule === undefined) return error;
  return new ServiceError('invalid_supervisor', `Invalid supervisor: ${rule.reason}`, {
    reason: rule.reason,
  });
}
