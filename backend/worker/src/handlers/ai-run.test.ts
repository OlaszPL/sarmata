import { type AiRunner, createAi, createAiRunner } from '@sarmata/ai';
import {
  type FakeServer,
  type StreamOptions,
  modelReplies,
  startFakeServer,
} from '@sarmata/ai/testing';
import { type AiRunKind } from '@sarmata/domain';
import { type AiRunProgressUpdate, type AiRunQueueStore } from '@sarmata/repositories';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type JobContext } from '../job-handler';
import { STALE_AFTER_MS, createAiRunHandler } from './ai-run';
import { createProgressWriter } from './ai-run-progress';

const RUN = '33333333-3333-4333-8333-333333333333';

type Outcome = Parameters<AiRunQueueStore['finish']>[1];

/** A run in memory: claimed once, then finished. Keeps every progress write. */
class InMemoryStore implements AiRunQueueStore {
  state: 'queued' | 'running' | 'done' | 'failed' = 'queued';
  outcome: Outcome | null = null;
  failClaim = false;
  progressWrites: AiRunProgressUpdate[] = [];

  constructor(
    readonly kind: AiRunKind,
    readonly input: unknown,
    readonly aiEnabled = true,
  ) {}

  claim() {
    if (this.failClaim) return Promise.reject(new Error('database is down'));
    if (this.state !== 'queued') return Promise.resolve(null);
    this.state = 'running';
    return Promise.resolve({ kind: this.kind, input: this.input, aiEnabled: this.aiEnabled });
  }

  status() {
    return Promise.resolve(this.state);
  }

  progress(_id: string, update: AiRunProgressUpdate) {
    if (this.state === 'running') this.progressWrites.push(update);
    return Promise.resolve();
  }

  finish(_id: string, outcome: Outcome) {
    this.state = 'output' in outcome ? 'done' : 'failed';
    this.outcome = outcome;
    return Promise.resolve();
  }
}

let server: FakeServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function fakeRunner(
  replies: Parameters<typeof modelReplies>[0],
  stream: StreamOptions = {},
): Promise<AiRunner> {
  server = await startFakeServer(modelReplies(replies, stream));
  const baseUrl = server.baseUrl;
  return createAiRunner({
    ai: createAi({
      enabled: true,
      timeoutMs: 2_000,
      text: { baseUrl, model: 'bielik-test', apiKey: null },
      decision: null,
    }),
    legalSearch: { search: () => Promise.resolve({ ok: true, value: [] }) },
  });
}

const context = (): JobContext & { infos: string[] } => {
  const infos: string[] = [];
  return {
    infos,
    signal: new AbortController().signal,
    logger: {
      info: (message) => infos.push(message),
      error: (message) => infos.push(message),
    },
  };
};

const draftInput = {
  sheetId: 'C',
  criteria: [{ id: 'communication', name: 'komunikacja', indicators: [] }],
  scale: [1, 3, 5, 7, 9].map((points) => ({ points, name: `poziom ${points}` })),
  notes: [
    {
      id: 'n1',
      version: 1,
      kind: 'observation',
      occurredOn: '2026-03-12',
      criterionId: 'communication',
      sign: 'plus',
      communicated: false,
      body: 'Przekazał ustalenia zespołowi.',
    },
  ],
};

const draftReply = {
  sheet_draft_criterion: {
    sentences: [{ text: '12.03.2026 przekazał ustalenia.', noteIds: ['N1'] }],
    points: 7,
  },
  sheet_draft_summary: {
    justification: [{ text: 'Rzetelnie informuje zespół.', noteIds: ['N1'] }],
    developmentConclusions: [],
    questions: [],
  },
};

