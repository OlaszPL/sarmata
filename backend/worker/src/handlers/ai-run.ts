import { type AiRunner, aiRunnerFromEnv } from '@sarmata/ai';
import {
  type AiRunQueueStore,
  createAiRunQueueStore,
  createServiceClient,
} from '@sarmata/repositories';
import { z } from 'zod';
import { workerConfigFromEnv } from '../config';
import { defineJobHandler } from '../job-handler';

export interface AiRunHandlerDeps {
  readonly store: AiRunQueueStore;
  readonly runner: AiRunner;
}

/** A running run older than this is taken over: its worker died or the job came back after a restart. */
const STALE_AFTER_MS = 10 * 60_000;

/**
 * Runs one AI run (ADR 0008). `claim` makes a second delivery a no-op. A model failure finishes the
 * run as failed without retries (the user asks again), a database error throws so pgmq delivers the
 * job again.
 */
export function createAiRunHandler(deps: () => AiRunHandlerDeps) {
  return defineJobHandler({
    type: 'ai.run',
    payload: z.object({ runId: z.uuid() }),
    async handle({ runId }, { signal, logger }) {
      const { store, runner } = deps();
      const run = await store.claim(runId, STALE_AFTER_MS);
      if (run === null) {
        logger.info('ai run skipped', { runId });
        return;
      }
      if (!run.aiEnabled) {
        await store.finish(runId, {
          failure: { reason: 'disabled', message: 'AI is switched off in the office settings' },
        });
        logger.info('ai run failed', { runId, kind: run.kind, reason: 'disabled' });
        return;
      }
      const result = await runner.execute({ kind: run.kind, input: run.input }, signal);
      // On shutdown the job comes back and the stale claim takes the run over.
      if (signal.aborted) throw new Error(`AI run ${runId} interrupted by shutdown`);
      if (result.ok) {
        await store.finish(runId, {
          output: result.value.output,
          promptVersion: result.value.promptVersion,
        });
        logger.info('ai run done', { runId, kind: run.kind, prompt: result.value.promptVersion });
      } else {
        await store.finish(runId, { failure: { reason: result.reason, message: result.message } });
        logger.info('ai run failed', { runId, kind: run.kind, reason: result.reason });
      }
    },
  });
}

const once = <T>(make: () => T): (() => T) => {
  let value: T | undefined;
  return () => (value ??= make());
};

/** The handler of the worker process. Its dependencies are built at the first job. */
export const aiRunHandler = createAiRunHandler(
  once(() => {
    const config = workerConfigFromEnv(process.env);
    return {
      store: createAiRunQueueStore(
        createServiceClient({ url: config.supabaseUrl, secretKey: config.secretKey }),
      ),
      runner: aiRunnerFromEnv(process.env),
    };
  }),
);
