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
  const mandatory = input.mandatory.map((criterion) => criterion.id);
  // At least one proposal: the real Bielik left the list empty and still wrote expectations for a
  // candidate it did not propose.
  const atLeast = candidates.length > 0 && input.maxAdditional > 0 ? 1 : 0;
  const result = await ai.generateObject({
    schemaName: 'criteria_proposals',
    schema: z.object({
      additionalCriteria: z
        .array(z.object({ criterionId: oneOf(candidates), reason: z.string() }))
        .min(atLeast),
      behaviouralExpectations: z.array(
        z.object({
          criterionId: oneOf([...mandatory, ...candidates]),
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
  // Expectations only for the criteria of the sheet: the mandatory ones and the proposed ones.
  const onSheet = new Set([...mandatory, ...additionalCriteria.map((entry) => entry.criterionId)]);
  const behaviouralExpectations = result.value.behaviouralExpectations.filter((entry) =>
    onSheet.has(entry.criterionId),
  );
  return ok({ additionalCriteria, behaviouralExpectations });
};
