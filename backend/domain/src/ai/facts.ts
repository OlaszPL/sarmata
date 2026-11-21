import { z } from 'zod';
import { calendarDateSchema } from '../deadlines/calendar-date';
import { noteKindSchema } from '../notes/note';

/** A note as an AI run sees it: the fields of `Note` (B3) without the author and the times of entry. */
export const noteFactSchema = z.strictObject({
  id: z.string().min(1),
  version: z.number().int().positive(),
  kind: noteKindSchema,
  occurredOn: calendarDateSchema,
  criterionId: z.string().nullable(),
  sign: z.enum(['plus', 'minus']).nullable(),
  communicated: z.boolean(),
  body: z.string(),
});
export type NoteFact = z.output<typeof noteFactSchema>;

/** A criterion of the regulation catalog with its behavioural indicators. */
export const criterionFactSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  indicators: z.array(z.string()),
});
export type CriterionFact = z.output<typeof criterionFactSchema>;

/**
 * Characters of note bodies one run may send. The local model has 8192 tokens per slot
 * (`infra/ai-runtime/src/recommend.ts`), the rest is the prompt, the criteria and the answer.
 */
export const AI_NOTE_BUDGET_CHARS = 6000;

/** Default of `office_settings.appreciation_gap_days`, for the seed and tests. */
export const DEFAULT_APPRECIATION_GAP_DAYS = 30;

/**
 * Keeps the newest notes whose bodies fit the budget together. Once a note does not fit, it and all
 * older notes are dropped, so the run always sees an unbroken recent period.
 */
export function fitNotesToBudget(
  notes: readonly NoteFact[],
  budgetChars: number = AI_NOTE_BUDGET_CHARS,
): { kept: NoteFact[]; droppedIds: string[] } {
  const newestFirst = [...notes].sort((a, b) =>
    a.occurredOn === b.occurredOn ? 0 : a.occurredOn < b.occurredOn ? 1 : -1,
  );
  const kept: NoteFact[] = [];
  const droppedIds: string[] = [];
  let used = 0;
  for (const note of newestFirst) {
    if (droppedIds.length === 0 && used + note.body.length <= budgetChars) {
      kept.push(note);
      used += note.body.length;
    } else {
      droppedIds.push(note.id);
    }
  }
  return { kept, droppedIds };
}
