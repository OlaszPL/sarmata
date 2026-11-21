import type { Database } from '@sarmata/database';
import { type AiInput } from '@sarmata/domain';
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
