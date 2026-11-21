import { z } from 'zod';
import { type AiEndpoint } from './config';
import { type DecisionAnswer, type DecisionAnswers, type DecisionRequest } from './decision';
import { type AiResult, failure } from './result';
import { generateObject } from './text-model';

/**
 * Decisions of a text model where Bielik-One cannot run (ADR 0005). The text model answers a forced
 * JSON schema with a simple shape per question, and this module turns it into the same
 * `DecisionAnswers` that Bielik-One returns. The model gives no calibrated probabilities: they are
 * one-hot on its own answer, and `confidence` is the value it reports itself.
 */

const confidence = z.number().min(0).max(1);

const oneOf = (keys: readonly string[]): z.ZodType<string> => {
  const [first, ...rest] = keys;
  return first === undefined ? z.never() : z.enum([first, ...rest]);
};

interface FallbackQuestion {
  readonly schema: z.ZodType;
  /** Builds the answer from a value that already passed `schema`. */
  answer(raw: unknown): DecisionAnswer;
}

const question = <S extends z.ZodType>(
  schema: S,
  answer: (raw: z.output<S>) => DecisionAnswer,
): FallbackQuestion => ({ schema, answer: (raw) => answer(schema.parse(raw)) });

function fallbackQuestion(spec: DecisionRequest['questions'][string]): FallbackQuestion {
  switch (spec.type) {
    case 'choice': {
      const keys = Object.keys(spec.criteria);
      return question(z.object({ choice: oneOf(keys), confidence }), (raw) => ({
        type: 'choice',
        choice: raw.choice,
        probabilities: Object.fromEntries(keys.map((key) => [key, key === raw.choice ? 1 : 0])),
        confidence: raw.confidence,
        calibrated: false,
      }));
    }
    case 'noul':
      return question(z.object({ value: z.boolean(), confidence }), (raw) => ({
        type: 'noul',
        noul: raw.value ? 1 : 0,
        probabilities: { true: raw.value ? 1 : 0, false: raw.value ? 0 : 1 },
        confidence: raw.confidence,
        calibrated: false,
      }));
    case 'score': {
      const top = Math.max(spec.criteria.length - 1, 0);
      return question(z.object({ score: z.number().min(0).max(top), confidence }), (raw) => ({
        type: 'score',
        score: raw.score,
        legend: Object.fromEntries(spec.criteria.map((text, index) => [String(index), text])),
        probabilities: Object.fromEntries(
          spec.criteria.map((_, index) => [String(index), index === Math.round(raw.score) ? 1 : 0]),
        ),
        confidence: raw.confidence,
        calibrated: false,
      }));
    }
    case 'labels': {
      const keys = Object.keys(spec.criteria);
      return question(z.object({ selected: z.array(oneOf(keys)), confidence }), (raw) => ({
        type: 'labels',
        selected: raw.selected,
        probabilities: Object.fromEntries(
          keys.map((key) => [key, raw.selected.includes(key) ? 1 : 0]),
        ),
        confidence: raw.confidence,
        calibrated: false,
      }));
    }
  }
}

const SYSTEM =
  'Jesteś rzetelnym analitykiem. Na podstawie opisu przypadku odpowiedz na każde pytanie. ' +
  'Odpowiadaj wyłącznie obiektem JSON zgodnym z podanym schematem. ' +
  'W polu confidence podaj swoją pewność od 0 do 1.';

const describeQuestions = (questions: DecisionRequest['questions']): string =>
  Object.entries(questions)
    .map(([name, spec]) => {
      const criteria =
        spec.criteria === undefined ? '' : `\nKryteria: ${JSON.stringify(spec.criteria)}`;
      return `Pytanie "${name}" (typ ${spec.type}): ${spec.instructions}${criteria}`;
    })
    .join('\n\n');

export async function decideWithTextModel(
  endpoint: AiEndpoint,
  timeoutMs: number,
  request: DecisionRequest,
): Promise<AiResult<DecisionAnswers>> {
  const names = Object.keys(request.questions);
  if (names.length === 0) return failure('rejected', 'No questions to answer');
  const fallbacks = Object.fromEntries(
    Object.entries(request.questions).map(([name, spec]) => [name, fallbackQuestion(spec)]),
  );
  const schema = z.object(
    Object.fromEntries(Object.entries(fallbacks).map(([name, entry]) => [name, entry.schema])),
  );
  const result = await generateObject(endpoint, timeoutMs, {
    schemaName: 'decision_answers',
    schema,
    system: SYSTEM,
    prompt: `Opis przypadku:\n${request.state}\n\n${describeQuestions(request.questions)}`,
    ...(request.signal ? { signal: request.signal } : {}),
  });
  if (!result.ok) return result;
  return {
    ok: true,
    value: Object.fromEntries(
      Object.entries(fallbacks).map(([name, entry]) => [name, entry.answer(result.value[name])]),
    ),
  };
}
