import { type Sentence } from '@sarmata/domain';

/** Keeps sentences that cite at least one note and only notes of the run input. */
export function keepCitedSentences(
  sentences: readonly Sentence[],
  noteIds: ReadonlySet<string>,
): Sentence[] {
  return sentences.filter(
    (sentence) => sentence.noteIds.length > 0 && sentence.noteIds.every((id) => noteIds.has(id)),
  );
}

const MONTHS =
  'stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia';

const DATE_PATTERNS: readonly RegExp[] = [
  /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/,
  /(?<!\d)\d{1,2}\.\d{1,2}(?:\.\d{2,4})?(?!\d)/,
  new RegExp(`(?<!\\d)\\d{1,2}\\s+(?:${MONTHS})(?!\\p{L})`, 'iu'),
];

/** True when the text names a day: `12.03`, `12.03.2026`, `2026-03-12` or `12 marca`. */
export function containsDate(text: string): boolean {
  return DATE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * The fragment as it stands in the text, or `null` when the text does not contain it. Case and
 * surrounding whitespace of the fragment do not matter, the result is the original slice of the text.
 */
export function quoteIn(text: string, fragment: string): string | null {
  const wanted = fragment.trim();
  if (wanted === '') return null;
  if (text.includes(wanted)) return wanted;
  const index = text.toLowerCase().indexOf(wanted.toLowerCase());
  return index === -1 ? null : text.slice(index, index + wanted.length);
}
