import { type Db } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

/** A message on the `jobs` queue. The worker picks the handler by `type`. */
export interface JobMessage {
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

export interface QueuedJob {
  readonly id: number;
  /** pgmq read counter: 1 on the first delivery. */
  readonly readCount: number;
  readonly enqueuedAt: string;
  /** Raw message, validated by the worker. */
  readonly message: unknown;
}

export interface JobQueue {
  send(message: JobMessage, options?: { readonly delaySeconds?: number }): Promise<number>;
  /** Hides the returned jobs for `visibilityTimeoutSeconds`. An unarchived job comes back afterwards. */
  read(batchSize: number, visibilityTimeoutSeconds: number): Promise<QueuedJob[]>;
  archive(id: number): Promise<void>;
}

/** pgmq through RPC. Needs the service client: accounts have no access to the queue functions. */
export function createJobQueue(db: Db): JobQueue {
  return {
    async send(message, options = {}) {
      const { data, error } = await db.rpc('job_queue_send', {
        message: toJson(message),
        delay_seconds: options.delaySeconds ?? 0,
      });
      if (error) throw new RepositoryError('jobQueue.send', error);
      return data;
    },

    async read(batchSize, visibilityTimeoutSeconds) {
      const { data, error } = await db.rpc('job_queue_read', {
        batch_size: batchSize,
        visibility_timeout_seconds: visibilityTimeoutSeconds,
      });
      if (error) throw new RepositoryError('jobQueue.read', error);
      return data.map((row) => ({
        id: row.message_id,
        readCount: row.read_count,
        enqueuedAt: row.enqueued_at,
        message: row.message,
      }));
    },

    async archive(id) {
      const { error } = await db.rpc('job_queue_archive', { message_id: id });
      if (error) throw new RepositoryError('jobQueue.archive', error);
    },
  };
}
