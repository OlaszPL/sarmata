import type { NoteCheck, NoteCheckAi, SensitiveDataWarning } from '@sarmata/services';
import type { AiNote } from './notes';

export const NOTE_GUARD_POLL_MS = 1000;

/** The server marks a run unavailable after the check timeout, the client waits a little longer. */
const CLIENT_MARGIN_MS = 5000;

export type NoteGuardState =
  | { phase: 'idle' }
  | {
      phase: 'checking';
      keywordWarnings: readonly SensitiveDataWarning[];
      runId: string | null;
      startedAt: number;
      /** Past this time a `tick` ends the check like `unavailable`. */
      deadline: number;
    }
  | {
      phase: 'review';
      warnings: readonly SensitiveDataWarning[];
      rewrite: { runId: string; text: string } | null;
      aiNote: AiNote;
    }
  | { phase: 'clear'; aiNote: AiNote };

export type NoteGuardEvent =
  /** `timeoutMs` is `NOTE_CHECK_TIMEOUT_MS` of the server, passed down by the page. */
  | { type: 'checked'; check: NoteCheck; now: number; timeoutMs: number }
  | { type: 'polled'; ai: NoteCheckAi; now: number }
  /** Every second, past the timeout it ends like `unavailable`. */
  | { type: 'tick'; now: number }
  /** "Zapisz bez czekania na AI": from `checking` it ends with the dictionary warnings only. */
  | { type: 'skip_ai' }
  /** After the proposal was accepted, edited or rejected. */
  | { type: 'rewrite_settled' }
  /** Any change of the body starts over. */
  | { type: 'body_changed' };

function settle(
  warnings: readonly SensitiveDataWarning[],
  aiNote: AiNote,
  rewrite: { runId: string; text: string } | null = null,
): NoteGuardState {
  if (warnings.length === 0 && rewrite === null) return { phase: 'clear', aiNote };
  return { phase: 'review', warnings, rewrite, aiNote };
}

function fromAi(
  ai: NoteCheckAi,
  keywordWarnings: readonly SensitiveDataWarning[],
): NoteGuardState | null {
  switch (ai.status) {
    case 'pending':
      return null;
    case 'disabled':
      return settle(keywordWarnings, 'ai_disabled');
    case 'unavailable':
      return settle(keywordWarnings, 'dictionary_only');
    case 'done':
      return settle(
        ai.warnings,
        'done',
        ai.rewrite !== null && ai.rewrite !== '' ? { runId: ai.runId, text: ai.rewrite } : null,
      );
  }
}

export function noteGuardReducer(state: NoteGuardState, event: NoteGuardEvent): NoteGuardState {
  switch (event.type) {
    case 'body_changed':
      return { phase: 'idle' };
    case 'checked': {
      const { check, now, timeoutMs } = event;
      if (check.ai.status === 'pending') {
        return {
          phase: 'checking',
          keywordWarnings: check.keywordWarnings,
          runId: check.ai.runId,
          startedAt: now,
          deadline: now + timeoutMs + CLIENT_MARGIN_MS,
        };
      }
      return fromAi(check.ai, check.keywordWarnings) ?? state;
    }
    case 'polled':
      return state.phase === 'checking'
        ? (fromAi(event.ai, state.keywordWarnings) ?? state)
        : state;
    case 'tick':
      return state.phase === 'checking' && event.now > state.deadline
        ? settle(state.keywordWarnings, 'dictionary_only')
        : state;
    case 'skip_ai':
      return state.phase === 'checking' ? settle(state.keywordWarnings, 'skipped') : state;
    case 'rewrite_settled':
      return state.phase === 'review' ? { ...state, rewrite: null } : state;
  }
}
