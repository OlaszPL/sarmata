'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** What a server action answers when it starts an AI run. */
export type AiStartResult = { runId: string } | { error: string; disabled?: boolean };

/** What a server action answers to one poll of a run. */
export type AiPollResult<R> = { run: R } | { error: string };

/** The fields of an AI run the polling reads. */
interface PolledRun {
  status: 'queued' | 'running' | 'done' | 'failed';
  failure: { reason: string } | null;
  output: unknown;
}

export type AiRunState<R> =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'waiting'; runId: string; queued: boolean; run: R | null }
  | { phase: 'done'; runId: string; run: R }
  | { phase: 'failed'; message: string }
  | { phase: 'disabled'; message: string }
  | { phase: 'timed_out' };

const POLL_MS = 1500;
/** A short check longer than this counts as timed out: the person works on without AI. */
const TIMEOUT_MS = 240_000;

export const AI_DISABLED_MESSAGE =
  'AI jest wyłączone w ustawieniach urzędu. Możesz pracować bez sugestii.';

/**
 * One AI run started from client code and polled about every 1.5 s until it is done, failed or too
 * slow. Late answers of an older run are dropped, `reset` goes back to the start.
 */
export function useAiRun<R extends PolledRun>(
  poll: (runId: string) => Promise<AiPollResult<R>>,
  failedMessage: string,
): {
  state: AiRunState<R>;
  start: (call: () => Promise<AiStartResult>) => void;
  reset: () => void;
} {
  const [state, setState] = useState<AiRunState<R>>({ phase: 'idle' });
  const generation = useRef(0);
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  const runId = state.phase === 'waiting' ? state.runId : null;

  useEffect(() => {
    if (runId === null) return;
    const current = generation.current;
    const startedAt = Date.now();
    let inFlight = false;
    const interval = setInterval(() => {
      if (Date.now() - startedAt > TIMEOUT_MS) {
        clearInterval(interval);
        if (current === generation.current) setState({ phase: 'timed_out' });
        return;
      }
      if (inFlight) return;
      inFlight = true;
      void pollRef
        .current(runId)
        .catch(() => ({ error: failedMessage }))
        .then((result) => {
          inFlight = false;
          if (current !== generation.current) return;
          if ('error' in result) return;
          const { run } = result;
          if (run.status === 'done' && run.output !== null) {
            setState({ phase: 'done', runId, run });
          } else if (run.status === 'failed' || run.status === 'done') {
            setState(
              run.failure?.reason === 'disabled'
                ? { phase: 'disabled', message: AI_DISABLED_MESSAGE }
                : { phase: 'failed', message: failedMessage },
            );
          } else {
            setState({ phase: 'waiting', runId, queued: run.status === 'queued', run });
          }
        });
    }, POLL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [runId, failedMessage]);

  const start = useCallback(
    (call: () => Promise<AiStartResult>) => {
      generation.current += 1;
      const current = generation.current;
      setState({ phase: 'starting' });
      void call()
        .catch((): AiStartResult => ({ error: failedMessage }))
        .then((result) => {
          if (current !== generation.current) return;
          if ('runId' in result) {
            setState({ phase: 'waiting', runId: result.runId, queued: true, run: null });
          } else if (result.disabled === true) {
            setState({ phase: 'disabled', message: result.error });
          } else {
            setState({ phase: 'failed', message: result.error });
          }
        });
    },
    [failedMessage],
  );

  const reset = useCallback(() => {
    generation.current += 1;
    setState({ phase: 'idle' });
  }, []);

  return { state, start, reset };
}
