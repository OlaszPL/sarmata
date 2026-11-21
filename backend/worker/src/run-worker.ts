import { type JobQueue, type QueuedJob } from '@sarmata/repositories';
import { z } from 'zod';
import { type JobHandler } from './job-handler';
import { type Logger, describeError } from './logger';

export interface WorkerOptions {
  readonly queue: JobQueue;
  readonly handlers: readonly JobHandler[];
  readonly logger: Logger;
  readonly batchSize?: number;
  readonly visibilityTimeoutSeconds?: number;
  /** Deliveries before a failing job is archived as dead. */
  readonly maxAttempts?: number;
  /** Pause after an empty read or a queue error. */
  readonly idleDelayMs?: number;
}

const envelopeSchema = z.object({ type: z.string().min(1), payload: z.unknown() });

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = (): void => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

async function processJob(
  job: QueuedJob,
  handlers: ReadonlyMap<string, JobHandler>,
  options: WorkerOptions,
  signal: AbortSignal,
): Promise<void> {
  const { logger, queue } = options;
  const maxAttempts = options.maxAttempts ?? 5;
  const fields = { jobId: job.id, attempt: job.readCount };
  const envelope = envelopeSchema.safeParse(job.message);
  if (!envelope.success) {
    logger.error('malformed job archived', fields);
    await queue.archive(job.id);
    return;
  }
  const { type, payload } = envelope.data;
  const handler = handlers.get(type);
  if (handler === undefined) {
    logger.error('job without a handler archived', { ...fields, type });
    await queue.archive(job.id);
    return;
  }
  if (job.readCount > maxAttempts) {
    logger.error('job failed too many times, archived', { ...fields, type });
    await queue.archive(job.id);
    return;
  }
  try {
    const outcome = await handler.run(payload, { signal, logger });
    if (outcome.status === 'invalid_payload') {
      logger.error('job with an invalid payload archived', {
        ...fields,
        type,
        problem: outcome.message,
      });
    } else {
      logger.info('job done', { ...fields, type });
    }
    await queue.archive(job.id);
  } catch (error) {
    logger.error('job failed, it comes back after the visibility timeout', {
      ...fields,
      type,
      error: describeError(error),
    });
  }
}

/**
 * Processes jobs until `signal` is aborted. Resolves after the job in progress finishes.
 * Jobs read but not started before the abort return to the queue after the visibility timeout.
 */
export async function runWorker(options: WorkerOptions, signal: AbortSignal): Promise<void> {
  const handlers = new Map(options.handlers.map((handler) => [handler.type, handler]));
  if (handlers.size !== options.handlers.length) throw new Error('Two job handlers share a type');
  const batchSize = options.batchSize ?? 5;
  const visibilityTimeoutSeconds = options.visibilityTimeoutSeconds ?? 60;
  const idleDelayMs = options.idleDelayMs ?? 1_000;
  options.logger.info('worker started', { handlers: [...handlers.keys()] });
  // A function, so the check is re-read after every await (a plain property would stay narrowed).
  const stopping = (): boolean => signal.aborted;

  while (!stopping()) {
    let jobs: QueuedJob[];
    try {
      jobs = await options.queue.read(batchSize, visibilityTimeoutSeconds);
    } catch (error) {
      options.logger.error('queue read failed', { error: describeError(error) });
      await sleep(idleDelayMs, signal);
      continue;
    }
    if (jobs.length === 0) {
      await sleep(idleDelayMs, signal);
      continue;
    }
    for (const job of jobs) {
      if (stopping()) break;
      try {
        await processJob(job, handlers, options, signal);
      } catch (error) {
        options.logger.error('job bookkeeping failed', {
          jobId: job.id,
          error: describeError(error),
        });
      }
    }
  }
  options.logger.info('worker stopped');
}
