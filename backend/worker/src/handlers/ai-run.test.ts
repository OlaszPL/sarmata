import { type AiRunner, createAi, createAiRunner } from '@sarmata/ai';
import { type FakeServer, modelReplies, startFakeServer } from '@sarmata/ai/testing';
import { type AiRunKind } from '@sarmata/domain';
import { type AiRunQueueStore } from '@sarmata/repositories';
import { afterEach, describe, expect, it } from 'vitest';
import { type JobContext } from '../job-handler';
import { createAiRunHandler } from './ai-run';

const RUN = '33333333-3333-4333-8333-333333333333';

type Outcome = Parameters<AiRunQueueStore['finish']>[1];

/** A run in memory: claimed once, then finished. */
class InMemoryStore implements AiRunQueueStore {
  status: 'queued' | 'running' | 'done' | 'failed' = 'queued';
  outcome: Outcome | null = null;
  failClaim = false;

  constructor(
    readonly kind: AiRunKind,
    readonly input: unknown,
    readonly aiEnabled = true,
  ) {}

  claim() {
    if (this.failClaim) return Promise.reject(new Error('database is down'));
    if (this.status !== 'queued') return Promise.resolve(null);
    this.status = 'running';
    return Promise.resolve({ kind: this.kind, input: this.input, aiEnabled: this.aiEnabled });
  }

  finish(_id: string, outcome: Outcome) {
    this.status = 'output' in outcome ? 'done' : 'failed';
    this.outcome = outcome;
    return Promise.resolve();
  }
}

let server: FakeServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function fakeRunner(replies: Parameters<typeof modelReplies>[0]): Promise<AiRunner> {
  server = await startFakeServer(modelReplies(replies));
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
  sheet_draft: {
    ratings: [
      {
        criterionId: 'communication',
        points: 7,
        sentences: [{ text: '12.03.2026 przekazał ustalenia.', noteIds: ['n1'] }],
      },
    ],
    justification: [],
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
    expect(store.status).toBe('done');
    expect(store.outcome).toMatchObject({
      promptVersion: 'sheet-draft.v1',
      output: { status: 'draft', ratings: [{ criterionId: 'communication', points: 7 }] },
    });
  });

  it('second delivery is skipped with one model request', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    const runner = await fakeRunner({ objects: draftReply });
    const handler = createAiRunHandler(() => ({ store, runner }));
    const second = context();
    await handler.run({ runId: RUN }, context());
    await handler.run({ runId: RUN }, second);
    expect(server?.requests).toHaveLength(1);
    expect(second.infos).toEqual(['ai run skipped']);
  });

  it('disabled office fails run without model request', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput, false);
    const runner = await fakeRunner({ objects: draftReply });
    await createAiRunHandler(() => ({ store, runner })).run({ runId: RUN }, context());
    expect(store.status).toBe('failed');
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
    expect(store.status).toBe('failed');
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

  it('invalid run id is invalid_payload', async () => {
    const store = new InMemoryStore('sheet_draft', draftInput);
    const runner = await fakeRunner({});
    const outcome = await createAiRunHandler(() => ({ store, runner })).run(
      { runId: 'not-a-uuid' },
      context(),
    );
    expect(outcome).toMatchObject({ status: 'invalid_payload' });
    expect(store.status).toBe('queued');
  });
});
