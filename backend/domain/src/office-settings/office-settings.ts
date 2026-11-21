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

/** Admin changes to the office settings. Every field is optional, the SMTP password is set separately. */
export const officeSettingsPatchSchema = z.strictObject({
  aiEnabled: z.boolean().optional(),
  notesRetentionMonths: z.number().int().min(1).max(120).optional(),
  reminderLeadDays: reminderLeadDaysSchema.optional(),
  evaluationVisibility: evaluationVisibilitySchema.optional(),
  defaultPlace: z.string().trim().min(1).nullable().optional(),
  objectionAddresseeSheetA: z.string().trim().min(1).nullable().optional(),
  smtp: smtpPatchSchema.optional(),
});
export type OfficeSettingsPatchInput = z.input<typeof officeSettingsPatchSchema>;
export type OfficeSettingsPatch = z.output<typeof officeSettingsPatchSchema>;
