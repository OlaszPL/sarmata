import type { CalendarDate } from '../deadlines/calendar-date';
import type { EmploymentBasis } from '../employees/employee';

export type Eligibility =
  { eligible: true } | { eligible: false; reason: 'fixed_term' | 'employment_ended' };

export function evaluationEligibility(employee: {
  employmentBasis: EmploymentBasis;
  employmentEndedOn: CalendarDate | null;
}): Eligibility {
  if (employee.employmentBasis === 'fixed_term') return { eligible: false, reason: 'fixed_term' };
  if (employee.employmentEndedOn !== null) return { eligible: false, reason: 'employment_ended' };
  return { eligible: true };
}
