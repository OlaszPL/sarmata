import { z } from 'zod';
import { calendarDateSchema } from '../deadlines/calendar-date';

export const noteKindSchema = z.enum([
  'observation',
  'ongoing_conversation',
  'appreciation',
  'workload_fact',
]);
export type NoteKind = z.infer<typeof noteKindSchema>;

export type NoteSign = 'plus' | 'minus';

const noteSignSchema = z.enum(['plus', 'minus']);

export const newNoteSchema = z.strictObject({
  employeeId: z.uuid(),
  kind: noteKindSchema,
  occurredOn: calendarDateSchema,
  criterionId: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .optional(),
  /** Null for a workload fact. */
  sign: noteSignSchema.nullable(),
  communicated: z.boolean().default(false),
  body: z.string().trim().min(1).max(5000),
});
export type NewNoteInput = z.input<typeof newNoteSchema>;
export type NewNote = z.output<typeof newNoteSchema>;

export const notePatchSchema = newNoteSchema.omit({ employeeId: true }).partial();
export type NotePatch = z.input<typeof notePatchSchema>;
