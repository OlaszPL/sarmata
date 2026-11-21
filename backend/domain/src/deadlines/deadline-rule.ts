import { z } from 'zod';

/** The event a deadline is counted from. The caller supplies its date as `facts.eventDate`. */
export const deadlineEventSchema = z.enum([
  'cycleStart',
  'acquaintance',
  'positionChange',
  'objectionFiled',
  'objectionOutcome',
]);

const legalBasis = z.string().min(1);

const monthsFromEventSchema = z.strictObject({
  strategy: z.literal('monthsFromEvent'),
  event: deadlineEventSchema,
  months: z.number().int().positive(),
  extendByAbsencesLongerThanMonth: z.boolean(),
  shiftToWorkingDay: z.boolean(),
  basis: legalBasis,
});

const daysFromEventSchema = z.strictObject({
  strategy: z.literal('daysFromEvent'),
  event: deadlineEventSchema,
  days: z.number().int().positive(),
  shiftToWorkingDay: z.boolean(),
  basis: legalBasis,
});

const windowAroundEventSchema = z.strictObject({
  strategy: z.literal('windowAroundEvent'),
  event: deadlineEventSchema,
  daysBefore: z.number().int().nonnegative(),
  daysAfter: z.number().int().positive(),
  shiftToWorkingDay: z.boolean(),
  basis: legalBasis,
});

/** A deadline slot of a regulation version: a named strategy with its parameters and legal basis (ADR 0006). */
export const deadlineRuleSchema = z.discriminatedUnion('strategy', [
  monthsFromEventSchema,
  daysFromEventSchema,
  windowAroundEventSchema,
]);

export type DeadlineEvent = z.infer<typeof deadlineEventSchema>;
export type DeadlineRule = z.infer<typeof deadlineRuleSchema>;
