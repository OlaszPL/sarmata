import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type FakeReply, type FakeServer, completionEvents, startFakeServer } from './fake-server';
import { type AiConfig, aiConfigFromEnv, createAi } from './index';
import { legalSearchConfigFromEnv } from './config';

let server: FakeServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function serve(reply: () => FakeReply): Promise<FakeServer> {
  server = await startFakeServer(reply);
  return server;
}

const config = (baseUrl: string, overrides: Partial<AiConfig> = {}): AiConfig => ({
  enabled: true,
  timeoutMs: 2_000,
  text: { baseUrl, model: 'bielik-test', apiKey: 'secret' },
  decision: { baseUrl, model: 'decision', apiKey: null },
  ...overrides,
});

const draftSchema = z.object({ summary: z.string(), level: z.enum(['meets', 'above']) });

const completion = (content: string): FakeReply => ({
  status: 200,
  body: { choices: [{ message: { role: 'assistant', content } }] },
});

const request = {
  schemaName: 'evaluation_draft',
  schema: draftSchema,
  system: 'Jesteś asystentem oceniającego.',
  prompt: 'Przygotuj szkic.',
};

describe('generateObject', () => {
  it('sends a chat completion with the JSON schema and returns the validated object', async () => {
    const fake = await serve(() => completion('{"summary":"Terminowo.","level":"above"}'));
    const result = await createAi(config(fake.baseUrl)).generateObject(request);
    expect(result).toEqual({ ok: true, value: { summary: 'Terminowo.', level: 'above' } });
    const sent = fake.requests[0];
    expect(sent?.url).toBe('/v1/chat/completions');
    expect(sent?.headers.authorization).toBe('Bearer secret');
    expect(sent?.body).toMatchObject({
      model: 'bielik-test',
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'evaluation_draft',
          strict: true,
          schema: z.toJSONSchema(draftSchema),
        },
      },
    });
  });

  it('rejects output that does not match the schema', async () => {
    const fake = await serve(() => completion('{"summary":"Terminowo.","level":"heroic"}'));
    const result = await createAi(config(fake.baseUrl)).generateObject(request);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_response' });
  });

  it('rejects output that is not JSON', async () => {
    const fake = await serve(() => completion('Oto szkic oceny.'));
    const result = await createAi(config(fake.baseUrl)).generateObject(request);
    expect(result).toMatchObject({ ok: false, reason: 'invalid_response' });
  });

  it('names the token limit when the completion was cut', async () => {
    const fake = await serve(() => ({
      status: 200,
      body: {
        choices: [
          { message: { role: 'assistant', content: '{"summary":"Termi' }, finish_reason: 'length' },
        ],
      },
    }));
    const result = await createAi(config(fake.baseUrl)).generateObject({
      ...request,
      maxTokens: 64,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'invalid_response',
      message: 'The completion hit the limit of 64 tokens',
    });
  });

  it.each([
    [503, 'unavailable'],
    [400, 'rejected'],
  ])('maps HTTP %i to %s', async (status, reason) => {
    const fake = await serve(() => ({ status, body: { error: 'nope' } }));
    const result = await createAi(config(fake.baseUrl)).generateObject(request);
    expect(result).toMatchObject({ ok: false, reason });
  });

  it('gives up after the timeout', async () => {
    const fake = await serve(() => ({ ...completion('{}'), delayMs: 500 }));
    const result = await createAi(config(fake.baseUrl, { timeoutMs: 50 })).generateObject(request);
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('a long task waits for the long limit', async () => {
    const fake = await serve(() => ({
      ...completion('{"summary":"Szkic.","level":"meets"}'),
      delayMs: 200,
    }));
    const ai = createAi(config(fake.baseUrl, { timeoutMs: 50, longTimeoutMs: 2_000 }));
    expect(await ai.generateObject(request)).toMatchObject({ ok: false, reason: 'timeout' });
    expect((await ai.long.generateObject(request)).ok).toBe(true);
    expect(ai.long.long).toBe(ai.long);
  });

  it('does not call the model when AI is disabled', async () => {
    const fake = await serve(() => completion('{}'));
    const ai = createAi(config(fake.baseUrl, { enabled: false }));
    expect(ai.available).toEqual({ text: false, decision: false });
    expect(await ai.generateObject(request)).toMatchObject({ ok: false, reason: 'disabled' });
    expect(fake.requests).toHaveLength(0);
  });
});

