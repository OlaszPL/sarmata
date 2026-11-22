'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  NOTE_GUARD_POLL_MS,
  type NoteGuardState,
  noteGuardReducer,
} from '@/lib/employees/note-guard';
import { checkNote, decideRewrite, pollNoteCheck } from './note-actions';

/** A failed call counts as an AI that did not answer: the save still runs the dictionary guard. */
const UNAVAILABLE = { status: 'unavailable', runId: '' } as const;

export interface NoteGuard {
  state: NoteGuardState;
  /** `checkNote` is on its way, the phase is still `idle`. */
  starting: boolean;
  start: (body: string) => void;
  skipAi: () => void;
  bodyChanged: () => void;
  settleRewrite: (
    decision: 'accepted' | 'edited' | 'rejected',
    finalText?: string,
  ) => Promise<void>;
}

/**
 * The sensitive data guard of a note form: the check, the polling of the AI run with its timer and
 * the decisions about the proposal. The form only renders `state`.
 */
export function useNoteGuard(employeeId: string): NoteGuard {
  const [state, dispatch] = useReducer(noteGuardReducer, { phase: 'idle' });
  const [starting, setStarting] = useState(false);
  /** Bumped by every new check, body change and unmount, so late answers are dropped. */
  const generation = useRef(0);
  const stateRef = useRef(state);
  const startingRef = useRef(starting);
  useEffect(() => {
    stateRef.current = state;
    startingRef.current = starting;
  });

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  const checking = state.phase === 'checking' ? state : null;
  const runId = checking?.runId ?? null;
  const startedAt = checking?.startedAt ?? null;

  useEffect(() => {
    if (startedAt === null) return;
    let stopped = false;
    let inFlight = false;
    const interval = setInterval(() => {
      dispatch({ type: 'tick', now: Date.now() });
      if (runId === null || inFlight) return;
      inFlight = true;
      void pollNoteCheck(runId)
        .catch(() => ({ error: 'unavailable' }))
        .then((result) => {
          inFlight = false;
          if (stopped) return;
          dispatch({
            type: 'polled',
            ai: 'error' in result ? { ...UNAVAILABLE, runId } : result,
            now: Date.now(),
          });
        });
    }, NOTE_GUARD_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [runId, startedAt]);

  const start = useCallback(
    (body: string) => {
      if (startingRef.current || stateRef.current.phase !== 'idle') return;
      generation.current += 1;
      const current = generation.current;
      setStarting(true);
      void checkNote({ employeeId, body })
        .catch(() => ({ error: 'unavailable' }))
        .then((result) => {
          if (current !== generation.current) return;
          setStarting(false);
          dispatch({
            type: 'checked',
            check: 'error' in result ? { keywordWarnings: [], ai: UNAVAILABLE } : result,
            now: Date.now(),
          });
        });
    },
    [employeeId],
  );

  const skipAi = useCallback(() => {
    dispatch({ type: 'skip_ai' });
  }, []);

  const bodyChanged = useCallback(() => {
    if (stateRef.current.phase === 'idle' && !startingRef.current) return;
    generation.current += 1;
    setStarting(false);
    dispatch({ type: 'body_changed' });
  }, []);

  const settleRewrite = useCallback(
    async (decision: 'accepted' | 'edited' | 'rejected', finalText?: string) => {
      const current = stateRef.current;
      if (current.phase !== 'review' || current.rewrite === null) return;
      // The decision goes to the AI usage log. A failed log does not block the note.
      await decideRewrite(current.rewrite.runId, decision, finalText).catch(() => ({}));
      dispatch({ type: 'rewrite_settled' });
    },
    [],
  );

  return { state, starting, start, skipAi, bodyChanged, settleRewrite };
}
