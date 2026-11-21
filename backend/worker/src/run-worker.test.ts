import { type JobQueue, type QueuedJob } from '@sarmata/repositories';
import {
  type EvaluationClosing,
  type NotificationDelivery,
  type RetentionService,
} from '@sarmata/services/system';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  type JobHandler,
  type Logger,
  type WorkerOptions,
  defineJobHandler,
  jobHandlersFor,
  runWorker,
} from './index';

const unusedDelivery: NotificationDelivery = {
  sendDigest: () => Promise.reject(new Error('unused')),
};

const unusedClosing: EvaluationClosing = {
  closeUnobjected: () => Promise.reject(new Error('unused')),
};

const unusedRetention: RetentionService = {
  run: () => Promise.reject(new Error('unused')),
};

class InMemoryQueue implements JobQueue {
  readonly archived: number[] = [];
  reads = 0;
  private nextId = 1;
  private jobs: { id: number; readCount: number; message: unknown }[] = [];

  add(message: unknown): number {
    const id = this.nextId++;
    this.jobs.push({ id, readCount: 0, message });
    return id;
  }

  get pending(): number {
    return this.jobs.length;
  }

  send(message: { type: string; payload: Record<string, unknown> }): Promise<number> {
    return Promise.resolve(this.add(message));
  }

  read(batchSize: number): Promise<QueuedJob[]> {
    this.reads += 1;
    const batch = this.jobs.slice(0, batchSize);
    for (const job of batch) job.readCount += 1;
    return Promise.resolve(
      batch.map((job) => ({
        id: job.id,
        readCount: job.readCount,
        enqueuedAt: '2026-11-21T10:00:00Z',
        message: job.message,
      })),
    );
  }

  archive(id: number): Promise<void> {
    this.archived.push(id);
    this.jobs = this.jobs.filter((job) => job.id !== id);
    return Promise.resolve();
  }
}

interface LogEntry {
  level: 'info' | 'error';
  message: string;
  fields: Record<string, unknown>;
}

function recordingLogger(): Logger & { entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    entries,
    info: (message, fields = {}) => entries.push({ level: 'info', message, fields }),
    error: (message, fields = {}) => entries.push({ level: 'error', message, fields }),
  };
}

const recordingHandler = (type = 'test.record') => {
  const payloads: unknown[] = [];
  const handler = defineJobHandler({
    type,
    payload: z.object({ value: z.number() }),
    handle(payload) {
      payloads.push(payload);
      return Promise.resolve();
    },
  });
  return { handler, payloads };
};

async function runUntil(
  options: Omit<WorkerOptions, 'logger'> & { logger?: Logger },
  done: () => boolean,
): Promise<void> {
  const controller = new AbortController();
  const running = runWorker(
    { idleDelayMs: 1, logger: recordingLogger(), ...options },
    controller.signal,
  );
  await vi.waitFor(
    () => {
      if (!done()) throw new Error('not yet');
    },
    { timeout: 2_000, interval: 5 },
  );
  controller.abort();
  await running;
}

describe('runWorker', () => {
  it('runs the handler of a known job and archives the job', async () => {
    const queue = new InMemoryQueue();
    const { handler, payloads } = recordingHandler();
    queue.add({ type: 'test.record', payload: { value: 7 } });
    await runUntil({ queue, handlers: [handler] }, () => queue.pending === 0);
    expect(payloads).toEqual([{ value: 7 }]);
    expect(queue.archived).toEqual([1]);
  });

  it('archives a job without a handler and runs nothing', async () => {
    const queue = new InMemoryQueue();
    const logger = recordingLogger();
    const { handler, payloads } = recordingHandler();
    queue.add({ type: 'test.unknown', payload: {} });
    await runUntil({ queue, handlers: [handler], logger }, () => queue.pending === 0);
    expect(payloads).toEqual([]);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ level: 'error', message: 'job without a handler archived' }),
    );
  });

  it('archives a job whose payload does not match the schema', async () => {
    const queue = new InMemoryQueue();
    const logger = recordingLogger();
    const { handler, payloads } = recordingHandler();
    queue.add({ type: 'test.record', payload: { value: 'seven' } });
    await runUntil({ queue, handlers: [handler], logger }, () => queue.pending === 0);
    expect(payloads).toEqual([]);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ message: 'job with an invalid payload archived' }),
    );
  });

  it('archives a message that is not a job envelope', async () => {
    const queue = new InMemoryQueue();
    queue.add('just a string');
    await runUntil({ queue, handlers: [] }, () => queue.pending === 0);
    expect(queue.archived).toEqual([1]);
  });

  it('retries a failing job and archives it after maxAttempts deliveries', async () => {
    const queue = new InMemoryQueue();
    const logger = recordingLogger();
    let calls = 0;
    const failing = defineJobHandler({
      type: 'test.fail',
      payload: z.object({}),
      handle() {
        calls += 1;
        return Promise.reject(new Error('smtp down'));
      },
    });
    queue.add({ type: 'test.fail', payload: {} });
    await runUntil(
      { queue, handlers: [failing], logger, maxAttempts: 3 },
      () => queue.pending === 0,
    );
    expect(calls).toBe(3);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ message: 'job failed too many times, archived' }),
    );
  });

  it('finishes the job in progress before stopping and leaves the rest in the queue', async () => {
    const queue = new InMemoryQueue();
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const slow = defineJobHandler({
      type: 'test.slow',
      payload: z.object({}),
      handle: () => {
        markStarted();
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });
    queue.add({ type: 'test.slow', payload: {} });
    queue.add({ type: 'test.slow', payload: {} });
    const controller = new AbortController();
    const running = runWorker(
      { queue, handlers: [slow], logger: recordingLogger(), idleDelayMs: 1 },
      controller.signal,
    );
    await started;
    controller.abort();
    let stopped = false;
    void running.then(() => {
      stopped = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);
    release();
    await running;
    expect(queue.archived).toEqual([1]);
    expect(queue.pending).toBe(1);
    expect(queue.reads).toBe(1);
  });

  it('stops promptly while waiting on an empty queue', async () => {
    const queue = new InMemoryQueue();
    const controller = new AbortController();
    const running = runWorker(
      { queue, handlers: [], logger: recordingLogger(), idleDelayMs: 60_000 },
      controller.signal,
    );
    await vi.waitFor(() => {
      expect(queue.reads).toBe(1);
    });
    controller.abort();
    await expect(running).resolves.toBeUndefined();
  });

  it('refuses two handlers of the same type', async () => {
    const handlers: JobHandler[] = [recordingHandler().handler, recordingHandler().handler];
    await expect(
      runWorker(
        { queue: new InMemoryQueue(), handlers, logger: recordingLogger() },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Two job handlers share a type');
  });

  it('answers system.ping with a pong log line', async () => {
    const queue = new InMemoryQueue();
    const logger = recordingLogger();
    queue.add({ type: 'system.ping', payload: { note: 'hello' } });
    await runUntil(
      {
        queue,
        handlers: jobHandlersFor({
          delivery: unusedDelivery,
          closing: unusedClosing,
          retention: unusedRetention,
          invitations: { process: () => Promise.reject(new Error('unused')) },
        }),
        logger,
      },
      () => queue.pending === 0,
    );
    expect(logger.entries).toContainEqual({
      level: 'info',
      message: 'pong',
      fields: { note: 'hello' },
    });
  });
});
