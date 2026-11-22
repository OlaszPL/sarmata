import type { Database } from '@sarmata/database';
import { type AiInput, DEFAULT_APPRECIATION_GAP_DAYS } from '@sarmata/domain';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  type Db,
  type ServiceDb,
  createAiRunQueueStore,
  createAiRunRepository,
  createJobQueue,
  createOfficeSettingsRepository,
  createRepositories,
  createServiceClient,
  RepositoryError,
} from './index';

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

const serviceClient = (): ServiceDb =>
  createServiceClient({ url: env('SUPABASE_URL'), secretKey: env('SUPABASE_SECRET_KEY') });

async function employeeId(db: Db, lastName: string): Promise<string> {
  const employee = (await createRepositories(db).employees.list()).find(
    (e) => e.lastName === lastName,
  );
  if (employee === undefined) throw new Error(`No demo employee ${lastName}`);
  return employee.id;
}

const signalsInput: AiInput<'hr_signals'> = { notes: [], pastRatings: [] };

async function requestSignals(db: Db) {
  const marek = await employeeId(db, 'Merytoryczny');
  return createAiRunRepository(db).create({
    kind: 'hr_signals',
    employeeId: marek,
    evaluationId: null,
    input: signalsInput,
    inputRefs: { noteIds: [], droppedNoteIds: [] },
  });
}

const signalsOutput = {
  signals: [{ signal: 'overload', present: true, probability: 0.8, fragments: [] }],
  questions: ['Które zadania można przesunąć?'],
  actions: [],
};

