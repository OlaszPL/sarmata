import {
  type AiInput,
  type AiOutput,
  type AiRunKind,
  type CriterionFact,
  type NoteFact,
} from '@sarmata/domain';
import { z } from 'zod';
import { type Ai } from '../ai';
import { type LegalSearch } from '../legal-search';
import { type AiResult } from '../result';

export interface TaskDeps {
  readonly ai: Ai;
  readonly legalSearch: LegalSearch;
  /** System prompt of the task, loaded by the runner. */
  readonly system: string;
}

/** One AI service: validated input in, output that matches `aiOutputSchemas[kind]` out. */
export type Task<K extends AiRunKind> = (
  input: AiInput<K>,
  deps: TaskDeps,
  signal?: AbortSignal,
) => Promise<AiResult<AiOutput<K>>>;

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

/** Notes for a prompt, one per line, with the id the model must cite. */
export function describeNotes(notes: readonly NoteFact[]): string {
  if (notes.length === 0) return '(brak notatek)';
  return notes
    .map((note) => {
      const details = [
        note.occurredOn,
        KIND_NAMES[note.kind],
        note.sign === null ? null : note.sign === 'plus' ? 'plus' : 'minus',
        note.criterionId === null ? null : `kryterium ${note.criterionId}`,
      ].filter((part) => part !== null);
      return `[${note.id}] ${details.join(', ')}: ${note.body}`;
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
