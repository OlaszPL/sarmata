import { describe, expect, it } from 'vitest';
import { employeePatchSchema, newEmployeeSchema } from './employee';

const base = { firstName: 'Anna', lastName: 'Nowak' };

describe('newEmployeeSchema', () => {
  it('accepts grade data for a civil servant', () => {
    const parsed = newEmployeeSchema.parse({
      ...base,
      serviceStatus: 'civil_servant',
      grade: 4,
      appointmentYear: 2015,
    });
    expect(parsed.grade).toBe(4);
  });

  it.each([
    ['grade', 4],
    ['appointmentYear', 2015],
    ['gradeGrantedOn', '2020-01-01'],
  ])('rejects %s for an employee who is not a civil servant', (key, value) => {
    const result = newEmployeeSchema.safeParse({
      ...base,
      serviceStatus: 'employee',
      [key]: value,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([key]);
  });
});

describe('employment end', () => {
  it('is not accepted in a new profile', () => {
    expect(newEmployeeSchema.safeParse({ ...base, employmentEndedOn: '2026-03-15' }).success).toBe(
      false,
    );
  });

  it('is not accepted in a patch', () => {
    expect(employeePatchSchema.safeParse({ employmentEndedOn: '2026-03-15' }).success).toBe(false);
    expect(employeePatchSchema.safeParse({ lastName: 'Kowalska' }).success).toBe(true);
  });
});
