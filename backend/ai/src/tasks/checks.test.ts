import { describe, expect, it } from 'vitest';
import { containsDate, keepCitedSentences, quoteIn } from './checks';

describe('containsDate', () => {
  it.each([
    ['Oddał raport 12.03.', true],
    ['Oddał raport 12.03.2026 przed terminem.', true],
    ['Oddał raport 2026-03-12.', true],
    ['Oddał raport 12 marca przed terminem.', true],
    ['Terminowo pracuje', false],
  ])('%s gives %s', (text, expected) => {
    expect(containsDate(text)).toBe(expected);
  });
});

describe('keepCitedSentences', () => {
  it('drops sentences without notes or with unknown notes', () => {
    const kept = keepCitedSentences(
      [
        { text: 'a', noteIds: ['n1'] },
        { text: 'b', noteIds: [] },
        { text: 'c', noteIds: ['n1', 'other'] },
      ],
      new Set(['n1']),
    );
    expect(kept.map((sentence) => sentence.text)).toEqual(['a']);
  });
});

describe('quoteIn', () => {
  it('returns the slice of the text or null', () => {
    expect(quoteIn('Był na Zwolnieniu lekarskim.', ' zwolnieniu lekarskim ')).toBe(
      'Zwolnieniu lekarskim',
    );
    expect(quoteIn('Był w pracy.', 'urlop')).toBeNull();
    expect(quoteIn('Był w pracy.', '  ')).toBeNull();
  });
});
