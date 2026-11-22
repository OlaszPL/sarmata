import { readFileSync } from 'node:fs';

/**
 * Version of every system prompt. The only place to bump a version: a changed prompt is a new file
 * `prompts/<name>.v<n>.md`, and the run log keeps the id (`prompt_version`) of the prompt it used.
 */
export const PROMPT_VERSIONS = {
  'sheet-draft': 4,
  'quality-check': 1,
  'sensitive-data': 2,
  'conversation-prep': 3,
  'criteria-proposals': 2,
  'appreciation-moments': 2,
  'hr-signals': 4,
  'procedure-question': 2,
} as const;

export type PromptName = keyof typeof PROMPT_VERSIONS;

export interface Prompt {
  /** E.g. `sheet-draft.v1`. */
  readonly id: string;
  readonly system: string;
}

const cache = new Map<PromptName, Prompt>();

/** Reads the prompt file next to the package sources (no bundler: the worker runs it with tsx). */
export function loadPrompt(name: PromptName): Prompt {
  const cached = cache.get(name);
  if (cached) return cached;
  const id = `${name}.v${PROMPT_VERSIONS[name]}`;
  const system = readFileSync(new URL(`../prompts/${id}.md`, import.meta.url), 'utf8').trim();
  const prompt = { id, system };
  cache.set(name, prompt);
  return prompt;
}
