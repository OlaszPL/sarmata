import { describe, expect, it } from 'vitest';
import { endEmploymentInputSchema } from './employment-end';

const valid = {
  employeeId: '11111111-1111-4111-8111-111111111111',
  endedOn: '2026-03-15',
  reason: 'resignation',
};

describe('end employment input', () => {
  it('accepts a complete input', () => {
    expect(endEmploymentInputSchema.parse(valid).endedOn).toBe('2026-03-15');
  });

  it('empty reason is rejected', () => {
    expect(endEmploymentInputSchema.safeParse({ ...valid, reason: '   ' }).success).toBe(false);
  });

  it('impossible date is rejected', () => {
    expect(endEmploymentInputSchema.safeParse({ ...valid, endedOn: '2026-02-31' }).success).toBe(
      false,
    );
  });
});
