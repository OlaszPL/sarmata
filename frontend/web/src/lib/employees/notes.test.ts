import { describe, expect, it } from 'vitest';
import { aiNoteParam, aiNoteText, aiNoteTextOfParam } from './notes';

describe('ai note texts', () => {
  it('says nothing after a full check', () => {
    expect(aiNoteText('done')).toBeNull();
    expect(aiNoteParam('done')).toBeNull();
  });

  it('tells a skipped AI apart from an AI that did not answer', () => {
    expect(aiNoteText('skipped')).toBe('Sprawdzono tylko słownikiem.');
    expect(aiNoteText('dictionary_only')).toBe(
      'Sprawdzono tylko słownikiem, bo model AI nie odpowiedział.',
    );
  });

  it('round-trips every message through the URL value', () => {
    for (const aiNote of ['dictionary_only', 'skipped', 'ai_disabled']) {
      const param = aiNoteParam(aiNote);
      expect(param).not.toBeNull();
      expect(aiNoteTextOfParam(param ?? '')).toBe(aiNoteText(aiNote));
    }
  });

  it('ignores unknown values', () => {
    expect(aiNoteText('toString')).toBeNull();
    expect(aiNoteParam('')).toBeNull();
    expect(aiNoteTextOfParam('cokolwiek')).toBeNull();
  });
});
