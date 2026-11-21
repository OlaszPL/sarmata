import { describe, expect, it } from 'vitest';
import { gradeGrantInputSchema, labourCourtAppealInputSchema } from './hr-register';

const id = '2f6b1c0e-5a43-4d3e-9b8a-1c2d3e4f5a6b';
const grant = {
  employeeId: id,
  evaluationId: id,
  basis: 'by_law',
  grantedOn: '2026-08-01',
  newGrade: 4,
};

describe('hr register input', () => {
  it('by law grant needs evaluation', () => {
    expect(gradeGrantInputSchema.safeParse({ ...grant, evaluationId: null }).success).toBe(false);
    expect(gradeGrantInputSchema.safeParse(grant).success).toBe(true);
  });

  it('on request grant accepts missing evaluation', () => {
    expect(
      gradeGrantInputSchema.safeParse({ ...grant, basis: 'on_request', evaluationId: null })
        .success,
    ).toBe(true);
  });

  it('grade outside 1 to 9 is rejected', () => {
    expect(gradeGrantInputSchema.safeParse({ ...grant, newGrade: 10 }).success).toBe(false);
    expect(gradeGrantInputSchema.safeParse({ ...grant, newGrade: 0 }).success).toBe(false);
  });

  it('appeal input rejects non uuid', () => {
    expect(
      labourCourtAppealInputSchema.safeParse({ evaluationId: 'x', filedOn: '2026-07-01' }).success,
    ).toBe(false);
    expect(
      labourCourtAppealInputSchema.safeParse({ evaluationId: id, filedOn: '2026-07-01' }).success,
    ).toBe(true);
  });
});
