import { z } from 'zod';

export const evaluationVisibilitySchema = z.enum(['office', 'tree']);
export type EvaluationVisibility = z.infer<typeof evaluationVisibilitySchema>;

const reminderLeadDaysSchema = z
  .array(z.number().int().min(1).max(90))
  .min(1)
  .max(5)
  .transform((days) => [...new Set(days)].sort((a, b) => b - a));

const smtpPatchSchema = z.strictObject({
  host: z.string().trim().min(1).nullable().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  user: z.string().trim().min(1).nullable().optional(),
  from: z.email().nullable().optional(),
});

const evaluatorFlagsPatchSchema = z.strictObject({
  minEvaluations: z.number().int().min(1).max(1000).optional(),
  centralShare: z.number().min(0.5).max(1).optional(),
  leniencyPoints: z.number().min(0.1).max(4).optional(),
});

/** Thresholds of the evaluator flags in the statistics, stored in the office settings. */
export interface EvaluatorFlagThresholds {
  /** Evaluations of one evaluator in a year needed before any flag applies. */
  minEvaluations: number;
  /** Share of the middle level from which central tendency is flagged. */
  centralShare: number;
  /** Distance of the evaluator mean from the office mean, in points, from which leniency is flagged. */
  leniencyPoints: number;
}

/** The same numbers as the defaults of the `evaluator_flag_*` columns (a test compares them). */
export const DEFAULT_EVALUATOR_FLAG_THRESHOLDS: EvaluatorFlagThresholds = {
  minEvaluations: 5,
  centralShare: 0.8,
  leniencyPoints: 1,
};

/** Admin changes to the office settings. Every field is optional, the SMTP password is set separately. */
export const officeSettingsPatchSchema = z.strictObject({
  aiEnabled: z.boolean().optional(),
  notesRetentionMonths: z.number().int().min(1).max(120).optional(),
  reminderLeadDays: reminderLeadDaysSchema.optional(),
  evaluationVisibility: evaluationVisibilitySchema.optional(),
  defaultPlace: z.string().trim().min(1).nullable().optional(),
  objectionAddresseeSheetA: z.string().trim().min(1).nullable().optional(),
  evaluatorFlags: evaluatorFlagsPatchSchema.optional(),
  smtp: smtpPatchSchema.optional(),
});
export type OfficeSettingsPatchInput = z.input<typeof officeSettingsPatchSchema>;
export type OfficeSettingsPatch = z.output<typeof officeSettingsPatchSchema>;
