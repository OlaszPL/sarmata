import { z } from 'zod';

export const trainingChannelSchema = z.enum([
  'sc-elearning',
  'pdw-webinar',
  'sc-trainers',
  'central-training',
  'government-platform',
  'ksap',
  'mentoring',
  'mooc',
]);

export const trainingStatusSchema = z.enum([
  'available',
  'on-request',
  'recurring',
  'unconfirmed',
  'finished',
]);

/** One training or development offer of the Civil Service catalog (docs/sources/szkolenia-katalog). */
export const trainingItemSchema = z.strictObject({
  id: z.string().regex(/^SK\d{3}$/),
  title: z.string().min(1),
  organizer: z.string(),
  channel: trainingChannelSchema,
  form: z.string(),
  topics: z.string(),
  /** Ids of the regulation criteria the offer develops. */
  criteria: z.array(z.string().min(1)).min(1),
  mainCriterion: z.string().min(1),
  audience: z.enum(['all', 'managers', 'specialists']),
  url: z.string().nullable(),
  dates: z.string().nullable(),
  cost: z.string(),
  free: z.boolean(),
  status: trainingStatusSchema,
  /** Years in which the Head of the Civil Service named the topic a priority. */
  priorityYears: z.array(z.number().int()),
});

export type TrainingChannel = z.infer<typeof trainingChannelSchema>;
export type TrainingItem = z.output<typeof trainingItemSchema>;
export const trainingCatalogSchema = z.array(trainingItemSchema);
