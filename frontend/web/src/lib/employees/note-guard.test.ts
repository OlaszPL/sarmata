import type { NoteCheck, SensitiveDataWarning } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { type NoteGuardState, noteGuardReducer } from './note-guard';

const health: SensitiveDataWarning = { category: 'health', fragment: 'zwolnienie lekarskie' };
const family: SensitiveDataWarning = { category: 'family', fragment: 'ciąża' };

/** `NOTE_CHECK_TIMEOUT_MS` of the server as the page passes it. */
const TIMEOUT_MS = 45_000;

function checked(check: NoteCheck, now = 0) {
  return noteGuardReducer(
    { phase: 'idle' },
    { type: 'checked', check, now, timeoutMs: TIMEOUT_MS },
  );
}

const pending: NoteCheck = {
  keywordWarnings: [health],
  ai: { status: 'pending', runId: 'run-1' },
};

describe('noteGuardReducer', () => {
  it('starts checking while the AI is pending', () => {
    expect(checked(pending, 1000)).toEqual({
      phase: 'checking',
      keywordWarnings: [health],
      runId: 'run-1',
      startedAt: 1000,
      deadline: 51_000,
    });
  });

  it('reviews the AI result with a rewrite', () => {
    const checking = checked(pending);
    const next = noteGuardReducer(checking, {
      type: 'polled',
      now: 2000,
      ai: { status: 'done', runId: 'run-1', warnings: [health, family], rewrite: 'Tekst' },
    });
    expect(next).toEqual({
      phase: 'review',
      warnings: [health, family],
      rewrite: { runId: 'run-1', text: 'Tekst' },
      aiNote: 'done',
    });
  });

  it('is clear when the AI finds nothing', () => {
    const checking = checked({ keywordWarnings: [], ai: { status: 'pending', runId: 'r' } });
    const next = noteGuardReducer(checking, {
      type: 'polled',
      now: 1,
      ai: { status: 'done', runId: 'r', warnings: [], rewrite: null },
    });
    expect(next).toEqual({ phase: 'clear', aiNote: 'done' });
  });

  it('falls back to the dictionary when the user skips the AI', () => {
    const next = noteGuardReducer(checked(pending), { type: 'skip_ai' });
    expect(next).toEqual({
      phase: 'review',
      warnings: [health],
      rewrite: null,
      aiNote: 'skipped',
    });
  });

  it('is clear when the user skips the AI and the dictionary finds nothing', () => {
    const checking = checked({ keywordWarnings: [], ai: { status: 'pending', runId: 'r' } });
    expect(noteGuardReducer(checking, { type: 'skip_ai' })).toEqual({
      phase: 'clear',
      aiNote: 'skipped',
    });
  });

  it('falls back to the dictionary when the AI is unavailable', () => {
    const next = noteGuardReducer(checked(pending), {
      type: 'polled',
      now: 5,
      ai: { status: 'unavailable', runId: 'run-1' },
    });
    expect(next).toMatchObject({ phase: 'review', aiNote: 'dictionary_only' });
  });

  it('times out after the check limit of the server plus a margin', () => {
    const checking = checked(pending, 0);
    expect(noteGuardReducer(checking, { type: 'tick', now: 50_000 })).toBe(checking);
    const next = noteGuardReducer(checking, { type: 'tick', now: 50_001 });
    expect(next).toEqual({
      phase: 'review',
      warnings: [health],
      rewrite: null,
      aiNote: 'dictionary_only',
    });
  });

  it('takes the check limit from the checked event', () => {
    const checking = noteGuardReducer(
      { phase: 'idle' },
      { type: 'checked', check: pending, now: 0, timeoutMs: 1000 },
    );
    expect(noteGuardReducer(checking, { type: 'tick', now: 6000 })).toBe(checking);
    expect(noteGuardReducer(checking, { type: 'tick', now: 6001 })).toMatchObject({
      phase: 'review',
      aiNote: 'dictionary_only',
    });
  });

  it('ignores a result that arrives after the timeout', () => {
    const timedOut = noteGuardReducer(checked(pending), { type: 'tick', now: 50_001 });
    const next = noteGuardReducer(timedOut, {
      type: 'polled',
      now: 51_000,
      ai: { status: 'done', runId: 'run-1', warnings: [], rewrite: null },
    });
    expect(next).toBe(timedOut);
  });

  it('is clear without AI and without warnings', () => {
    expect(checked({ keywordWarnings: [], ai: { status: 'disabled' } })).toEqual({
      phase: 'clear',
      aiNote: 'ai_disabled',
    });
  });

  it('reviews dictionary warnings when the AI is disabled', () => {
    expect(checked({ keywordWarnings: [health], ai: { status: 'disabled' } })).toEqual({
      phase: 'review',
      warnings: [health],
      rewrite: null,
      aiNote: 'ai_disabled',
    });
  });

  it('drops the rewrite once it is settled', () => {
    const review: NoteGuardState = {
      phase: 'review',
      warnings: [health],
      rewrite: { runId: 'r', text: 'x' },
      aiNote: 'done',
    };
    expect(noteGuardReducer(review, { type: 'rewrite_settled' })).toEqual({
      ...review,
      rewrite: null,
    });
  });

  it('returns to idle when the body changes', () => {
    expect(noteGuardReducer(checked(pending), { type: 'body_changed' })).toEqual({
      phase: 'idle',
    });
  });
});
