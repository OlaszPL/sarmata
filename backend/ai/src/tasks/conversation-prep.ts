import { type AiInput } from '@sarmata/domain';
import { z } from 'zod';
import {
  type Task,
  describeCriteria,
  describeNotes,
  ok,
  oneOf,
  partialOutputOf,
  streamCall,
  withSignal,
} from './task';

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

// Points, not prose: about 400 output tokens for five criteria (ADR 0005, Bielik-4.5B on a 16 GB Mac).
const MAX_PLAN_STEPS = 4;
const MAX_QUESTIONS_PER_CRITERION = 2;
const MAX_SITUATIONS = 2;
const maxTokensFor = (criteria: number): number => Math.min(160 + 70 * criteria, 700);

/**
 * Goal, plan, questions per criterion and hints for a conversation, from notes and the latest
 * signals. Streams: finished points are the partial output. A call cut at the token limit keeps the
 * points it finished.
 */
export const conversationPrep: Task<'conversation_prep'> = async (
  input,
  { ai, system, progress },
  signal,
) => {
  const call = streamCall(progress, (prefix) => partialOutputOf('conversation_prep', prefix));
  const result = await ai.generateObject({
    schemaName: 'conversation_prep',
    schema: z.object({
      goal: z.string(),
      plan: z.array(z.string()).max(MAX_PLAN_STEPS),
      questions: z
        .array(
          z.object({
            criterionId: oneOf(input.criteria.map((criterion) => criterion.id)),
            questions: z.array(z.string()).max(MAX_QUESTIONS_PER_CRITERION),
          }),
        )
        .max(input.criteria.length),
      difficultSituations: z
        .array(
          z.object({
            situation: z.enum(['defensive_reaction', 'negative_outcome', 'other']),
            hint: z.string(),
          }),
        )
        .max(MAX_SITUATIONS),
    }),
    system,
    prompt:
      `Rodzaj rozmowy: ${CONVERSATIONS[input.conversation]}.\n\n` +
      `Kryteria:\n${describeCriteria(input.criteria)}\n\n` +
      `Notatki oceniającego:\n${describeNotes(input.notes)}\n\n` +
      describeSignals(input.signals),
    maxTokens: maxTokensFor(input.criteria.length),
    onProgress: call.onProgress,
    ...withSignal(signal),
  });
  if (result.ok) return ok(result.value);
  if (result.reason !== 'invalid_response') return result;
  // Cut at the limit: what was finished, when the goal at least is there.
  const partial = partialOutputOf('conversation_prep', call.prefix());
  if (partial?.goal === undefined) return result;
  return ok({
    goal: partial.goal,
    plan: partial.plan ?? [],
    questions: partial.questions ?? [],
    difficultSituations: partial.difficultSituations ?? [],
  });
};
