import type { AiRun } from '@sarmata/services';

/**
 * Pure part of the conversation preparation panel (`conversation_prep`): which run a screen shows,
 * the state of the panel and the fragments of a done run with their latest decision. No server or
 * React imports, so the client panel, the server loader and the unit test share it.
 */

/** Anchor of the panel, the dashboard links to it on the employee card. */
export const CONVERSATION_PREP_ANCHOR = 'przygotowanie-rozmowy';

export type ConversationKind = 'starting' | 'evaluation' | 'ongoing';

export type PrepRun = Extract<AiRun, { kind: 'conversation_prep' }>;
type PrepOutput = NonNullable<PrepRun['output']>;

export type FragmentDecision = 'accepted' | 'edited' | 'rejected';

/** What the client keeps of a run: plain data the server actions return, no input or refs. */
export interface PrepRunSnapshot {
  id: string;
  status: PrepRun['status'];
  requestedAt: string;
  contentDeletedAt: string | null;
  failureReason: string | null;
  output: PrepOutput | null;
  partialOutput: PrepRun['partialOutput'];
  decisions: {
    fragment: string;
    decision: FragmentDecision;
    finalText: string | null;
    decidedAt: string;
  }[];
}

/** What a page passes to `ConversationPrepPanel` on the first render. */
export interface PrepInitial {
  aiEnabled: boolean;
  run: PrepRunSnapshot | null;
}

/** Which runs belong to one panel. */
export interface PrepScope {
  /** Null for the ongoing conversation of the employee card: runs without an evaluation. */
  evaluationId: string | null;
  /** Runs requested at or after this instant (ISO), e.g. the evaluation conversation after part I. */
  after?: string | null | undefined;
  /** Runs requested before this instant (ISO), e.g. the starting conversation before part I. */
  before?: string | null | undefined;
}

export type PrepState =
  | { kind: 'disabled' }
  | { kind: 'none' }
  | { kind: 'waiting'; progress: PrepProgress }
  | { kind: 'timed_out' }
  | { kind: 'failed'; message: string }
  | { kind: 'deleted' }
  | { kind: 'done'; run: PrepRunSnapshot };

export interface PrepProgress {
  goal: boolean;
  planSteps: number;
  criteria: number;
}

/** A run in progress longer than this since `requestedAt` counts as timed out. */
export const PREP_TIMEOUT_MS = 600_000;

export function prepSnapshot(run: PrepRun): PrepRunSnapshot {
  return {
    id: run.id,
    status: run.status,
    requestedAt: run.requestedAt,
    contentDeletedAt: run.contentDeletedAt,
    failureReason: run.failure?.reason ?? null,
    output: run.output,
    partialOutput: run.partialOutput,
    decisions: run.decisions.map((entry) => ({
      fragment: entry.fragment,
      decision: entry.decision,
      finalText: entry.finalText,
      decidedAt: entry.decidedAt,
    })),
  };
}

function isPrep(run: AiRun): run is PrepRun {
  return run.kind === 'conversation_prep';
}

/**
 * The newest conversation preparation in the scope. The run does not store the kind of conversation,
 * so a case tells the starting and the evaluation conversation apart by the approval of part I.
 */
export function pickPrepRun(runs: readonly AiRun[], scope: PrepScope): PrepRun | null {
  let best: PrepRun | null = null;
  for (const run of runs) {
    if (!isPrep(run) || run.evaluationId !== scope.evaluationId) continue;
    if (scope.after && run.requestedAt < scope.after) continue;
    if (scope.before && run.requestedAt >= scope.before) continue;
    if (best === null || run.requestedAt > best.requestedAt) best = run;
  }
  return best;
}

const FAILED =
  'Nie udało się przygotować rozmowy. Możesz spróbować ponownie albo przygotować się bez AI.';