describe('ai runs', () => {
  it('evaluator requests run and hr reads it', async () => {
    const run = await requestSignals(await signedIn('oceniajacy@kropka.test'));
    expect(run).toMatchObject({
      kind: 'hr_signals',
      status: 'queued',
      output: null,
      decisions: [],
      inputRefs: { noteIds: [], droppedNoteIds: [] },
    });
    const hr = createAiRunRepository(await signedIn('kadry@kropka.test'));
    expect((await hr.get(run.id))?.id).toBe(run.id);
    expect((await hr.list({ kind: 'hr_signals' })).map((r) => r.id)).toContain(run.id);
  });

  it('insert enqueues job with run id', async () => {
    const run = await requestSignals(await signedIn('oceniajacy@kropka.test'));
    const queue = createJobQueue(serviceClient());
    let found: Awaited<ReturnType<typeof queue.read>>[number] | undefined;
    for (let attempt = 0; attempt < 50 && found === undefined; attempt += 1) {
      found = (await queue.read(10, 1)).find(
        (job) => (job.message as { payload?: { runId?: string } }).payload?.runId === run.id,
      );
    }
    expect(found?.message).toEqual({ type: 'ai.run', payload: { runId: run.id } });
    if (found) await queue.archive(found.id);
  });

  it('claim succeeds once', async () => {
    const run = await requestSignals(await signedIn('oceniajacy@kropka.test'));
    const store = createAiRunQueueStore(serviceClient());
    expect(await store.claim(run.id, 600_000)).toEqual({
      kind: 'hr_signals',
      input: signalsInput,
      aiEnabled: true,
      requestedAt: expect.any(String) as string,
    });
    expect(await store.claim(run.id, 600_000)).toBeNull();
  });

  it('stale running run is claimed again', async () => {
    const run = await requestSignals(await signedIn('oceniajacy@kropka.test'));
    const store = createAiRunQueueStore(serviceClient());
    expect(await store.claim(run.id, 600_000)).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await store.claim(run.id, 0)).not.toBeNull();
  });

  it('progress shows while running, finish clears it and keeps the tokens', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const run = await requestSignals(evaluator);
    const store = createAiRunQueueStore(serviceClient());
    const runs = createAiRunRepository(evaluator);
    await store.progress(run.id, { partialText: '{"x', partialOutput: null, outputTokens: 1 });
    expect((await runs.get(run.id))?.outputTokens).toBeNull();
    await store.claim(run.id, 600_000);
    await store.progress(run.id, {
      partialText: '{"signals":[',
      partialOutput: { signals: signalsOutput.signals },
      outputTokens: 12,
    });
    expect(await runs.get(run.id)).toMatchObject({
      status: 'running',
      partialText: '{"signals":[',
      partialOutput: { signals: [{ signal: 'overload', present: true }] },
      outputTokens: 12,
    });
    // A fresh progress write is the heartbeat: the run is not stale although it started long ago.
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    await sleep(300);
    await store.progress(run.id, { partialText: '{', partialOutput: null, outputTokens: 13 });
    expect(await store.claim(run.id, 200)).toBeNull();
    await sleep(250);
    // Without progress for as long, another delivery takes it over and starts from scratch.
    expect(await store.claim(run.id, 200)).not.toBeNull();
    expect((await runs.get(run.id))?.outputTokens).toBeNull();
    await store.finish(run.id, {
      output: signalsOutput,
      promptVersion: 'hr-signals.v2',
      outputTokens: 40,
    });
    await store.progress(run.id, { partialText: 'late', partialOutput: null, outputTokens: 41 });
    expect(await runs.get(run.id)).toMatchObject({
      status: 'done',
      partialText: null,
      partialOutput: null,
      outputTokens: 40,
    });
  });

  it('claim reports office ai switch', async () => {
    const run = await requestSignals(await signedIn('oceniajacy@kropka.test'));
    const settings = createOfficeSettingsRepository(await signedIn('admin@kropka.test'));
    await settings.update({ aiEnabled: false });
    try {
      const claimed = await createAiRunQueueStore(serviceClient()).claim(run.id, 600_000);
      expect(claimed?.aiEnabled).toBe(false);
    } finally {
      await settings.update({ aiEnabled: true });
    }
  });

  it('finish stores typed output', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const run = await requestSignals(evaluator);
    const store = createAiRunQueueStore(serviceClient());
    await store.claim(run.id, 600_000);
    await store.finish(run.id, { output: signalsOutput, promptVersion: 'hr-signals.v1' });
    const stored = await createAiRunRepository(evaluator).get(run.id);
    expect(stored).toMatchObject({
      status: 'done',
      promptVersion: 'hr-signals.v1',
      failure: null,
      output: signalsOutput,
    });
    expect(stored?.finishedAt).not.toBeNull();
  });

  it('finish stores failure', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const run = await requestSignals(evaluator);
    await createAiRunQueueStore(serviceClient()).finish(run.id, {
      failure: { reason: 'timeout', message: 'No answer within 60000 ms' },
    });
    expect(await createAiRunRepository(evaluator).get(run.id)).toMatchObject({
      status: 'failed',
      output: null,
      failure: { reason: 'timeout', message: 'No answer within 60000 ms' },
    });
  });

  it('purged run is read with empty output', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const run = await requestSignals(evaluator);
    const service = serviceClient();
    await createAiRunQueueStore(service).finish(run.id, {
      output: signalsOutput,
      promptVersion: 'hr-signals.v1',
    });
    // What the retention job (B9) does as the owner.
    const { error } = await service
      .from('ai_runs')
      .update({
        input: null,
        output: null,
        failure_message: null,
        content_deleted_at: new Date().toISOString(),
      })
      .eq('id', run.id);
    expect(error).toBeNull();
    const purged = await createAiRunRepository(evaluator).get(run.id);
    expect(purged).toMatchObject({
      kind: 'hr_signals',
      status: 'done',
      output: null,
      promptVersion: 'hr-signals.v1',
      requestedBy: run.requestedBy,
    });
    expect(purged?.contentDeletedAt).not.toBeNull();
  });

  it('decision on done run is listed with run', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const run = await requestSignals(evaluator);
    await createAiRunQueueStore(serviceClient()).finish(run.id, {
      output: signalsOutput,
      promptVersion: 'hr-signals.v1',
    });
    const runs = createAiRunRepository(evaluator);
    expect(
      await runs.addDecisions(run.id, [{ fragment: 'question.0', decision: 'accepted' }]),
    ).toBe(true);
    expect(
      await runs.addDecisions(run.id, [
        { fragment: 'question.0', decision: 'edited', finalText: 'Co możemy przesunąć?' },
      ]),
    ).toBe(true);
    expect((await runs.get(run.id))?.decisions).toEqual([
      expect.objectContaining({
        fragment: 'question.0',
        decision: 'edited',
        finalText: 'Co możemy przesunąć?',
      }),
    ]);
  });

  it('decision by admin returns false', async () => {
    const run = await requestSignals(await signedIn('oceniajacy@kropka.test'));
    await createAiRunQueueStore(serviceClient()).finish(run.id, {
      output: signalsOutput,
      promptVersion: 'hr-signals.v1',
    });
    const admin = createAiRunRepository(await signedIn('admin@kropka.test'));
    expect(
      await admin.addDecisions(run.id, [{ fragment: 'question.0', decision: 'rejected' }]),
    ).toBe(false);
  });
});