describe('generateObject with streaming', () => {
  const streamed = (content: string, options: Parameters<typeof completionEvents>[1] = {}) =>
    ({ status: 200, body: null, events: completionEvents(content, options) }) satisfies FakeReply;

  it('streams the completion, reports every piece and validates the end result', async () => {
    const fake = await serve(() => streamed('{"summary":"Terminowo.","level":"above"}'));
    const progress: { text: string; outputTokens: number }[] = [];
    const result = await createAi(config(fake.baseUrl)).generateObject({
      ...request,
      onProgress: (update) => progress.push(update),
    });
    expect(result).toEqual({ ok: true, value: { summary: 'Terminowo.', level: 'above' } });
    expect(fake.requests[0]?.body).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
    });
    expect(progress[0]).toEqual({ text: '{"su', outputTokens: 1 });
    expect(progress.at(-1)).toEqual({
      text: '{"summary":"Terminowo.","level":"above"}',
      outputTokens: 10,
    });
  });

  it('rejects a streamed completion that does not match the schema', async () => {
    const fake = await serve(() => streamed('{"summary":"Terminowo.","level":"heroic"}'));
    const result = await createAi(config(fake.baseUrl)).generateObject({
      ...request,
      onProgress: () => undefined,
    });
    expect(result).toMatchObject({ ok: false, reason: 'invalid_response' });
  });

  it('names a completion cut at max_tokens', async () => {
    const fake = await serve(() => streamed('{"summary":"Termi', { finishReason: 'length' }));
    const result = await createAi(config(fake.baseUrl)).generateObject({
      ...request,
      onProgress: () => undefined,
    });
    expect(result).toMatchObject({ ok: false, reason: 'invalid_response' });
    expect(!result.ok && result.message).toContain('hit the limit');
  });

  it('fails as unavailable on an error event mid-stream', async () => {
    const fake = await serve(() => ({
      status: 200,
      body: null,
      events: [
        { choices: [{ index: 0, delta: { content: '{"sum' }, finish_reason: null }] },
        { error: { code: 500, message: 'slot unavailable' } },
      ],
    }));
    const result = await createAi(config(fake.baseUrl)).generateObject({
      ...request,
      onProgress: () => undefined,
    });
    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('gives up when the whole stream takes longer than the limit', async () => {
    const fake = await serve(() => ({
      ...streamed('{"summary":"Terminowo.","level":"above"}'),
      eventDelayMs: 30,
    }));
    const result = await createAi(config(fake.baseUrl, { timeoutMs: 100 })).generateObject({
      ...request,
      onProgress: () => undefined,
    });
    expect(result).toMatchObject({ ok: false, reason: 'timeout' });
  });
});

