import { z } from 'zod';
import { type Task, describeCriteria, ok, oneOf, withSignal } from './task';

/**
 * Additional criteria from the catalog without the mandatory ones of the sheet, and behavioural
 * expectations for the starting conversation.
 */
export const criteriaProposals: Task<'criteria_proposals'> = async (
  input,
  { ai, system },
  signal,
) => {
  const candidates = input.candidates.map((criterion) => criterion.id);
  const result = await ai.generateObject({
    schemaName: 'criteria_proposals',
    schema: z.object({
      additionalCriteria: z.array(z.object({ criterionId: oneOf(candidates), reason: z.string() })),
      behaviouralExpectations: z.array(
        z.object({
          criterionId: oneOf([...input.mandatory.map((criterion) => criterion.id), ...candidates]),
          expectations: z.array(z.string()),
        }),
      ),
    }),
    system,
    prompt:
      `Opis obowiązków pracownika:\n${input.duties}\n\n` +
      `Kryteria obowiązkowe arkusza:\n${describeCriteria(input.mandatory)}\n\n` +
      `Kryteria do wyboru (najwyżej ${input.maxAdditional}):\n${describeCriteria(input.candidates)}`,
    ...withSignal(signal),
  });
  if (!result.ok) return result;
  const seen = new Set<string>();
  const additionalCriteria = result.value.additionalCriteria
    .filter((entry) => {
      if (seen.has(entry.criterionId)) return false;
      seen.add(entry.criterionId);
      return true;
    })
    .slice(0, input.maxAdditional);
  return ok({ additionalCriteria, behaviouralExpectations: result.value.behaviouralExpectations });
};
