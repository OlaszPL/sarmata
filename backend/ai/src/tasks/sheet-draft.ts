import { type AiInput, type AiOutput, type CriterionFact, type Sentence } from '@sarmata/domain';
import { z } from 'zod';
import { keepCitedSentences } from './checks';
import {
  type Task,
  describeCriteria,
  describeNotes,
  noteAliases,
  ok,
  oneOf,
  streamCall,
  withSignal,
} from './task';

type Draft = AiOutput<'sheet_draft'>;
type Rating = Draft['ratings'][number];
type Summary = Pick<Draft, 'justification' | 'developmentConclusions' | 'questions'>;

/**
 * Short calls instead of one large JSON: one per criterion, then one for the justification, the
 * development conclusions (IPRZ) and questions. The first criterion is visible within seconds, and a
 * full draft stays around 400 to 600 output tokens. The limits leave room above the sentence caps of
 * the schemas, a call cut at the limit keeps its finished sentences.
 */
const MAX_CRITERION_SENTENCES = 2;
const MAX_SUMMARY_SENTENCES = 2;
const MAX_QUESTIONS = 3;
const MAX_CITED_NOTES = 3;
const CRITERION_MAX_TOKENS = 160;
const SUMMARY_MAX_TOKENS = 260;

const EMPTY_SUMMARY: Summary = { justification: [], developmentConclusions: [], questions: [] };

/** Questions for the evaluation interview when there is nothing to draft from. */
const questionsFor = (criteria: readonly CriterionFact[]): string[] =>
  criteria.map(
    (criterion) =>
      `Jakie konkretne sytuacje z okresu oceny pokazują kryterium „${criterion.name}”? Proszę podać datę i rezultat.`,
  );

function insufficientData(input: AiInput<'sheet_draft'>): Draft {
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

const looseSentence = z.object({ text: z.string(), noteIds: z.array(z.string()) });

/**
 * Full draft of the sheet with proposed partial ratings. Every sentence cites notes of the input, a
 * sentence that cites nothing or a note from outside is dropped, and a rating left without sentences
 * proposes no level. While it runs, the finished criteria (and the finished sentences of the current
 * one) are the partial output.
 */
export const sheetDraft: Task<'sheet_draft'> = async (input, { ai, system, progress }, signal) => {
  if (input.notes.length === 0) return ok(insufficientData(input));
  const notes = noteAliases(input.notes);
  const noteIds = new Set(input.notes.map((note) => note.id));
  const levels = input.scale.map((level) => level.points);
  const [firstLevel, ...otherLevels] = levels;
  const points = firstLevel === undefined ? z.never() : z.literal([firstLevel, ...otherLevels]);
  const sentence = z.object({
    text: z.string(),
    noteIds: z.array(oneOf(notes.aliases)).min(1).max(MAX_CITED_NOTES),
  });
  const sentences = (max: number) => z.array(sentence).max(max);

  /** Sentences of the model with note ids instead of aliases, only those citing notes of the input. */
  const citedSentences = (raw: unknown): Sentence[] => {
    if (!Array.isArray(raw)) return [];
    const mapped = raw.flatMap((entry) => {
      const parsed = looseSentence.safeParse(entry);
      if (!parsed.success || parsed.data.text.trim() === '') return [];
      return [{ text: parsed.data.text.trim(), noteIds: parsed.data.noteIds.map(notes.toNoteId) }];
    });
    return keepCitedSentences(mapped, noteIds);
  };
  const ratingOf = (criterion: CriterionFact, raw: unknown): Rating => {
    const fields = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const kept = citedSentences(fields.sentences);
    const level = typeof fields.points === 'number' && levels.includes(fields.points);
    return {
      criterionId: criterion.id,
      points: kept.length > 0 && level ? (fields.points as number) : null,
      sentences: kept,
    };
  };
  const summaryOf = (raw: unknown): Summary => {
    const fields = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const questions = Array.isArray(fields.questions) ? fields.questions : [];
    return {
      justification: citedSentences(fields.justification),
      developmentConclusions: citedSentences(fields.developmentConclusions),
      questions: questions
        .filter((question): question is string => typeof question === 'string')
        .map((question) => question.trim())
        .filter((question) => question !== ''),
    };
  };
  const draft = (ratings: Rating[], summary: Summary): Draft => ({
    status: 'draft',
    ratings,
    ...summary,
  });

  const scale = input.scale.map((level) => `${level.points} (${level.name})`).join(', ');
  // The same beginning for every call: llama-server reuses its processed prompt (cache_prompt), so
  // only the task at the end is processed again.
  const context =
    `Arkusz ${input.sheetId}. Skala ocen cząstkowych w punktach: ${scale}.\n\n` +
    `Kryteria:\n${describeCriteria(input.criteria)}\n\n` +
    `Notatki oceniającego:\n${describeNotes(input.notes, notes.aliasOf)}\n\n`;

  const ratings: Rating[] = [];
  for (const criterion of input.criteria) {
    const call = streamCall(progress, (prefix) =>
      draft([...ratings, ratingOf(criterion, prefix)], EMPTY_SUMMARY),
    );
    const result = await ai.generateObject({
      schemaName: 'sheet_draft_criterion',
      schema: z.object({
        sentences: sentences(MAX_CRITERION_SENTENCES),
        points: points.nullable(),
      }),
      system,
      prompt:
        context +
        `Zadanie: kryterium ${criterion.id} (${criterion.name}). Najwyżej ${MAX_CRITERION_SENTENCES} krótkie zdania, potem poziom ze skali.`,
      maxTokens: CRITERION_MAX_TOKENS,
      onProgress: call.onProgress,
      ...withSignal(signal),
    });
    if (!result.ok && result.reason !== 'invalid_response') return result;
    ratings.push(ratingOf(criterion, result.ok ? result.value : call.prefix()));
    progress.output(draft(ratings, EMPTY_SUMMARY));
  }
  // No criterion found support in the notes: a summary would have nothing to stand on.
  if (ratings.every((rating) => rating.sentences.length === 0)) {
    return ok(insufficientData(input));
  }

  const proposed = ratings
    .map((rating) => `${rating.criterionId} ${rating.points ?? 'brak'}`)
    .join(', ');
  const call = streamCall(progress, (prefix) => draft(ratings, summaryOf(prefix)));
  const result = await ai.generateObject({
    schemaName: 'sheet_draft_summary',
    schema: z.object({
      justification: sentences(MAX_SUMMARY_SENTENCES),
      developmentConclusions: sentences(MAX_SUMMARY_SENTENCES),
      questions: z.array(z.string()).max(MAX_QUESTIONS),
    }),
    system,
    prompt:
      context +
      `Zadanie: podsumowanie. Proponowane oceny cząstkowe: ${proposed}. Uzasadnienie i wnioski IPRZ po najwyżej ${MAX_SUMMARY_SENTENCES} zdania, najwyżej ${MAX_QUESTIONS} pytania.`,
    maxTokens: SUMMARY_MAX_TOKENS,
    onProgress: call.onProgress,
    ...withSignal(signal),
  });
  if (!result.ok && result.reason !== 'invalid_response') return result;
  return ok(draft(ratings, summaryOf(result.ok ? result.value : call.prefix())));
};
