import { describe, expect, it } from 'vitest';
import { calendarDate } from '../deadlines/calendar-date';
import { evaluationEligibility } from './eligibility';

describe('evaluationEligibility', () => {
  it('rejects fixed_term', () => {
    expect(
      evaluationEligibility({ employmentBasis: 'fixed_term', employmentEndedOn: null }),
    ).toEqual({ eligible: false, reason: 'fixed_term' });
  });

  it('rejects employment_ended', () => {
    expect(
      evaluationEligibility({
        employmentBasis: 'indefinite',
        employmentEndedOn: calendarDate('2026-01-31'),
      }),
    ).toEqual({ eligible: false, reason: 'employment_ended' });
  });

  it('accepts an indefinite active employee', () => {
    expect(
      evaluationEligibility({ employmentBasis: 'indefinite', employmentEndedOn: null }),
    ).toEqual({ eligible: true });
  });
});