export function prepState(input: {
  aiEnabled: boolean;
  run: PrepRunSnapshot | null;
  now: Date;
}): PrepState {
  const { run } = input;
  if (!input.aiEnabled) return { kind: 'disabled' };
  if (run === null) return { kind: 'none' };
  if (run.contentDeletedAt !== null) return { kind: 'deleted' };
  if (run.status === 'queued' || run.status === 'running') {
    const age = input.now.getTime() - new Date(run.requestedAt).getTime();
    if (age > PREP_TIMEOUT_MS) return { kind: 'timed_out' };
    const partial = run.partialOutput;
    return {
      kind: 'waiting',
      progress: {
        goal: typeof partial?.goal === 'string' && partial.goal !== '',
        planSteps: partial?.plan?.length ?? 0,
        criteria: partial?.questions?.length ?? 0,
      },
    };
  }
  if (run.status === 'failed') {
    return {
      kind: 'failed',
      message:
        run.failureReason === 'disabled' ? 'AI jest wyłączone w ustawieniach urzędu.' : FAILED,
    };
  }
  if (run.output === null) return { kind: 'deleted' };
  return { kind: 'done', run };
}

export interface PrepFragment {
  /** Path of the fragment for `ai.decide`, e.g. `plan.0` or `question.reliability.1`. */
  fragment: string;
  text: string;
  decided: FragmentDecision | null;
  /** The corrected text of an `edited` decision, null otherwise. */
  finalText: string | null;
}

export interface PrepSections {
  goal: PrepFragment;
  plan: PrepFragment[];
  questions: { criterionId: string; name: string; items: PrepFragment[] }[];
  situations: (PrepFragment & { label: string })[];
  /** Fragments without a decision yet. */
  open: number;
}

const SITUATION_LABELS: Record<PrepOutput['difficultSituations'][number]['situation'], string> = {
  defensive_reaction: 'Reakcja obronna',
  negative_outcome: 'Wynik negatywny',
  other: 'Inna trudna sytuacja',
};

/**
 * Fragments of a done run with the latest decision of each, in the order of the panel. Fragment
 * paths follow `aiFragmentPaths` of `@sarmata/domain`. Criteria without a name keep their id.
 */
export function prepSections(
  run: PrepRunSnapshot,
  criterionNames: Readonly<Record<string, string>>,
): PrepSections | null {
  const output = run.output;
  if (output === null) return null;

  const latest = new Map<string, PrepRunSnapshot['decisions'][number]>();
  for (const entry of run.decisions) {
    const previous = latest.get(entry.fragment);
    if (previous === undefined || entry.decidedAt >= previous.decidedAt) {
      latest.set(entry.fragment, entry);
    }
  }
  const fragment = (path: string, text: string): PrepFragment => {
    const decision = latest.get(path);
    return {
      fragment: path,
      text,
      decided: decision?.decision ?? null,
      finalText: decision?.decision === 'edited' ? decision.finalText : null,
    };
  };

  const goal = fragment('goal', output.goal);
  const plan = output.plan.map((step, index) => fragment(`plan.${index}`, step));
  const questions = output.questions
    .filter((entry) => entry.questions.length > 0)
    .map((entry) => ({
      criterionId: entry.criterionId,
      name: criterionNames[entry.criterionId] ?? entry.criterionId,
      items: entry.questions.map((question, index) =>
        fragment(`question.${entry.criterionId}.${index}`, question),
      ),
    }));
  const situations = output.difficultSituations.map((entry, index) => ({
    ...fragment(`situation.${index}`, entry.hint),
    label: SITUATION_LABELS[entry.situation],
  }));
  const all = [goal, ...plan, ...questions.flatMap((entry) => entry.items), ...situations];
  return {
    goal,
    plan,
    questions,
    situations,
    open: all.filter((entry) => entry.decided === null).length,
  };
}

export const CONVERSATION_TITLES: Record<ConversationKind, string> = {
  starting: 'Przygotowanie rozmowy rozpoczynającej',
  evaluation: 'Przygotowanie rozmowy oceniającej',
  ongoing: 'Przygotowanie rozmowy bieżącej',
};
