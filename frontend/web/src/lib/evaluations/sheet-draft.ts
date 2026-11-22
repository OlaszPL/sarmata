import { type AiRun, type EvaluationView } from '@sarmata/services';

export type SheetDraftRun = Extract<AiRun, { kind: 'sheet_draft' }>;

export type SheetDraftState =
  | { kind: 'disabled' }
  | { kind: 'none' }
  | { kind: 'waiting'; finished: string[] }
  | { kind: 'timed_out' }
  | { kind: 'failed'; message: string }
  | { kind: 'deleted' }
  | { kind: 'insufficient_data'; questions: string[] }
  | { kind: 'done'; run: SheetDraftRun };

/** A run in progress longer than this since `requestedAt` counts as timed out. */
export const DRAFT_TIMEOUT_MS = 600_000;

function isSheetDraft(run: AiRun): run is SheetDraftRun {
  return run.kind === 'sheet_draft';
}

function newest(runs: SheetDraftRun[]): SheetDraftRun | null {
  return runs.reduce<SheetDraftRun | null>(
    (best, run) => (best === null || run.requestedAt > best.requestedAt ? run : best),
    null,
  );
}

/**
 * The newest run of this evaluation, otherwise the newest run without an evaluation requested since
 * the cycle start (seed data has no evaluation id).
 */
function pickRun(
  runs: readonly AiRun[],
  view: Pick<EvaluationView, 'id' | 'cycleStart'>,
): SheetDraftRun | null {
  const drafts = runs.filter(isSheetDraft);
  const own = newest(drafts.filter((run) => run.evaluationId === view.id));
  if (own !== null) return own;
  return newest(
    drafts.filter((run) => run.evaluationId === null && run.requestedAt >= view.cycleStart),
  );
}

export function sheetDraftState(input: {
  aiEnabled: boolean;
  runs: readonly AiRun[];
  view: Pick<EvaluationView, 'id' | 'cycleStart'>;
  now: Date;
}): SheetDraftState {
  const run = pickRun(input.runs, input.view);
  if (run === null) return input.aiEnabled ? { kind: 'none' } : { kind: 'disabled' };
  if (run.contentDeletedAt !== null) return { kind: 'deleted' };
  if (run.status === 'queued' || run.status === 'running') {
    const age = input.now.getTime() - new Date(run.requestedAt).getTime();
    if (age > DRAFT_TIMEOUT_MS) return { kind: 'timed_out' };
    return {
      kind: 'waiting',
      finished: run.partialOutput?.ratings?.map((r) => r.criterionId) ?? [],
    };
  }
  if (run.status === 'failed') {
    return {
      kind: 'failed',
      message:
        run.failure?.reason === 'disabled'
          ? 'AI jest wyłączone w ustawieniach urzędu.'
          : 'Nie udało się przygotować szkicu. Możesz spróbować ponownie albo wypełnić arkusz bez AI.',
    };
  }
  if (run.output === null) return { kind: 'deleted' };
  if (run.output.status === 'insufficient_data') {
    return { kind: 'insufficient_data', questions: run.output.questions };
  }
  return { kind: 'done', run };
}

type Decided = 'accepted' | 'edited' | 'rejected' | null;

export interface RatingProposal {
  fragment: string;
  criterionId: string;
  points: number | null;
  noteIds: string[];
  decided: Decided;
}

export interface SentenceProposal {
  fragment: string;
  target: 'justification' | 'developmentConclusions';
  text: string;
  noteIds: string[];
  decided: Decided;
}

/** Proposals of a done run with the latest decision of each fragment. */
export function draftProposals(run: SheetDraftRun): {
  ratings: RatingProposal[];
  sentences: SentenceProposal[];
  questions: string[];
  open: number;
} {
  const output = run.output;
  if (output === null) return { ratings: [], sentences: [], questions: [], open: 0 };

  const decisionOf = (fragment: string): Decided => {
    let latest: SheetDraftRun['decisions'][number] | null = null;
    for (const decision of run.decisions) {
      if (decision.fragment !== fragment) continue;
      if (latest === null || decision.decidedAt >= latest.decidedAt) latest = decision;
    }
    return latest?.decision ?? null;
  };

  const ratings = output.ratings.map<RatingProposal>((rating) => {
    const fragment = `rating.${rating.criterionId}`;
    return {
      fragment,
      criterionId: rating.criterionId,
      points: rating.points,
      noteIds: [...new Set(rating.sentences.flatMap((sentence) => sentence.noteIds))],
      decided: decisionOf(fragment),
    };
  });
  const sentences = (['justification', 'developmentConclusions'] as const).flatMap((target) =>
    output[target].map<SentenceProposal>((sentence, index) => {
      const fragment = `${target}.${index}`;
      return {
        fragment,
        target,
        text: sentence.text,
        noteIds: sentence.noteIds,
        decided: decisionOf(fragment),
      };
    }),
  );
  const open =
    ratings.filter((r) => r.points !== null && r.decided === null).length +
    sentences.filter((s) => s.decided === null).length;
  return { ratings, sentences, questions: output.questions, open };
}

export function appendSentence(text: string, sentence: string): string {
  return text === '' ? sentence : `${text.trimEnd()}\n${sentence}`;
}
