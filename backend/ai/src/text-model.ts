import { z } from 'zod';
import { type AiEndpoint } from './config';
import { postJson } from './http';
import { type AiResult, failure } from './result';

export interface ObjectRequest<S extends z.ZodType> {
  /** Name of the schema for the engine, e.g. `evaluation_draft`. */
  readonly schemaName: string;
  /** Plain data schema (no transforms), turned into JSON Schema for the engine. */
  readonly schema: S;
  readonly system: string;
  readonly prompt: string;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
}

const chatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().nullable() }),
        finish_reason: z.string().nullish(),
      }),
    )
    .min(1),
});

export async function generateObject<S extends z.ZodType>(
  endpoint: AiEndpoint,
  timeoutMs: number,
  request: ObjectRequest<S>,
): Promise<AiResult<z.output<S>>> {
  const maxTokens = request.maxTokens ?? 2048;
  const body = {
    model: endpoint.model,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: request.schemaName,
        strict: true,
        schema: z.toJSONSchema(request.schema),
      },
    },
    max_tokens: maxTokens,
    temperature: 0,
  };
  const raw = await postJson(endpoint, '/chat/completions', body, timeoutMs, request.signal);
  if (!raw.ok) return raw;
  const chat = chatResponseSchema.safeParse(raw.value);
  if (!chat.success) return failure('invalid_response', 'Unexpected chat completion shape');
  const choice = chat.data.choices[0];
  // Cut JSON would only fail to parse: say why, so the token budget of the task can be raised.
  if (choice?.finish_reason === 'length') {
    return failure('invalid_response', `The completion hit the limit of ${maxTokens} tokens`);
  }
  const content = choice?.message.content;
  if (!content) return failure('invalid_response', 'The completion is empty');
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return failure('invalid_response', 'The completion is not JSON');
  }
  const parsed = request.schema.safeParse(json);
  if (!parsed.success) return failure('invalid_response', z.prettifyError(parsed.error));
  return { ok: true, value: parsed.data };
}
