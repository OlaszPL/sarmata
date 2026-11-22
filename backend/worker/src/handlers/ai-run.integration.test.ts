import { createAi, createAiRunner } from '@sarmata/ai';
import { type FakeServer, modelReplies, promptOf, startFakeServer } from '@sarmata/ai/testing';
import { aiInputSchemas } from '@sarmata/domain';
import {
  type Database,
  type Db,
  createAiRunQueueStore,
  createAiRunRepository,
  createRepositories,
  createServiceClient,
} from '@sarmata/repositories';
import { type AiRun, servicesFor } from '@sarmata/services';
import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';
import { type JobContext } from '../job-handler';
import { createAiRunHandler } from './ai-run';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, run the tests with "pnpm test:integration"`);
  return value;
}

async function signedIn(email: string): Promise<Db> {
  const db: Db = createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db.auth.signInWithPassword({ email, password: 'Haslo-Demo-2026' });
  if (error) throw error;
  return db;
}

let server: FakeServer | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

const note = (id: string, body: string) => ({
  id,
  version: 1,
  kind: 'observation' as const,
  occurredOn: '2026-03-12',
  criterionId: null,
  sign: 'plus' as const,
  communicated: false,
  body,
});

const draftInput = aiInputSchemas.sheet_draft.parse({
  sheetId: 'C',
  criteria: [
    { id: 'communication', name: 'komunikacja', indicators: [] },
    { id: 'reliability', name: 'rzetelność', indicators: [] },
  ],
  scale: [1, 3, 5, 7, 9].map((points) => ({ points, name: `poziom ${points}` })),
  notes: [note('n1', 'Przekazał ustalenia zespołowi.'), note('n2', 'Oddał raport przed terminem.')],
});

const replies = {
  sheet_draft_criterion: (request: Parameters<typeof promptOf>[0]) =>
    promptOf(request).includes('Zadanie: kryterium communication')
      ? {
          sentences: [{ text: '12.03.2026 przekazał ustalenia zespołowi.', noteIds: ['N1'] }],
          points: 7,
        }
      : {
          sentences: [{ text: '12.03.2026 oddał raport przed terminem.', noteIds: ['N2'] }],
          points: 9,
        },
  sheet_draft_summary: {
    justification: [{ text: 'Terminowo i rzetelnie informuje zespół.', noteIds: ['N1', 'N2'] }],
    developmentConclusions: [],
    questions: ['Co pomogło dotrzymać terminu?'],
  },
};

const context = (): JobContext => ({
  signal: new AbortController().signal,
  logger: { info: () => undefined, error: () => undefined },
});

describe('ai.run through the worker with a streaming model', () => {
  it('the service shows the progress while the model streams, then the result', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const employee = (await createRepositories(evaluator).employees.list()).find(
      (candidate) => candidate.lastName === 'Merytoryczny',
    );
    if (employee === undefined) throw new Error('No demo employee Merytoryczny');
    const run = await createAiRunRepository(evaluator).create({
      kind: 'sheet_draft',
      employeeId: employee.id,
      evaluationId: null,
      input: draftInput,
      inputRefs: { noteIds: [], droppedNoteIds: [] },
    });

    // About 100 pieces 15 ms apart: a run of 1.5 s, progress written at most every 100 ms.
    server = await startFakeServer(modelReplies({ objects: replies }, { eventDelayMs: 15 }));
    const baseUrl = server.baseUrl;
    const runner = createAiRunner({
      ai: createAi({
        enabled: true,
        timeoutMs: 10_000,
        text: { baseUrl, model: 'bielik-test', apiKey: null },
        decision: null,
      }),
      legalSearch: { search: () => Promise.resolve({ ok: true, value: [] }) },
    });
    const store = createAiRunQueueStore(
      createServiceClient({ url: env('SUPABASE_URL'), secretKey: env('SUPABASE_SECRET_KEY') }),
    );
    const handler = createAiRunHandler(() => ({ store, runner, progressIntervalMs: 100 }));
    const services = servicesFor(evaluator);

    const seen: AiRun[] = [];
    const running = handler.run({ runId: run.id }, context());
    const state = { done: false };
    void running.finally(() => {
      state.done = true;
    });
    while (!state.done) {
      seen.push(await services.ai.get(run.id));
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    await running;

    const progress = seen.filter((entry) => entry.status === 'running' && entry.outputTokens);
    expect(progress.length).toBeGreaterThan(2);
    expect(progress.some((entry) => entry.partialText?.includes('12.03.2026'))).toBe(true);
    const withCriterion = progress.find(
      (entry) =>
        entry.kind === 'sheet_draft' &&
        (entry.partialOutput?.ratings ?? []).some((rating) => rating.sentences.length > 0),
    );
    expect(withCriterion?.partialOutput).toMatchObject({
      ratings: [{ criterionId: 'communication', sentences: [{ noteIds: ['n1'] }] }],
    });
    const tokens = progress.map((entry) => entry.outputTokens ?? 0);
    expect(tokens).toEqual([...tokens].sort((a, b) => a - b));

    const finished = await services.ai.get(run.id);
    expect(finished).toMatchObject({
      status: 'done',
      promptVersion: 'sheet-draft.v4',
      partialText: null,
      partialOutput: null,
      output: {
        status: 'draft',
        ratings: [
          { criterionId: 'communication', points: 7 },
          { criterionId: 'reliability', points: 9 },
        ],
        questions: ['Co pomogło dotrzymać terminu?'],
      },
    });
    expect(finished.outputTokens).toBeGreaterThanOrEqual(tokens.at(-1) ?? 1);
  });
});
