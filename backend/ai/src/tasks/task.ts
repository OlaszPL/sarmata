import {
  type AiInput,
  type AiOutput,
  type AiPartialOutput,
  type AiRunKind,
  type CriterionFact,
  type NoteFact,
  aiPartialOutputSchemas,
} from '@sarmata/domain';
import { z } from 'zod';
import { type Ai } from '../ai';
import { type LegalSearch } from '../legal-search';
import { parsePartialJson } from '../partial-json';
import { type TaskProgress } from '../progress';
import { type AiResult } from '../result';
import { type GenerationProgress } from '../text-model';

export interface TaskDeps<K extends AiRunKind = AiRunKind> {
  readonly ai: Ai;
  readonly legalSearch: LegalSearch;
  /** System prompt of the task, loaded by the runner. */
  readonly system: string;
  /** Where a task streams its model calls and the output finished so far. */
  readonly progress: TaskProgress<K>;
}

/** One AI service: validated input in, output that matches `aiOutputSchemas[kind]` out. */
export type Task<K extends AiRunKind> = (
  input: AiInput<K>,
  deps: TaskDeps<K>,
  signal?: AbortSignal,
) => Promise<AiResult<AiOutput<K>>>;

/** One streamed model call: its `onProgress`, and what was complete when it ended. */
export interface StreamedCall {
  readonly onProgress: (generation: GenerationProgress) => void;
  /**
   * The complete part of the JSON the model wrote (`parsePartialJson`). A call cut at `max_tokens`
   * fails as `invalid_response`, and the task can still keep its finished items.
   */
  prefix(): unknown;
}

/**
 * Streams one call into the run progress. `toPartial` turns the complete part of the JSON into the
 * output finished so far.
 */
export function streamCall<K extends AiRunKind>(
  progress: TaskProgress<K>,
  toPartial?: (prefix: unknown) => AiPartialOutput<K> | null,
): StreamedCall {
  const report = progress.call();
  let text = '';
  return {
    onProgress: (generation) => {
      text = generation.text;
      report(generation, toPartial ? toPartial(parsePartialJson(text)) : null);
    },
    prefix: () => parsePartialJson(text),
  };
}

/** The complete part of a one-call output as a partial output of the kind, when it matches. */
export function partialOutputOf<K extends AiRunKind>(
  kind: K,
  prefix: unknown,
): AiPartialOutput<K> | null {
  const parsed = aiPartialOutputSchemas[kind].safeParse(prefix ?? {});
  return parsed.success ? (parsed.data as AiPartialOutput<K>) : null;
}

export const ok = <T>(value: T): AiResult<T> => ({ ok: true, value });

/** `{ signal }` when there is one: `exactOptionalPropertyTypes` forbids an explicit undefined. */
export const withSignal = (signal: AbortSignal | undefined): { signal?: AbortSignal } =>
  signal ? { signal } : {};

/** A string enum for the model schema. Empty lists give a schema nothing matches. */
export function oneOf(values: readonly string[]): z.ZodType<string> {
  const [first, ...rest] = [...new Set(values)];
  return first === undefined ? z.never() : z.enum([first, ...rest]);
}

const KIND_NAMES: Record<NoteFact['kind'], string> = {
  observation: 'obserwacja',
  ongoing_conversation: 'rozmowa bieżąca',
  appreciation: 'docenienie',
  workload_fact: 'fakt obciążenia',
};

/**
 * Short ids for the notes of a prompt (`N1`, `N2`...): the model cites them instead of UUIDs, which
 * cost many output tokens. `toNoteId` maps a cited alias back, an unknown alias stays as it is, so
 * the citation check drops it.
 */
export function noteAliases(notes: readonly NoteFact[]): {
  readonly aliases: string[];
  readonly aliasOf: (note: NoteFact) => string;
  readonly toNoteId: (alias: string) => string;
} {
  const aliases = notes.map((_, index) => `N${index + 1}`);
  const byNote = new Map(notes.map((note, index) => [note.id, aliases[index] ?? note.id]));
  const byAlias = new Map(notes.map((note, index) => [aliases[index] ?? note.id, note.id]));
  return {
    aliases,
    aliasOf: (note) => byNote.get(note.id) ?? note.id,
    toNoteId: (alias) => byAlias.get(alias) ?? alias,
  };
}

/** Notes for a prompt, one per line, with the id (or alias) the model must cite. */
export function describeNotes(
  notes: readonly NoteFact[],
  idOf: (note: NoteFact) => string = (note) => note.id,
): string {
  if (notes.length === 0) return '(brak notatek)';
  return notes
    .map((note) => {
      const details = [
        note.occurredOn,
        KIND_NAMES[note.kind],
        note.sign === null ? null : note.sign === 'plus' ? 'plus' : 'minus',
        note.criterionId === null ? null : `kryterium ${note.criterionId}`,
      ].filter((part) => part !== null);
      return `[${idOf(note)}] ${details.join(', ')}: ${note.body}`;
    })
    .join('\n');
}

/** Criteria for a prompt with their indicators. */
export function describeCriteria(criteria: readonly CriterionFact[]): string {
  return criteria
    .map(
      (criterion) =>
        `- ${criterion.id}: ${criterion.name}` +
        (criterion.indicators.length > 0 ? ` (wskaźniki: ${criterion.indicators.join('; ')})` : ''),
    )
    .join('\n');
}
