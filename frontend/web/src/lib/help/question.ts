import { z } from 'zod';
import { type AiRun, type LegalFragment } from '@sarmata/services';
import { routes } from '@/lib/routes';

export type QuestionRun = Extract<AiRun, { kind: 'procedure_question' }>;

/** A run in progress longer than this since `requestedAt` counts as timed out. */
export const QUESTION_TIMEOUT_MS = 240_000;
export const QUESTION_MAX = 500;

const uuid = z.uuid();

const DISABLED_MESSAGE = 'AI jest wyłączone w ustawieniach urzędu.';
const FAILED_MESSAGE =
  'Asystent nie odpowiedział. Spróbuj ponownie albo skorzystaj z instrukcji poniżej.';

/** A fragment of a legal act the answer cites, numbered like the fragment in the run output. */
export interface CitedSource {
  number: number;
  reference: string;
  title: string;
  citation: string;
  heading: string | null;
  text: string;
}

export type QuestionState =
  | { kind: 'waiting' }
  | { kind: 'timed_out' }
  | { kind: 'failed'; message: string }
  | { kind: 'deleted' }
  | {
      kind: 'done';
      answer: string;
      grounded: boolean;
      sources: CitedSource[];
      decided: 'accepted' | 'rejected' | null;
    };

function citedSources(
  citations: readonly { fragmentId: number; reference: string }[],
  fragments: readonly LegalFragment[],
): CitedSource[] {
  const byId = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const seen = new Set<number>();
  const sources: CitedSource[] = [];
  for (const citation of citations) {
    const fragment = byId.get(citation.fragmentId);
    if (fragment === undefined || seen.has(fragment.id)) continue;
    seen.add(fragment.id);
    sources.push({
      number: fragment.id,
      reference: citation.reference,
      title: fragment.title,
      citation: fragment.citation,
      heading: fragment.heading,
      text: fragment.text,
    });
  }
  return sources;
}

function decidedAnswer(run: QuestionRun): 'accepted' | 'rejected' | null {
  let latest: QuestionRun['decisions'][number] | null = null;
  for (const decision of run.decisions) {
    if (decision.fragment !== 'answer') continue;
    if (latest === null || decision.decidedAt >= latest.decidedAt) latest = decision;
  }
  if (latest === null) return null;
  return latest.decision === 'rejected' ? 'rejected' : 'accepted';
}

/** What the page shows for a run of the procedure assistant. */
export function questionState(run: QuestionRun, now: Date): QuestionState {
  if (run.status === 'queued' || run.status === 'running') {
    const age = now.getTime() - Date.parse(run.requestedAt);
    return age > QUESTION_TIMEOUT_MS ? { kind: 'timed_out' } : { kind: 'waiting' };
  }
  if (run.status === 'failed') {
    return {
      kind: 'failed',
      message: run.failure?.reason === 'disabled' ? DISABLED_MESSAGE : FAILED_MESSAGE,
    };
  }
  if (run.contentDeletedAt !== null || run.output === null) return { kind: 'deleted' };
  return {
    kind: 'done',
    answer: run.output.answer,
    grounded: run.output.grounded,
    sources: citedSources(run.output.citations, run.output.fragments),
    decided: decidedAnswer(run),
  };
}

export const questionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(10, 'Wpisz pytanie, co najmniej 10 znaków.')
    .max(QUESTION_MAX, `Pytanie może mieć najwyżej ${QUESTION_MAX} znaków.`),
});

/**
 * Link back to the assistant with the answer in view. The question text comes from the run
 * (`AiRun.question`), so it stays out of the URL. `ocena` keeps the evaluation the question is about.
 */
export function questionHref(runId: string, extra?: { blad?: '1'; ocena?: string | null }): string {
  const evaluation = extra?.ocena ? `&ocena=${extra.ocena}` : '';
  const error = extra?.blad === undefined ? '' : `&blad=${extra.blad}`;
  return `${routes.help}?pytanie=${runId}${evaluation}${error}#odpowiedz`;
}

/** The evaluation id of `?ocena=` or a posted field, null when it is missing or not a uuid. */
export function evaluationIdOf(raw: unknown): string | null {
  return typeof raw === 'string' && uuid.safeParse(raw).success ? raw : null;
}

export type AskedQuestion =
  | { kind: 'none' }
  | { kind: 'missing' }
  | {
      kind: 'found';
      runId: string;
      /** The question stored with the run, empty after retention removed the content. */
      question: string;
      state: QuestionState;
      /** The evaluation the question was asked about, null for a general question. */
      evaluationId: string | null;
    };

/** Reads `?pytanie=` of the page. A foreign or unknown id is `missing`, never an error. */
export async function questionFromParams(
  params: { pytanie: string },
  get: (id: string) => Promise<AiRun>,
  now: Date,
): Promise<AskedQuestion> {
  if (!uuid.safeParse(params.pytanie).success) return { kind: 'none' };
  let run: AiRun;
  try {
    run = await get(params.pytanie);
  } catch {
    return { kind: 'missing' };
  }
  if (run.kind !== 'procedure_question') return { kind: 'missing' };
  return {
    kind: 'found',
    runId: run.id,
    question: (run.question ?? '').slice(0, QUESTION_MAX),
    state: questionState(run, now),
    evaluationId: run.evaluationId,
  };
}
