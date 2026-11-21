import {
  type AiInput,
  type AiOutput,
  type HrSignalName,
  sensitiveDataWarnings,
} from '@sarmata/domain';
import { z } from 'zod';
import { type DecisionAnswer, type DecisionQuestion } from '../decision';
import { quoteIn } from './checks';
import { type Task, describeNotes, noteAliases, ok, oneOf, streamCall, withSignal } from './task';

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

// Points, not prose: about 300 output tokens (ADR 0005, Bielik-4.5B on a 16 GB Mac).
const MAX_FRAGMENTS = 2;
const MAX_QUESTIONS = 3;
const MAX_ACTIONS = 4;
const MAX_TOKENS = 420;

const fragmentSchema = z.object({ noteId: z.string(), quote: z.string() });
const actionSchema = z.object({
  framework: z.enum(['jd_r', 'hse']),
  signal: z.string(),
  text: z.string(),
});

/**
 * HR partner signals: sentiment, overload, engagement drop and burnout risk as a suggestion with
 * source fragments, questions and JD-R and HSE actions. Never a diagnosis: a question or an action the
 * sensitive data guard marks as a diagnosis is dropped. The decided signals are the first partial
 * output, then finished questions and actions stream in.
 */
export const hrSignals: Task<'hr_signals'> = async (input, { ai, system, progress }, signal) => {
  // Without notes there is nothing to read a signal from: no model call, every signal absent.
  if (input.notes.length === 0) {
    return ok({
      signals: SIGNALS.map((name) => signalOf(name, undefined)),
      questions: [],
      actions: [],
    });
  }
  const notes = noteAliases(input.notes);
  const state = `Notatki oceniającego:\n${describeNotes(input.notes, notes.aliasOf)}\n\n${describeRatings(input.pastRatings)}`;
  const decided = await ai.decide({ state, questions: QUESTIONS, ...withSignal(signal) });
  if (!decided.ok) return decided;
  const signals = SIGNALS.map((name) => signalOf(name, decided.value[name]));
  const present = signals.filter((entry) => entry.present).map((entry) => entry.signal);
  if (present.length === 0) return ok({ signals, questions: [], actions: [] });
  progress.output({ signals });

  const bodies = new Map(input.notes.map((note) => [note.id, note.body]));
  /** The output from what the model wrote, complete or cut at the limit. Checks every item. */
  const outputOf = (raw: unknown): AiOutput<'hr_signals'> => {
    const fields = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
    const found = list(fields.signals).flatMap((entry) => {
      const parsed = z
        .object({ signal: z.string(), fragments: z.array(fragmentSchema) })
        .safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    });
    return {
      signals: signals.map((entry) => ({
        ...entry,
        fragments: found
          .filter((item) => item.signal === entry.signal)
          .flatMap((item) => item.fragments)
          .flatMap((fragment) => {
            const noteId = notes.toNoteId(fragment.noteId);
            const quote = quoteIn(bodies.get(noteId) ?? '', fragment.quote);
            return quote === null ? [] : [{ noteId, quote }];
          }),
      })),
      questions: list(fields.questions)
        .filter((question): question is string => typeof question === 'string')
        .filter((question) => question.trim() !== '' && !isDiagnostic(question)),
      actions: list(fields.actions).flatMap((entry) => {
        const parsed = actionSchema.safeParse(entry);
        if (!parsed.success || isDiagnostic(parsed.data.text)) return [];
        const name = present.find((candidate) => candidate === parsed.data.signal);
        return name === undefined ? [] : [{ ...parsed.data, signal: name }];
      }),
    };
  };
  const call = streamCall(progress, (prefix) => {
    const partial = outputOf(prefix);
    return { signals, questions: partial.questions, actions: partial.actions };
  });
  const result = await ai.generateObject({
    schemaName: 'hr_signals',
    schema: z.object({
      signals: z
        .array(
          z.object({
            signal: oneOf(present),
            fragments: z
              .array(z.object({ noteId: oneOf(notes.aliases), quote: z.string() }))
              .max(MAX_FRAGMENTS),
          }),
        )
        .max(present.length),
      questions: z.array(z.string()).max(MAX_QUESTIONS),
      actions: z
        .array(
          z.object({
            framework: z.enum(['jd_r', 'hse']),
            signal: oneOf(present),
            text: z.string(),
          }),
        )
        .max(MAX_ACTIONS),
    }),
    system,
    prompt: `Wskazane sygnały: ${present.join(', ')}.\n\n${state}`,
    maxTokens: MAX_TOKENS,
    onProgress: call.onProgress,
    ...withSignal(signal),
  });
  // Where only Bielik-One runs (a 16 GB Mac holds one model at a time), the signals it decided stay,
  // without questions and actions. Other failures of the text model fail the run.
  if (!result.ok && (result.reason === 'disabled' || result.reason === 'unavailable')) {
    return ok({ signals, questions: [], actions: [] });
  }
  if (!result.ok && result.reason !== 'invalid_response') return result;
  return ok(outputOf(result.ok ? result.value : call.prefix()));
};
