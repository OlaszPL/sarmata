import { type AiInput, type AiOutput, type CriterionFact } from '@sarmata/domain';
import { z } from 'zod';
import { keepCitedSentences } from './checks';
import { type Task, describeCriteria, describeNotes, ok, oneOf, withSignal } from './task';

const sentenceSchema = z.object({ text: z.string(), noteIds: z.array(z.string()) });

function modelSchema(input: AiInput<'sheet_draft'>) {
  const [first, ...rest] = input.scale.map((level) => level.points);
  const points = first === undefined ? z.never() : z.literal([first, ...rest]);
  return z.object({
    ratings: z.array(
      z.object({
        criterionId: oneOf(input.criteria.map((criterion) => criterion.id)),
        points: points.nullable(),
        sentences: z.array(sentenceSchema),
      }),
    ),
    justification: z.array(sentenceSchema),
    developmentConclusions: z.array(sentenceSchema),
    questions: z.array(z.string()),
  });
}

/** Questions for the evaluation interview when there is nothing to draft from. */
const questionsFor = (criteria: readonly CriterionFact[]): string[] =>
  criteria.map(
    (criterion) =>
      `Jakie konkretne sytuacje z okresu oceny pokazują kryterium „${criterion.name}”? Proszę podać datę i rezultat.`,
  );

function insufficientData(input: AiInput<'sheet_draft'>): AiOutput<'sheet_draft'> {
  return {
    status: 'insufficient_data',
    ratings: input.criteria.map((criterion) => ({
      criterionId: criterion.id,
      points: null,
      sentences: [],
    })),
    justification: [],
    developmentConclusions: [],
    questions: questionsFor(input.criteria),
  };
}

/**
 * Full draft of the sheet with proposed partial ratings. Every sentence cites notes of the input, a
 * sentence that cites nothing or a note from outside is dropped, and a rating left without sentences
 * proposes no level.
 */
export const sheetDraft: Task<'sheet_draft'> = async (input, { ai, system }, signal) => {
  if (input.notes.length === 0) return ok(insufficientData(input));
  const scale = input.scale.map((level) => `${level.points} (${level.name})`).join(', ');
  const result = await ai.generateObject({
    schemaName: 'sheet_draft',
    schema: modelSchema(input),
    system,
    prompt:
      `Arkusz ${input.sheetId}. Skala ocen cząstkowych w punktach: ${scale}.\n\n` +
      `Kryteria:\n${describeCriteria(input.criteria)}\n\n` +
      `Notatki oceniającego:\n${describeNotes(input.notes)}`,
    maxTokens: 3072,
    ...withSignal(signal),
  });
  if (!result.ok) return result;
  const noteIds = new Set(input.notes.map((note) => note.id));
  const ratings = input.criteria.map((criterion) => {
    const proposed = result.value.ratings.find((rating) => rating.criterionId === criterion.id);
    const sentences = keepCitedSentences(proposed?.sentences ?? [], noteIds);
    return {
      criterionId: criterion.id,
      points: sentences.length > 0 ? (proposed?.points ?? null) : null,
      sentences,
    };
  });
  const justification = keepCitedSentences(result.value.justification, noteIds);
  const developmentConclusions = keepCitedSentences(result.value.developmentConclusions, noteIds);
  const kept =
    ratings.reduce((sum, rating) => sum + rating.sentences.length, 0) +
    justification.length +
    developmentConclusions.length;
  // Every sentence was dropped: the notes did not support any of them, so ask for more data.
  if (kept === 0) return ok(insufficientData(input));
  return ok({
    status: 'draft',
    ratings,
    justification,
    developmentConclusions,
    questions: result.value.questions,
  });
};
