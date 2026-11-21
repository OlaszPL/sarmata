import { type AiInput } from '@sarmata/domain';
import { z } from 'zod';
import { type Task, describeCriteria, describeNotes, ok, oneOf, withSignal } from './task';

const CONVERSATIONS: Record<AiInput<'conversation_prep'>['conversation'], string> = {
  starting: 'rozmowa rozpoczynająca okres oceny',
  evaluation: 'rozmowa oceniająca',
  ongoing: 'rozmowa bieżąca',
};

const SIGNAL_NAMES: Record<string, string> = {
  sentiment: 'negatywny wydźwięk notatek',
  overload: 'przeciążenie',
  engagement_drop: 'spadek zaangażowania',
  burnout_risk: 'ryzyko wypalenia',
};

function describeSignals(signals: AiInput<'conversation_prep'>['signals']): string {
  const present = signals?.signals.filter((signal) => signal.present) ?? [];
  if (present.length === 0) return 'Sygnały HR partnera: brak.';
  return `Sygnały HR partnera (sugestia, nie diagnoza):\n${present
    .map(
      (signal) =>
        `- ${SIGNAL_NAMES[signal.signal] ?? signal.signal}, prawdopodobieństwo ${signal.probability.toFixed(2)}`,
    )
    .join('\n')}`;
}

/** Goal, plan, questions per criterion and hints for a conversation, from notes and the latest signals. */
export const conversationPrep: Task<'conversation_prep'> = async (
  input,
  { ai, system },
  signal,
) => {
  const result = await ai.generateObject({
    schemaName: 'conversation_prep',
    schema: z.object({
      goal: z.string(),
      plan: z.array(z.string()),
      questions: z.array(
        z.object({
          criterionId: oneOf(input.criteria.map((criterion) => criterion.id)),
          questions: z.array(z.string()),
        }),
      ),
      difficultSituations: z.array(
        z.object({
          situation: z.enum(['defensive_reaction', 'negative_outcome', 'other']),
          hint: z.string(),
        }),
      ),
    }),
    system,
    prompt:
      `Rodzaj rozmowy: ${CONVERSATIONS[input.conversation]}.\n\n` +
      `Kryteria:\n${describeCriteria(input.criteria)}\n\n` +
      `Notatki oceniającego:\n${describeNotes(input.notes)}\n\n` +
      describeSignals(input.signals),
    // Questions for every criterion: up to the 14 of the catalog for a starting conversation.
    maxTokens: 3072,
    ...withSignal(signal),
  });
  if (!result.ok) return result;
  return ok(result.value);
};