describe('decide (Bielik-One /v1/systemone)', () => {
  const questions = {
    overload: {
      type: 'noul',
      instructions: 'Czy notatki wskazują na przeciążenie pracą?',
      criteria: { true: 'Tak', false: 'Nie' },
    },
    tone: {
      type: 'choice',
      instructions: 'Jaki jest wydźwięk notatek?',
      criteria: { positive: 'Pozytywny', neutral: 'Neutralny', negative: 'Negatywny' },
    },
    engagement: {
      type: 'score',
      instructions: 'Jak oceniasz zaangażowanie?',
      criteria: ['niskie', 'średnie', 'wysokie'],
    },
    signals: {
      type: 'labels',
      instructions: 'Które sygnały występują?',
      criteria: { overtime: 'Nadgodziny', conflict: 'Konflikt' },
    },
  } as const;

  const answers = {
    overload: {
      type: 'noul',
      noul: 0.82,
      probabilities: { true: 0.82, false: 0.18 },
      confidence: 0.64,
    },
    tone: {
      type: 'choice',
      choice: 'neutral',
      probabilities: { positive: 0.2, neutral: 0.7, negative: 0.1 },
      confidence: 0.55,
    },
    engagement: {
      type: 'score',
      score: 1.4,
      legend: { '0': 'niskie', '1': 'średnie', '2': 'wysokie' },
      probabilities: { '0': 0.1, '1': 0.4, '2': 0.5 },
      confidence: 0.3,
    },
    signals: {
      type: 'labels',
      probabilities: { overtime: 0.9, conflict: 0.2 },
      selected: ['overtime'],
      confidence: 0.72,
    },
  };

  it('posts typed questions and returns the answers', async () => {
    const fake = await serve(() => ({
      status: 200,
      body: { model: 'decision', answers, usage: { input_tokens: 120, output_tokens: 4 } },
    }));
    const state = 'Notatki: 12.10 nadgodziny, 20.10 nadgodziny, 3.11 odwołane szkolenie.';
    const result = await createAi(config(fake.baseUrl)).decide({ state, questions, facts: true });
    expect(result).toEqual({ ok: true, value: answers });
    expect(fake.requests[0]?.url).toBe('/v1/systemone');
    expect(fake.requests[0]?.headers.authorization).toBeUndefined();
    expect(fake.requests[0]?.body).toEqual({ model: 'decision', state, questions, facts: true });
  });

  it('rejects a response without an answer for every question', async () => {
    const fake = await serve(() => ({
      status: 200,
      body: { model: 'decision', answers: { overload: answers.overload } },
    }));
    const result = await createAi(config(fake.baseUrl)).decide({ state: 'x', questions });
    expect(result).toMatchObject({ ok: false, reason: 'invalid_response' });
  });

  it('reports an invalid request from the server', async () => {
    const fake = await serve(() => ({
      status: 422,
      body: { error: 'questions.tone.criteria must be a map', code: 'INVALID_REQUEST' },
    }));
    const result = await createAi(config(fake.baseUrl)).decide({ state: 'x', questions });
    expect(result).toMatchObject({ ok: false, reason: 'rejected' });
    if (!result.ok) expect(result.message).toContain('INVALID_REQUEST');
  });

  it('is disabled when Bielik-One is not configured', async () => {
    const ai = createAi({ enabled: true, timeoutMs: 1_000, text: null, decision: null });
    expect(await ai.decide({ state: 'x', questions })).toMatchObject({
      ok: false,
      reason: 'disabled',
    });
  });
});

