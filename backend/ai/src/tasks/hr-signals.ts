import {
  type AiInput,
  type AiOutput,
  type HrSignalName,
  sensitiveDataWarnings,
} from '@sarmata/domain';
import { z } from 'zod';
import { type DecisionAnswer, type DecisionQuestion } from '../decision';
import { quoteIn } from './checks';
import { type Task, describeNotes, ok, oneOf, withSignal } from './task';

const SIGNALS: readonly HrSignalName[] = [
  'sentiment',
  'overload',
  'engagement_drop',
  'burnout_risk',
];

/** Questions to Bielik-One (or the text model where it cannot run). No thresholds: the model decides. */
const QUESTIONS: Record<HrSignalName, DecisionQuestion> = {
  sentiment: {
    type: 'choice',
    instructions: 'Jaki jest ogólny wydźwięk notatek oceniającego o pracy tej osoby?',
    criteria: {
      negative: 'przeważają opisy trudności, problemów i niezadowolenia',
      neutral: 'opisy są rzeczowe, bez wyraźnej przewagi',
      positive: 'przeważają opisy sukcesów i zadowolenia',
    },
  },
  overload: {
    type: 'noul',
    instructions:
      'Czy notatki wskazują na przeciążenie pracą (dodatkowe zadania, nadgodziny, presja czasu)?',
  },
  engagement_drop: {
    type: 'noul',
    instructions:
      'Czy notatki wskazują na spadek zaangażowania w porównaniu z wcześniejszym okresem lub wcześniejszymi ocenami?',
  },
  burnout_risk: {
    type: 'noul',
    instructions:
      'Czy notatki łącznie wskazują na ryzyko wypalenia zawodowego (długotrwałe przeciążenie, spadek zaangażowania, dystans do pracy)? To sygnał dla przełożonego, nie diagnoza.',
  },
};

type Signal = AiOutput<'hr_signals'>['signals'][number];

/**
 * Presence is the argmax of the model, the probability is that of the signal being present. The text
 * model fallback gives one-hot probabilities, so there the probability comes from the confidence the
 * model reports (present: confidence, absent: 1 - confidence) and the signal is marked not calibrated.
 */
function signalOf(name: HrSignalName, answer: DecisionAnswer | undefined): Signal {
  const clamp = (value: number | undefined): number => Math.min(Math.max(value ?? 0, 0), 1);
  const calibrated = answer?.calibrated !== false;
  const declared = (present: boolean): number =>
    clamp(present ? answer?.confidence : 1 - (answer?.confidence ?? 1));
  if (answer?.type === 'choice') {
    const present = answer.choice === 'negative';
    return {
      signal: name,
      present,
      probability: calibrated ? clamp(answer.probabilities.negative) : declared(present),
      calibrated,
      fragments: [],
    };
  }
  if (answer?.type === 'noul') {
    const present = answer.probabilities.true > answer.probabilities.false;
    return {
      signal: name,
      present,
      probability: calibrated ? clamp(answer.probabilities.true) : declared(present),
      calibrated,
      fragments: [],
    };
  }
  return { signal: name, present: false, probability: 0, calibrated: true, fragments: [] };
}

function describeRatings(pastRatings: AiInput<'hr_signals'>['pastRatings']): string {
  if (pastRatings.length === 0) return 'Wcześniejsze oceny cząstkowe: brak.';
  return `Wcześniejsze oceny cząstkowe (skala 1 do 9):\n${pastRatings
    .map(
      (evaluation) =>
        `- cykl od ${evaluation.cycleStart}: ${Object.entries(evaluation.ratings)
          .map(([criterion, points]) => `${criterion} ${points}`)
          .join(', ')}`,
    )
    .join('\n')}`;
}

const isDiagnostic = (text: string): boolean =>
  sensitiveDataWarnings(text).some((warning) => warning.category === 'diagnosis');

/**
 * HR partner signals: sentiment, overload, engagement drop and burnout risk as a suggestion with
 * source fragments, questions and JD-R and HSE actions. Never a diagnosis: a question or an action the
 * sensitive data guard marks as a diagnosis is dropped.
 */
export const hrSignals: Task<'hr_signals'> = async (input, { ai, system }, signal) => {
  // Without notes there is nothing to read a signal from: no model call, every signal absent.
  if (input.notes.length === 0) {
    return ok({
      signals: SIGNALS.map((name) => signalOf(name, undefined)),
      questions: [],
      actions: [],
    });
  }
  const state = `Notatki oceniającego:\n${describeNotes(input.notes)}\n\n${describeRatings(input.pastRatings)}`;
  const decided = await ai.decide({ state, questions: QUESTIONS, ...withSignal(signal) });
  if (!decided.ok) return decided;
  const signals = SIGNALS.map((name) => signalOf(name, decided.value[name]));
  const present = signals.filter((entry) => entry.present).map((entry) => entry.signal);
  if (present.length === 0) return ok({ signals, questions: [], actions: [] });

  const result = await ai.generateObject({
    schemaName: 'hr_signals',
    schema: z.object({
      signals: z.array(
        z.object({
          signal: oneOf(present),
          fragments: z.array(z.object({ noteId: z.string(), quote: z.string() })),
        }),
      ),
      questions: z.array(z.string()),
      actions: z.array(
        z.object({ framework: z.enum(['jd_r', 'hse']), signal: oneOf(present), text: z.string() }),
      ),
    }),
    system,
    prompt: `Wskazane sygnały: ${present.join(', ')}.\n\n${state}`,
    ...withSignal(signal),
  });
  if (!result.ok) return result;
  const bodies = new Map(input.notes.map((note) => [note.id, note.body]));
  return ok({
    signals: signals.map((entry) => {
      const fragments = result.value.signals
        .filter((found) => found.signal === entry.signal)
        .flatMap((found) => found.fragments)
        .flatMap((fragment) => {
          const quote = quoteIn(bodies.get(fragment.noteId) ?? '', fragment.quote);
          return quote === null ? [] : [{ noteId: fragment.noteId, quote }];
        });
      return { ...entry, fragments };
    }),
    questions: result.value.questions.filter((question) => !isDiagnostic(question)),
    actions: result.value.actions
      .filter((action) => !isDiagnostic(action.text))
      .map((action) => ({ ...action, signal: action.signal as HrSignalName })),
  });
};
