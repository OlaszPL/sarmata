import { type AiRunProgress } from '@sarmata/ai';
import { errorMessage } from '@sarmata/domain';
import { type AiRunQueueStore } from '@sarmata/repositories';
import { type Logger } from '../logger';

/** At most one progress write per run in this time. The first one goes out at once. */
export const PROGRESS_INTERVAL_MS = 1_000;

export interface ProgressWriter {
  /** The latest state of the run. Written at the next free slot, earlier states are skipped. */
  update(progress: AiRunProgress): void;
  /** Output tokens of the latest state, `null` before the first one. */
  readonly outputTokens: number | null;
  /** Cancels a pending write and waits for the one in flight, so `finish` comes after it. */
  stop(): Promise<void>;
}

/**
 * Throttled progress writes of one run (ADR 0008). Progress is best effort: a failed write is logged
 * and the run goes on. The store ignores a write that comes after `finish`.
 */
export function createProgressWriter(
  store: Pick<AiRunQueueStore, 'progress'>,
  runId: string,
  logger: Logger,
  intervalMs = PROGRESS_INTERVAL_MS,
): ProgressWriter {
  let latest: AiRunProgress | null = null;
  let dirty = false;
  let stopped = false;
  let lastWriteAt = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> | null = null;

  const schedule = (): void => {
    if (timer !== null || writing !== null || stopped || !dirty) return;
    const wait = Math.max(0, lastWriteAt + intervalMs - Date.now());
    timer = setTimeout(write, wait);
  };

  function write(): void {
    timer = null;
    if (stopped || !dirty || latest === null) return;
    dirty = false;
    lastWriteAt = Date.now();
    const state = latest;
    writing = store
      .progress(runId, {
        partialText: state.text,
        partialOutput: state.partialOutput,
        outputTokens: state.outputTokens,
      })
      .catch((error: unknown) => {
        logger.error('ai run progress not stored', { runId, error: errorMessage(error) });
      })
      .finally(() => {
        writing = null;
        schedule();
      });
  }

  return {
    update(progress) {
      latest = progress;
      dirty = true;
      schedule();
    },
    get outputTokens() {
      return latest?.outputTokens ?? null;
    },
    async stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      await writing;
    },
  };
}