describe('ai.run handler', () => {
  it('ai.run completes sheet draft against fake server', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    const handler = createAiRunHandler(() => ({ store, runner }));
    const runner = await fakeRunner({ objects: draftReply });
    expect(await handler.run({ runId: RUN }, context())).toEqual({ status: 'done' });
    expect(store.state).toBe('done');
    expect(store.outcome).toMatchObject({
      promptVersion: 'sheet-draft.v3',
      output: { status: 'draft', ratings: [{ criterionId: 'communication', points: 7 }] },
    });
  });

  it('writes throttled progress while the model streams and keeps the token count', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    // About 60 pieces 10 ms apart: a run of over half a second, written at most every 200 ms.
    const runner = await fakeRunner({ objects: draftReply }, { eventDelayMs: 10 });
    const handler = createAiRunHandler(() => ({ store, runner, progressIntervalMs: 200 }));
    await handler.run({ runId: RUN }, context());
    const writes = store.progressWrites;
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(writes.length).toBeLessThanOrEqual(6);
    expect(writes.some((write) => write.partialText.includes('12.03.2026'))).toBe(true);
    const tokens = writes.map((write) => write.outputTokens);
    expect(tokens).toEqual([...tokens].sort((a, b) => a - b));
    const total = (store.outcome as { outputTokens?: number } | null)?.outputTokens ?? 0;
    expect(total).toBeGreaterThanOrEqual(tokens.at(-1) ?? 0);
  });

  it('second delivery is skipped with no new model request', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    const runner = await fakeRunner({ objects: draftReply });
    const handler = createAiRunHandler(() => ({ store, runner }));
    const second = context();
    await handler.run({ runId: RUN }, context());
    await handler.run({ runId: RUN }, second);
    // One criterion and the summary of the first delivery.
    expect(server?.requests).toHaveLength(2);
    expect(second.infos).toEqual(['ai run skipped']);
  });

  it('disabled office fails run without model request', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput, false);
    const runner = await fakeRunner({ objects: draftReply });
    await createAiRunHandler(() => ({ store, runner })).run({ runId: RUN }, context());
    expect(store.state).toBe('failed');
    expect(store.outcome).toMatchObject({ failure: { reason: 'disabled' } });
    expect(server?.requests).toEqual([]);
  });

  it('model failure finishes run as failed without throwing', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    const runner = await fakeRunner({});
    const outcome = await createAiRunHandler(() => ({ store, runner })).run(
      { runId: RUN },
      context(),
    );
    expect(outcome).toEqual({ status: 'done' });
    expect(store.state).toBe('failed');
    expect(store.outcome).toMatchObject({ failure: { reason: 'unavailable' } });
  });

  it('store error is thrown for retry', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    store.failClaim = true;
    const runner = await fakeRunner({});
    await expect(
      createAiRunHandler(() => ({ store, runner })).run({ runId: RUN }, context()),
    ).rejects.toThrow('database is down');
  });

  it('shutdown during a run finishes it as interrupted', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    const runner = await fakeRunner({ objects: draftReply });
    const controller = new AbortController();
    const shutdown = { ...context(), signal: controller.signal };
    const execute = runner.execute.bind(runner);
    const stopping: AiRunner = {
      execute: (run, options) => {
        controller.abort();
        return execute(run, options);
      },
    };
    const outcome = await createAiRunHandler(() => ({ store, runner: stopping })).run(
      { runId: RUN },
      shutdown,
    );
    expect(outcome).toEqual({ status: 'done' });
    expect(store.state).toBe('failed');
    expect(store.outcome).toMatchObject({ failure: { reason: 'interrupted' } });
  });

  it('a run still running elsewhere throws so the job comes back', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    store.state = 'running';
    const runner = await fakeRunner({ objects: draftReply });
    await expect(
      createAiRunHandler(() => ({ store, runner })).run({ runId: RUN }, context()),
    ).rejects.toThrow('running elsewhere');
    expect(server?.requests).toEqual([]);
  });

  it('stale threshold is shorter than the queue retry window', () => {
    // runWorker: 5 deliveries, 60 s visibility timeout.
    expect(STALE_AFTER_MS).toBeLessThan(5 * 60_000 - 60_000);
  });

  it('progress writer sends the first state at once, then the latest one per interval', async () => {
    vi.useFakeTimers();
    try {
      const writes: AiRunProgressUpdate[] = [];
      const store = {
        progress: (_id: string, update: AiRunProgressUpdate) => {
          writes.push(update);
          return Promise.resolve();
        },
      };
      const writer = createProgressWriter(store, RUN, context().logger, 1_000);
      const state = (outputTokens: number) => ({ text: 'x', outputTokens, partialOutput: null });
      writer.update(state(1));
      await vi.advanceTimersByTimeAsync(0);
      for (let tokens = 2; tokens <= 30; tokens += 1) {
        writer.update(state(tokens));
        await vi.advanceTimersByTimeAsync(100);
      }
      await writer.stop();
      // The state pending at stop is not written: finish stores the final token count.
      expect(writes.map((write) => write.outputTokens)).toEqual([1, 11, 21]);
      expect(writer.outputTokens).toBe(30);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a failed progress write is logged and the run goes on', async () => {
    const ctx = context();
    const writer = createProgressWriter(
      { progress: () => Promise.reject(new Error('database is down')) },
      RUN,
      ctx.logger,
    );
    writer.update({ text: '{', outputTokens: 1, partialOutput: null });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await writer.stop();
    expect(ctx.infos).toEqual(['ai run progress not stored']);
  });

  it('invalid run id is invalid_payload', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    const runner = await fakeRunner({});
    const outcome = await createAiRunHandler(() => ({ store, runner })).run(
      { runId: 'not-a-uuid' },
      context(),
    );
    expect(outcome).toMatchObject({ status: 'invalid_payload' });
    expect(store.state).toBe('queued');
  });
});
