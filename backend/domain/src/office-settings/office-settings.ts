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

const optionalText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

/** Digits, spaces, brackets and hyphens with an optional leading plus, e.g. `+48 22 123 45 67`. */
export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{4,28}[0-9]$/;

/**
 * Office data the accessibility statement needs (art. 10 ust. 4 pkt 4, 6 and 7 of the digital
 * accessibility act). Every field is optional, the statement falls back to its generic text.
 */
const accessibilityPatchSchema = z.strictObject({
  officeAddress: optionalText(500),
  /** Person or unit to contact about accessibility. */
  contactName: optionalText(200),
  contactEmail: z.email().max(254).nullable().optional(),
  contactPhone: z.string().trim().regex(PHONE_PATTERN).nullable().optional(),
  /** A link (http or https) or a text about the architectural accessibility of the buildings. */
  architecture: optionalText(4000),
  /** Sign language interpreter information. */
  signLanguage: optionalText(2000),
});

/** Office data of the accessibility statement, `null` where the admin left a field empty. */
export interface OfficeAccessibility {
  officeAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  architecture: string | null;
  signLanguage: string | null;
}

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
  /** Days without an appreciation after which the evaluator gets the overdue signal (B7). */
  appreciationGapDays: z.number().int().min(1).max(365).optional(),
  smtp: smtpPatchSchema.optional(),
  accessibility: accessibilityPatchSchema.optional(),
});
export type OfficeSettingsPatchInput = z.input<typeof officeSettingsPatchSchema>;
export type OfficeSettingsPatch = z.output<typeof officeSettingsPatchSchema>;