describe('demo seed', () => {
  it('demo seed has a reviewed sheet draft about Marek', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const marek = await employeeId(evaluator, 'Merytoryczny');
    const runs = createAiRunRepository(evaluator);
    const draft = await runs.get('44444444-4444-4444-8444-000000000001');
    expect(draft).toMatchObject({ kind: 'sheet_draft', status: 'done', employeeId: marek });
    if (draft?.kind !== 'sheet_draft' || draft.output === null) throw new Error('No seeded draft');
    const seededNotes = new Set(draft.inputRefs.noteIds.map((note) => note.id));
    const sentences = [
      ...draft.output.ratings.flatMap((rating) => rating.sentences),
      ...draft.output.justification,
      ...draft.output.developmentConclusions,
    ];
    expect(sentences.length).toBeGreaterThan(0);
    expect(sentences.every((s) => s.noteIds.every((id) => seededNotes.has(id)))).toBe(true);
    expect(draft.decisions.map((d) => d.decision).sort()).toEqual(['accepted', 'edited']);

    const signals = await runs.list({ employeeId: marek, kind: 'hr_signals', status: 'done' });
    const seeded = signals.find((run) => run.id === '44444444-4444-4444-8444-000000000002');
    expect(
      seeded?.kind === 'hr_signals' &&
        seeded.output?.signals.filter((signal) => signal.present).map((signal) => signal.signal),
    ).toEqual(['overload']);

    const settings = await createOfficeSettingsRepository(evaluator).get();
    expect(settings?.appreciationGapDays).toBe(DEFAULT_APPRECIATION_GAP_DAYS);
  });

  it('demo seed has an answered procedure question that carries its question text', async () => {
    const evaluator = await signedIn('oceniajacy@kropka.test');
    const runs = createAiRunRepository(evaluator);
    const run = await runs.get('44444444-4444-4444-8444-000000000004');
    expect(run).toMatchObject({
      kind: 'procedure_question',
      status: 'done',
      question:
        'Ile dni ma pracownik na sprzeciw od oceny okresowej i od kiedy liczy się ten termin?',
    });
    if (run?.kind !== 'procedure_question' || run.output === null) throw new Error('No question');
    expect(run.output.grounded).toBe(true);
    const fragmentIds = new Set(run.output.fragments.map((fragment) => fragment.id));
    expect(run.output.citations.length).toBeGreaterThan(0);
    expect(run.output.citations.every((citation) => fragmentIds.has(citation.fragmentId))).toBe(
      true,
    );

    const draft = await runs.get('44444444-4444-4444-8444-000000000001');
    expect(draft?.question).toBeNull();

    const settings = await createOfficeSettingsRepository(evaluator).get();
    expect(settings?.accessibility).toMatchObject({
      contactEmail: 'dostepnosc@kropka.test',
      contactPhone: '+48 61 000 00 00',
    });
  });
});

describe('ai usage log', () => {
  const seedRunIds = [
    '44444444-4444-4444-8444-000000000001',
    '44444444-4444-4444-8444-000000000002',
    '44444444-4444-4444-8444-000000000003',
  ];

  it('admin reads the seeded runs as metadata without any content', async () => {
    const log = await createAiRunRepository(await signedIn('admin@kropka.test')).usageLog(500);
    const seeded = log.filter((entry) => seedRunIds.includes(entry.id));
    expect(seeded.map((entry) => entry.id).sort()).toEqual(seedRunIds);
    for (const entry of seeded) {
      expect(entry).toMatchObject({
        status: 'done',
        model: 'bielik-4.5b-v3.0-instruct',
        requesterName: 'Olga Oceniająca',
      });
      expect(entry).not.toHaveProperty('input');
      expect(entry).not.toHaveProperty('output');
    }
    const draft = seeded.find((entry) => entry.id === seedRunIds[0]);
    expect(draft?.decisions.map(({ fragment, decision }) => ({ fragment, decision }))).toEqual([
      { fragment: 'justification.0', decision: 'edited' },
      { fragment: 'rating.communication', decision: 'accepted' },
    ]);
    for (const decision of draft?.decisions ?? []) {
      expect(decision).not.toHaveProperty('finalText');
    }
  });

  it('hr is refused with 42501', async () => {
    const hr = createAiRunRepository(await signedIn('kadry@kropka.test'));
    await expect(hr.usageLog(10)).rejects.toSatisfy(
      (error: unknown) => error instanceof RepositoryError && error.code === '42501',
    );
  });
});
