import { type AiOutput } from '@sarmata/domain';
import { z } from 'zod';
import { containsDate, quoteIn } from './checks';
import { type Task, describeCriteria, ok, withSignal } from './task';

type Issue = AiOutput<'quality_check'>['issues'][number];

const NO_DATE: Issue = {
  type: 'no_date',
  fragment: null,
  suggestion: 'Dodaj datę zdarzenia, na przykład 12.03.2026.',
};

/**
 * Quality of a sheet text. `no_date` is counted here, the model finds the rest. A fragment the text
 * does not contain becomes null.
 */
export const qualityCheck: Task<'quality_check'> = async (input, { ai, system }, signal) => {
  const types =
    input.criterion === null
      ? (['no_example', 'personality', 'private_sphere'] as const)
      : (['no_example', 'personality', 'private_sphere', 'criterion_mismatch'] as const);
  const result = await ai.generateObject({
    schemaName: 'quality_check',
    schema: z.object({
      issues: z.array(
        z.object({ type: z.enum(types), fragment: z.string().nullable(), suggestion: z.string() }),
      ),
    }),
    system,
    prompt:
      (input.criterion === null
        ? 'Tekst nie jest przypisany do kryterium.\n\n'
        : `Kryterium:\n${describeCriteria([input.criterion])}\n\n`) + `Tekst:\n${input.text}`,
    ...withSignal(signal),
  });
  if (!result.ok) return result;
  const issues: Issue[] = result.value.issues.map((issue) => ({
    type: issue.type,
    fragment: issue.fragment === null ? null : quoteIn(input.text, issue.fragment),
    suggestion: issue.suggestion,
  }));
  return ok({ issues: containsDate(input.text) ? issues : [NO_DATE, ...issues] });
};
