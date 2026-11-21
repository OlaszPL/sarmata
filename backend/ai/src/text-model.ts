import { z } from 'zod';
import { type AiEndpoint } from './config';
import { postJson, postStream } from './http';
import { type AiResult, failure } from './result';

/** What one streamed call has written so far. */
export interface GenerationProgress {
  /** The whole text of the completion so far (JSON the model is still writing). */
  readonly text: string;
  /** Output tokens so far: one per streamed piece, the server count at the end. */
  readonly outputTokens: number;
}

export interface ObjectRequest<S extends z.ZodType> {
  /** Name of the schema for the engine, e.g. `evaluation_draft`. */
  readonly schemaName: string;
  /** Plain data schema (no transforms), turned into JSON Schema for the engine. */
  readonly schema: S;
  readonly system: string;
  readonly prompt: string;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
  /**
   * Streams the completion (`stream: true`) and reports it piece by piece. The result is still
   * validated against the schema once the completion ends.
   */
  readonly onProgress?: (progress: GenerationProgress) => void;
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

const chatChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z.object({ content: z.string().nullish() }).nullish(),
        finish_reason: z.string().nullish(),
      }),
    )
    .nullish(),
  usage: z.object({ completion_tokens: z.number().int().nonnegative() }).nullish(),
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
  const completion = request.onProgress
    ? await streamCompletion(endpoint, timeoutMs, body, request.signal, request.onProgress)
    : await completeOnce(endpoint, timeoutMs, body, request.signal);
  if (!completion.ok) return completion;
  const { content, finishReason } = completion.value;
  if (!content) return failure('invalid_response', 'The completion is empty');
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return failure(
      'invalid_response',
      finishReason === 'length'
        ? `The completion hit the limit of ${maxTokens} tokens`
        : 'The completion is not JSON',
    );
  }
  const parsed = request.schema.safeParse(json);
  if (!parsed.success) return failure('invalid_response', z.prettifyError(parsed.error));
  return { ok: true, value: parsed.data };
}

interface Completion {
  readonly content: string | null;
  readonly finishReason: string | null;
}

async function completeOnce(
  endpoint: AiEndpoint,
  timeoutMs: number,
  body: object,
  signal: AbortSignal | undefined,
): Promise<AiResult<Completion>> {
  const raw = await postJson(endpoint, '/chat/completions', body, timeoutMs, signal);
  if (!raw.ok) return raw;
  const chat = chatResponseSchema.safeParse(raw.value);
  if (!chat.success) return failure('invalid_response', 'Unexpected chat completion shape');
  return {
    ok: true,
    value: {
      content: chat.data.choices[0]?.message.content ?? null,
      finishReason: chat.data.choices[0]?.finish_reason ?? null,
    },
  };
}

async function streamCompletion(
  endpoint: AiEndpoint,
  timeoutMs: number,
  body: object,
  signal: AbortSignal | undefined,
  onProgress: (progress: GenerationProgress) => void,
): Promise<AiResult<Completion>> {
  let content = '';
  let outputTokens = 0;
  let finishReason: string | null = null;
  const streamed = await postStream(
    endpoint,
    '/chat/completions',
    { ...body, stream: true, stream_options: { include_usage: true } },
    timeoutMs,
    signal,
    (event) => {
      const chunk = chatChunkSchema.safeParse(event);
      if (!chunk.success) return;
      const choice = chunk.data.choices?.[0];
      const delta = choice?.delta?.content ?? '';
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (delta !== '') {
        content += delta;
        outputTokens += 1;
      }
      if (chunk.data.usage) outputTokens = chunk.data.usage.completion_tokens;
      if (delta !== '' || chunk.data.usage) onProgress({ text: content, outputTokens });
    },
  );
  if (!streamed.ok) return streamed;
  return { ok: true, value: { content, finishReason } };
}
