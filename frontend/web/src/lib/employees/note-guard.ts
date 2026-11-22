import {
  NOTE_CHECK_TIMEOUT_MS,
  type NoteCheck,
  type NoteCheckAi,
  type SensitiveDataWarning,
} from '@sarmata/services';

export const NOTE_GUARD_POLL_MS = 1000;

/** The server marks a run unavailable after the check timeout, the client waits a little longer. */
const CLIENT_TIMEOUT_MS = NOTE_CHECK_TIMEOUT_MS + 5000;

type AiNote = 'done' | 'dictionary_only' | 'ai_disabled';

export type NoteGuardState =
  | { phase: 'idle' }
  | {
      phase: 'checking';
      keywordWarnings: readonly SensitiveDataWarning[];
      runId: string | null;
      startedAt: number;
    }
  | {
      phase: 'review';
      warnings: readonly SensitiveDataWarning[];
      rewrite: { runId: string; text: string } | null;
      aiNote: AiNote;
    }
  | { phase: 'clear'; aiNote: AiNote };

export type NoteGuardEvent =
  | { type: 'checked'; check: NoteCheck; now: number }
  | { type: 'polled'; ai: NoteCheckAi; now: number }
  /** Every second, past the timeout it ends like `unavailable`. */
  | { type: 'tick'; now: number }
  /** "Zapisz bez czekania na AI": from `checking` it ends like `unavailable`. */
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
      const { check, now } = event;
      if (check.ai.status === 'pending') {
        return {
          phase: 'checking',
          keywordWarnings: check.keywordWarnings,
          runId: check.ai.runId,
          startedAt: now,
        };
      }
      return fromAi(check.ai, check.keywordWarnings) ?? state;
    }
    case 'polled':
      return state.phase === 'checking'
        ? (fromAi(event.ai, state.keywordWarnings) ?? state)
        : state;
    case 'tick':
      return state.phase === 'checking' && event.now - state.startedAt > CLIENT_TIMEOUT_MS
        ? settle(state.keywordWarnings, 'dictionary_only')
        : state;
    case 'skip_ai':
      return state.phase === 'checking' ? settle(state.keywordWarnings, 'dictionary_only') : state;
    case 'rewrite_settled':
      return state.phase === 'review' ? { ...state, rewrite: null } : state;
  }
}
