import { type z } from 'zod';
import { type AiConfig } from './config';
import { type DecisionAnswers, type DecisionRequest, decide } from './decision';
import { decideWithTextModel } from './decision-fallback';
import { type AiResult, failure } from './result';
import { type ObjectRequest, generateObject } from './text-model';

export interface Ai {
  /** What can answer now. Services use it to hide AI features instead of calling and failing. */
  readonly available: { readonly text: boolean; readonly decision: boolean };
  /** Names of the configured models, null when not configured. */
  readonly models: { readonly text: string | null; readonly decision: string | null };
  generateObject<S extends z.ZodType>(request: ObjectRequest<S>): Promise<AiResult<z.output<S>>>;
  decide(request: DecisionRequest): Promise<AiResult<DecisionAnswers>>;
  /** The same models with the limit of a long task (`AiConfig.longTimeoutMs`). */
  readonly long: Ai;
}

export function createAi(config: AiConfig): Ai {
  const text = config.enabled ? config.text : null;
  const decision = config.enabled ? config.decision : null;
  const withLimit = (timeoutMs: number, long: () => Ai): Ai => ({
    // Decisions fall back to the text model where Bielik-One cannot run (ADR 0005).
    available: { text: text !== null, decision: decision !== null || text !== null },
    models: { text: text?.model ?? null, decision: decision?.model ?? null },
    generateObject: (request) =>
      text === null
        ? Promise.resolve(failure('disabled', 'AI is disabled or the text model is not configured'))
        : generateObject(text, timeoutMs, request),
    decide: (request) => {
      if (decision !== null) return decide(decision, timeoutMs, request);
      if (text !== null) return decideWithTextModel(text, timeoutMs, request);
      return Promise.resolve(failure('disabled', 'AI is disabled or no model is configured'));
    },
    get long() {
      return long();
    },
  });
  const longAi: Ai = withLimit(config.longTimeoutMs ?? config.timeoutMs, () => longAi);
  return withLimit(config.timeoutMs, () => longAi);
}
