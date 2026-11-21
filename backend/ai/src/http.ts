import { errorMessage } from '@sarmata/domain';
import { type AiEndpoint } from './config';
import { type AiResult, failure } from './result';

const isTimeout = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError';

const fetchFailure = (error: unknown, timeoutMs: number): AiResult<never> =>
  isTimeout(error)
    ? failure('timeout', `No answer within ${timeoutMs} ms`)
    : failure('unavailable', errorMessage(error));

/** POST with a JSON body. An HTTP error is read and mapped here, a success returns the response. */
async function post(
  endpoint: AiEndpoint,
  path: string,
  body: unknown,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<AiResult<Response>> {
  const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])];
  let response: Response;
  try {
    response = await fetch(`${endpoint.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(endpoint.apiKey === null ? {} : { authorization: `Bearer ${endpoint.apiKey}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
  } catch (error) {
    return fetchFailure(error, timeoutMs);
  }
  if (response.status < 400) return { ok: true, value: response };
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    return fetchFailure(error, timeoutMs);
  }
  const detail = `HTTP ${response.status}: ${text.slice(0, 500)}`;
  return failure(response.status < 500 ? 'rejected' : 'unavailable', detail);
}

/** POST with a JSON body. Maps network, timeout and HTTP errors to an `AiResult`. */
export async function postJson(
  endpoint: AiEndpoint,
  path: string,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<AiResult<unknown>> {
  const response = await post(endpoint, path, body, timeoutMs, signal);
  if (!response.ok) return response;
  let text: string;
  try {
    text = await response.value.text();
  } catch (error) {
    return fetchFailure(error, timeoutMs);
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return failure('invalid_response', 'The response is not JSON');
  }
}

/**
 * POST that answers with server-sent events (`stream: true` of the OpenAI API). Calls `onEvent` with
 * every `data:` event as JSON until `[DONE]` or the end of the body. The time limit covers the whole
 * stream. An `error` event (llama-server reports a failure mid-stream this way) ends it as
 * `unavailable`.
 */
export async function postStream(
  endpoint: AiEndpoint,
  path: string,
  body: unknown,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  onEvent: (data: unknown) => void,
): Promise<AiResult<void>> {
  const response = await post(endpoint, path, body, timeoutMs, signal);
  if (!response.ok) return response;
  const stream = response.value.body;
  if (stream === null) return failure('invalid_response', 'The response has no body');
  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (let end = buffer.indexOf('\n'); end !== -1; end = buffer.indexOf('\n')) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice('data:'.length).trim();
        if (data === '[DONE]') return { ok: true, value: undefined };
        let event: unknown;
        try {
          event = JSON.parse(data);
        } catch {
          return failure('invalid_response', 'A stream event is not JSON');
        }
        if (typeof event === 'object' && event !== null && 'error' in event) {
          return failure(
            'unavailable',
            `Stream error: ${JSON.stringify(event.error).slice(0, 500)}`,
          );
        }
        onEvent(event);
      }
    }
  } catch (error) {
    return fetchFailure(error, timeoutMs);
  }
  return { ok: true, value: undefined };
}
