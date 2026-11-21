export type SensitiveCategory = 'health' | 'family' | 'religion' | 'diagnosis';

export interface SensitiveDataWarning {
  category: SensitiveCategory;
  fragment: string;
}

/**
 * Polish word stems per category, case-insensitive. A stem must start a word, so inflected forms match
 * (`zwolnieniu`, `chorobie`). The one list the guard reads: a second adapter (AI, B7) will sit beside it.
 */
const SENSITIVE_PATTERNS: readonly { category: SensitiveCategory; pattern: RegExp }[] = [
  {
    category: 'health',
    pattern:
      /(?<!\p{L})(zwolnie|chor[oaeyąę]|choruj|l4(?!\p{L})|szpital|operacj|zdrowi|leczeni|leczy|rehabilitacj|kuracj|ciąż|macierzyńsk)\p{L}*/iu,
  },
  {
    category: 'diagnosis',
    pattern:
      /(?<!\p{L})(depresj|nerwic|schizofreni|wypaleni|uzależnie|alkohol|nowotwor|rak(?!\p{L})|cukrzyc|epilepsj|adhd|autyzm|lęk)\p{L}*/iu,
  },
  {
    category: 'family',
    pattern:
      /(?<!\p{L})(rozwo[dż]|rozwód|żon[aęyą]|mąż|męża|małżon|dziec|rozstani|separacj|pogrzeb|żałob|rodzin)\p{L}*/iu,
  },
  {
    category: 'religion',
    pattern:
      /(?<!\p{L})(kości[oó]ł|parafi|msz[aeyą](?!\p{L})|wyznani|religi|modli|ksiądz|księdz|meczet|cerkw|synagog)\p{L}*/iu,
  },
];

/** Deterministic guard for notes: one warning per sensitive category found in the text. */
export function sensitiveDataWarnings(text: string): SensitiveDataWarning[] {
  const warnings: SensitiveDataWarning[] = [];
  for (const { category, pattern } of SENSITIVE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) warnings.push({ category, fragment: match[0] });
  }
  return warnings;
}
