import { SMOKE_DECISION } from './bielik-one.ts';
import { isLlamaServerReady } from './llama-server.ts';

/** The outcome of one endpoint check. `detail` is for the terminal, in Polish. */
export type SmokeResult =
  | { status: 'ok'; latencyMs: number; detail: string }
  | { status: 'not-running'; detail: string }
  | { status: 'failed'; detail: string };

const TEXT_PROMPT =
  'Odpowiedz jednym krótkim zdaniem po polsku: czym jest ocena okresowa urzędnika?';
const ANSWER_TIMEOUT_MS = 120_000;

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; latencyMs: number }> {
  const started = performance.now();
  const value = await work();
  return { value, latencyMs: Math.round(performance.now() - started) };
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** A short Polish completion from the text model behind an OpenAI-compatible `/v1` base URL. */
export async function smokeText(baseUrl: string, model: string): Promise<SmokeResult> {
  if (!(await isLlamaServerReady(baseUrl))) {
    return { status: 'not-running', detail: `nic nie odpowiada pod ${baseUrl}` };
  }
  try {
    const { value: response, latencyMs } = await timed(() =>
      fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: TEXT_PROMPT }],
          max_tokens: 64,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
      }),
    );
    if (!response.ok) return { status: 'failed', detail: `HTTP ${response.status}` };
    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      return { status: 'failed', detail: 'pusta odpowiedź modelu' };
    }
    return { status: 'ok', latencyMs, detail: content.trim().replace(/\s+/g, ' ').slice(0, 160) };
  } catch (error) {
    return { status: 'failed', detail: describeError(error) };
  }
}

/** One yes/no decision from the Bielik-One frontend (`/health`, then `/v1/systemone`). */
export async function smokeDecision(url: string): Promise<SmokeResult> {
  let health: Response;
  try {
    health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
  } catch {
    return { status: 'not-running', detail: `nic nie odpowiada pod ${url}` };
  }
  const state = (await health.json().catch(() => ({}))) as {
    status?: unknown;
    calibrated?: unknown;
  };
  if (!health.ok || state.status !== 'ok') {
    return {
      status: 'failed',
      detail: `frontend odpowiada, ale nie jest gotowy (HTTP ${health.status}), backend może jeszcze ładować model`,
    };
  }
  try {
    const { value: response, latencyMs } = await timed(() =>
      fetch(`${url}/v1/systemone`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(SMOKE_DECISION),
        signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
      }),
    );
    if (!response.ok) return { status: 'failed', detail: `HTTP ${response.status}` };
    const body = (await response.json()) as {
      answers?: Record<string, { probabilities?: Record<string, unknown> }>;
    };
    const yes = body.answers?.filed?.probabilities?.true;
    if (typeof yes !== 'number') {
      return { status: 'failed', detail: 'odpowiedź bez prawdopodobieństwa dla pytania filed' };
    }
    return {
      status: 'ok',
      latencyMs,
      detail: `„${SMOKE_DECISION.questions.filed.instructions}” tak z p=${yes.toFixed(3)}`,
    };
  } catch (error) {
    return { status: 'failed', detail: describeError(error) };
  }
}
