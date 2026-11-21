import { type SensitiveDataWarning } from '@sarmata/domain';
import { z } from 'zod';
import { quoteIn } from './checks';
import { type Task, ok, withSignal } from './task';

const CATEGORIES = ['health', 'family', 'religion', 'diagnosis'] as const;

/**
 * Second adapter of the sensitive data guard: the keyword warnings of B3 (from the snapshot) plus
 * what the model finds. A model warning must quote the text. A model failure fails the run: the
 * keyword warnings already show when the note is saved.
 */
export const sensitiveData: Task<'sensitive_data'> = async (input, { ai, system }, signal) => {
  const result = await ai.generateObject({
    schemaName: 'sensitive_data',
    schema: z.object({
      warnings: z.array(z.object({ category: z.enum(CATEGORIES), fragment: z.string() })),
    }),
    system,
    prompt: `Notatka:\n${input.text}`,
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
  return ok({ warnings });
};
