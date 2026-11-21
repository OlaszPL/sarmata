import { z } from 'zod';
import { type AiEndpoint } from './config';
import { postJson } from './http';
import { type AiResult, failure } from './result';

/** Typed question of the TypeSafe System One schema (Bielik-One README). */
export type DecisionQuestion =
  | {
      readonly type: 'choice';
      readonly instructions: string;
      readonly criteria: Record<string, string>;
    }
  | {
      readonly type: 'noul';
      readonly instructions: string;
      readonly criteria?: { readonly true: string; readonly false: string };
    }
  | { readonly type: 'score'; readonly instructions: string; readonly criteria: readonly string[] }
  | {
      readonly type: 'labels';
      readonly instructions: string;
      readonly criteria: Record<string, string>;
    };

export interface DecisionRequest {
  /** Text describing the case, up to 400 000 characters. */
  readonly state: string;
  readonly questions: Record<string, DecisionQuestion>;
  /** Server-side calendar and number facts appended to the state (`"facts": true`). */
  readonly facts?: boolean;
  readonly signal?: AbortSignal;
}

const probabilities = z.record(z.string(), z.number());

const answerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('choice'),
    choice: z.string(),
    probabilities,
    confidence: z.number(),
  }),
  z.object({
    type: z.literal('noul'),
    noul: z.number(),
    probabilities: z.object({ true: z.number(), false: z.number() }),
    confidence: z.number(),
  }),
  z.object({
    type: z.literal('score'),
    score: z.number(),
    legend: z.record(z.string(), z.string()),
    probabilities,
    confidence: z.number(),
  }),
  z.object({
    type: z.literal('labels'),
    probabilities,
    selected: z.array(z.string()),
    confidence: z.number(),
  }),
]);

const responseSchema = z.object({ answers: z.record(z.string(), answerSchema) });

/**
 * `calibrated: false` marks an answer of the text model fallback: its probabilities are one-hot on its
 * own answer and `confidence` is what the model says about itself. Bielik-One answers have no flag.
 */
export type DecisionAnswer = z.infer<typeof answerSchema> & { readonly calibrated?: false };
export type DecisionAnswers = Record<string, DecisionAnswer>;

export async function decide(
  endpoint: AiEndpoint,
  timeoutMs: number,
  request: DecisionRequest,
): Promise<AiResult<DecisionAnswers>> {
  const body = {
    model: endpoint.model,
    state: request.state,
    questions: request.questions,
    facts: request.facts ?? false,
  };
  const raw = await postJson(endpoint, '/systemone', body, timeoutMs, request.signal);
  if (!raw.ok) return raw;
  const parsed = responseSchema.safeParse(raw.value);
  if (!parsed.success) return failure('invalid_response', z.prettifyError(parsed.error));
  const missing = Object.keys(request.questions).filter((name) => !(name in parsed.data.answers));
  if (missing.length > 0) {
    return failure('invalid_response', `No answer for: ${missing.join(', ')}`);
  }
  return { ok: true, value: parsed.data.answers };
}