describe('decide without Bielik-One (text model fallback)', () => {
  const questions = {
    overload: { type: 'noul', instructions: 'Czy jest przeciążenie?' },
    tone: {
      type: 'choice',
      instructions: 'Jaki wydźwięk?',
      criteria: { positive: 'Pozytywny', negative: 'Negatywny' },
    },
    engagement: {
      type: 'score',
      instructions: 'Jak oceniasz zaangażowanie?',
      criteria: ['niskie', 'średnie', 'wysokie'],
    },
    signals: {
      type: 'labels',
      instructions: 'Które sygnały?',
      criteria: { overtime: 'Nadgodziny', conflict: 'Konflikt' },
    },
  } as const;

  const modelAnswer = {
    overload: { value: true, confidence: 0.8 },
    tone: { choice: 'positive', confidence: 0.6 },
    engagement: { score: 2, confidence: 0.5 },
    signals: { selected: ['overtime'], confidence: 0.7 },
  };

  const textOnly = (baseUrl: string): AiConfig => config(baseUrl, { decision: null });

  it('asks the text model with a forced schema and returns the Bielik-One result type', async () => {
    const fake = await serve(() => completion(JSON.stringify(modelAnswer)));
    const ai = createAi(textOnly(fake.baseUrl));
    expect(ai.available.decision).toBe(true);
    const result = await ai.decide({ state: 'Notatki: nadgodziny.', questions });
    expect(result).toEqual({
      ok: true,
      value: {
        overload: {
          type: 'noul',
          noul: 1,
          probabilities: { true: 1, false: 0 },
          confidence: 0.8,
          fallback: true,
        },
        tone: {
          type: 'choice',
          choice: 'positive',
          probabilities: { positive: 1, negative: 0 },
          confidence: 0.6,
          fallback: true,
        },
        engagement: {
          type: 'score',
          score: 2,
          legend: { '0': 'niskie', '1': 'średnie', '2': 'wysokie' },
          probabilities: { '0': 0, '1': 0, '2': 1 },
          confidence: 0.5,
          fallback: true,
        },
        signals: {
          type: 'labels',
          selected: ['overtime'],
          probabilities: { overtime: 1, conflict: 0 },
          confidence: 0.7,
          fallback: true,
        },
      },
    });
    const sent = fake.requests[0];
    expect(sent?.url).toBe('/v1/chat/completions');
    expect(sent?.body).toMatchObject({
      response_format: { type: 'json_schema', json_schema: { strict: true } },
    });
    expect(JSON.stringify(sent?.body)).toContain('Notatki: nadgodziny.');
    expect(JSON.stringify(sent?.body)).toContain('Czy jest przeciążenie?');
  });

  it('prefers Bielik-One when it is configured', async () => {
    const fake = await serve(() => ({ status: 200, body: { answers: {} } }));
    await createAi(config(fake.baseUrl)).decide({ state: 'x', questions: {} });
    expect(fake.requests[0]?.url).toBe('/v1/systemone');
  });

  it('rejects a choice outside the criteria', async () => {
    const fake = await serve(() =>
      completion(JSON.stringify({ ...modelAnswer, tone: { choice: 'angry', confidence: 1 } })),
    );
    const result = await createAi(textOnly(fake.baseUrl)).decide({ state: 'x', questions });
    expect(result).toMatchObject({ ok: false, reason: 'invalid_response' });
  });

  it('rejects an empty question list without calling the model', async () => {
    const fake = await serve(() => completion('{}'));
    const result = await createAi(textOnly(fake.baseUrl)).decide({ state: 'x', questions: {} });
    expect(result).toMatchObject({ ok: false, reason: 'rejected' });
    expect(fake.requests).toHaveLength(0);
  });
});

describe('aiConfigFromEnv', () => {
  it('turns AI off by default', () => {
    expect(aiConfigFromEnv({})).toEqual({
      enabled: false,
      timeoutMs: 120_000,
      longTimeoutMs: 600_000,
      text: null,
      decision: null,
    });
  });

  it('reads endpoints, trims trailing slashes and ignores empty variables', () => {
    expect(
      aiConfigFromEnv({
        SARMATA_AI_ENABLED: 'true',
        SARMATA_AI_TIMEOUT_MS: '30000',
        SARMATA_AI_TEXT_BASE_URL: 'http://127.0.0.1:8080/v1/',
        SARMATA_AI_TEXT_MODEL: 'bielik-11b-v3.1',
        SARMATA_AI_TEXT_API_KEY: '',
        SARMATA_AI_DECISION_BASE_URL: 'http://127.0.0.1:8026/v1',
      }),
    ).toEqual({
      enabled: true,
      timeoutMs: 30_000,
      longTimeoutMs: 600_000,
      text: { baseUrl: 'http://127.0.0.1:8080/v1', model: 'bielik-11b-v3.1', apiKey: null },
      decision: { baseUrl: 'http://127.0.0.1:8026/v1', model: 'decision', apiKey: null },
    });
  });

  it('gives semble a cold start limit of its own', () => {
    expect(legalSearchConfigFromEnv({}).timeoutMs).toBe(300_000);
    expect(legalSearchConfigFromEnv({ SARMATA_SEMBLE_TIMEOUT_MS: '1000' }).timeoutMs).toBe(1_000);
  });

  it('rejects a malformed URL', () => {
    expect(() => aiConfigFromEnv({ SARMATA_AI_TEXT_BASE_URL: 'localhost:8080' })).toThrow(
      /Invalid AI configuration/,
    );
  });
});
