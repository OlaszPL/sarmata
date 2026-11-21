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

const noteFields = z.strictObject({
  employeeId: z.uuid(),
  kind: noteKindSchema,
  occurredOn: calendarDateSchema,
  criterionId: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .nullable()
    .optional(),
  /** Null for a workload fact. */
  sign: noteSignSchema.nullable(),
  communicated: z.boolean(),
  body: z.string().trim().min(1).max(5000),
});
const workloadFactHasNoSign = {
  message: 'A workload fact has no sign',
  path: ['sign'],
};

export const newNoteSchema = noteFields
  .extend({ communicated: z.boolean().default(false) })
  .refine((note) => note.kind !== 'workload_fact' || note.sign === null, workloadFactHasNoSign);
export type NewNoteInput = z.input<typeof newNoteSchema>;
export type NewNote = z.output<typeof newNoteSchema>;

export const notePatchSchema = noteFields
  .omit({ employeeId: true })
  .partial()
  .refine(
    (note) => note.kind !== 'workload_fact' || note.sign === undefined || note.sign === null,
    workloadFactHasNoSign,
  );
export type NotePatch = z.input<typeof notePatchSchema>;
