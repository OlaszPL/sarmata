import { z } from 'zod';
import { calendarDateSchema as isoDate } from '../deadlines/calendar-date';

const nullableDate = isoDate.nullable();

const gradeRequestSchema = z.strictObject({
  requestedGrade: z.number().int().positive(),
  motivation: z.string(),
});

/** Editable content of an evaluation sheet: part one (criteria, due date) and part two (ratings, conclusions). */
export const sheetContentSchema = z.strictObject({
  partOne: z.strictObject({
    additionalCriteria: z.array(z.string()),
    dueOn: nullableDate,
  }),
  partTwo: z.strictObject({
    interviewOn: nullableDate,
    periodFrom: nullableDate,
    periodTo: nullableDate,
    ratings: z.record(z.string(), z.number()),
    justification: z.string(),
    developmentConclusions: z.string(),
    gradeRequest: gradeRequestSchema.nullable(),
  }),
});

export type SheetContent = z.output<typeof sheetContentSchema>;
export type GradeRequest = z.output<typeof gradeRequestSchema>;

export function emptySheetContent(): SheetContent {
  return {
    partOne: { additionalCriteria: [], dueOn: null },
    partTwo: {
      interviewOn: null,
      periodFrom: null,
      periodTo: null,
      ratings: {},
      justification: '',
      developmentConclusions: '',
      gradeRequest: null,
    },
  };
}
