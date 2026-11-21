import { type SensitiveDataWarning, sensitiveDataWarnings } from '@sarmata/domain';
import { z } from 'zod';
import { quoteIn } from './checks';
import { type Task, ok, withSignal } from './task';

const CATEGORIES = ['health', 'family', 'religion', 'diagnosis'] as const;

/**
 * Second adapter of the sensitive data guard: the keyword warnings of B3 (from the snapshot) plus
 * what the model finds. A model warning must quote the text. The model also proposes a rewrite of
 * the whole note without the sensitive data, kept only when there are warnings, it differs from the
 * note, it no longer contains any flagged fragment, the dictionary guard finds nothing in it (the
 * save would warn again) and it introduces no capitalized word absent from the note (a small model
 * mangles names). A model failure fails the run: the keyword
 * warnings already show when the note is saved.
 */
export const sensitiveData: Task<'sensitive_data'> = async (input, { ai, system }, signal) => {
  const result = await ai.generateObject({
    schemaName: 'sensitive_data',
    schema: z.object({
      warnings: z.array(z.object({ category: z.enum(CATEGORIES), fragment: z.string() })),
      rewrite: z.string().nullable(),
    }),
    system,
    prompt: promptFor(input.text, input.keywordWarnings),
    ...withSignal(signal),
  });
  if (!result.ok) return result;
  const warnings: SensitiveDataWarning[] = [];
  const seen = new Set<string>();
  const add = (warning: SensitiveDataWarning): void => {
    const key = `${warning.category}|${warning.fragment.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(warning);
  };
  input.keywordWarnings.forEach(add);
  for (const warning of result.value.warnings) {
    const fragment = quoteIn(input.text, warning.fragment);
    if (fragment !== null) add({ category: warning.category, fragment });
  }
  return ok({ warnings, rewrite: usableRewrite(result.value.rewrite, input.text, warnings) });
};

function promptFor(text: string, keywordWarnings: readonly SensitiveDataWarning[]): string {
  const note = `Notatka:\n${text}`;
  if (keywordWarnings.length === 0) return note;
  const lines = keywordWarnings.map((warning) => `- ${warning.category}: ${warning.fragment}`);
  return `${note}\n\nSłownik wskazał fragmenty:\n${lines.join('\n')}`;
}

function usableRewrite(
  rewrite: string | null,
  text: string,
  warnings: readonly SensitiveDataWarning[],
): string | null {
  if (warnings.length === 0 || rewrite === null) return null;
  const trimmed = rewrite.trim();
  if (trimmed === '' || trimmed === text.trim()) return null;
  const lower = trimmed.toLowerCase();
  if (warnings.some((warning) => lower.includes(warning.fragment.toLowerCase()))) return null;
  if (sensitiveDataWarnings(trimmed).length > 0) return null;
  const known = new Set(capitalizedWords(text));
  if (capitalizedWords(trimmed).some((word) => !known.has(word))) return null;
  return trimmed;
}

function capitalizedWords(text: string): string[] {
  return text.match(/\p{Lu}\p{L}*/gu) ?? [];
}
