import { z } from 'zod';
import { calendarDateSchema } from '../deadlines/calendar-date';

/**
 * Basis of a grade grant. `on_request` is art. 89 ust. 1 ustawy o służbie cywilnej (the civil servant
 * asks, the evaluation is optional), `by_law` is art. 89 ust. 2 (after the qualifying evaluations).
 */
export const gradeBasisSchema = z.enum(['on_request', 'by_law']);
export type GradeBasis = z.infer<typeof gradeBasisSchema>;

/** Appeal to the labour court after an objection that was not upheld (art. 83 ust. 5 ustawy). */
export const labourCourtAppealInputSchema = z.strictObject({
  evaluationId: z.uuid(),
  filedOn: calendarDateSchema,
});
export type LabourCourtAppealInput = z.output<typeof labourCourtAppealInputSchema>;

export const gradeGrantInputSchema = z
  .strictObject({
    employeeId: z.uuid(),
    evaluationId: z.uuid().nullable(),
    basis: gradeBasisSchema,
    grantedOn: calendarDateSchema,
    newGrade: z.number().int().min(1).max(9),
  })
  .superRefine((input, ctx) => {
    if (input.basis === 'by_law' && input.evaluationId === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['evaluationId'],
        message: 'a grade by law needs the evaluation',
      });
    }
  });
export type GradeGrantInput = z.output<typeof gradeGrantInputSchema>;
