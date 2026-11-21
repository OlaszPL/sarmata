import { errorMessage } from '@sarmata/domain';
import { Agent, fetch } from 'undici';
import { type AiEndpoint } from './config';
import { type AiResult, failure } from './result';

/**
 * The call limit is `timeoutMs` alone. The defaults of undici (300 s for the response headers and 300 s
 * between body chunks) cut a long completion of a local model, which sends its headers only when the
 * whole answer is ready: a sheet draft on a 16 GB Mac ended as `unavailable: fetch failed` at 300 s.
 */
const dispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 });

const isTimeout = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'name' in error && error.name === 'TimeoutError';

/** POST with a JSON body. Maps network, timeout and HTTP errors to an `AiResult`. */
export async function postJson(
  endpoint: AiEndpoint,
  path: string,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<AiResult<unknown>> {
  const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])];
  let status: number;
  let text: string;
  try {
    const response = await fetch(`${endpoint.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(endpoint.apiKey === null ? {} : { authorization: `Bearer ${endpoint.apiKey}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
      dispatcher,
    });
    status = response.status;
    text = await response.text();
  } catch (error) {
    if (isTimeout(error)) return failure('timeout', `No answer within ${timeoutMs} ms`);
    return failure('unavailable', errorMessage(error));
  }
  if (status >= 400 && status < 500)
    return failure('rejected', `HTTP ${status}: ${text.slice(0, 500)}`);
  if (status >= 500) return failure('unavailable', `HTTP ${status}: ${text.slice(0, 500)}`);
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return failure('invalid_response', 'The response is not JSON');
  }
}
