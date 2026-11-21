import {
  type AiInput,
  type AiOutput,
  type AiRunKind,
  aiInputSchemas,
  aiOutputSchemas,
} from '@sarmata/domain';
import { z } from 'zod';
import { type Ai, createAi } from './ai';
import { aiConfigFromEnv, legalSearchConfigFromEnv } from './config';
import { type LegalSearch, createSembleLegalSearch } from './legal-search';
import { type PromptName, loadPrompt } from './prompts';
import { type AiResult, failure } from './result';
import { appreciationMoments } from './tasks/appreciation-moments';
import { conversationPrep } from './tasks/conversation-prep';
import { criteriaProposals } from './tasks/criteria-proposals';
import { hrSignals } from './tasks/hr-signals';
import { procedureQuestion } from './tasks/procedure-question';
import { qualityCheck } from './tasks/quality-check';
import { sensitiveData } from './tasks/sensitive-data';
import { sheetDraft } from './tasks/sheet-draft';
import { type Task } from './tasks/task';

/** Runs one AI service on the input snapshot of a run. Prompts, model schemas and checks live inside. */
export interface AiRunner {
  /**
   * The input is validated with `aiInputSchemas[kind]` (`rejected` when it does not match). The output
   * always matches `aiOutputSchemas[kind]`.
   */
  execute(
    run: { readonly kind: AiRunKind; readonly input: unknown },
    signal?: AbortSignal,
  ): Promise<AiResult<{ output: AiOutput<AiRunKind>; promptVersion: string }>>;
}

interface TaskEntry<K extends AiRunKind> {
  readonly prompt: PromptName;
  readonly run: Task<K>;
}

const TASKS: { readonly [K in AiRunKind]: TaskEntry<K> } = {
  sheet_draft: { prompt: 'sheet-draft', run: sheetDraft },
  quality_check: { prompt: 'quality-check', run: qualityCheck },
  sensitive_data: { prompt: 'sensitive-data', run: sensitiveData },
  conversation_prep: { prompt: 'conversation-prep', run: conversationPrep },
  criteria_proposals: { prompt: 'criteria-proposals', run: criteriaProposals },
  appreciation_moments: { prompt: 'appreciation-moments', run: appreciationMoments },
  hr_signals: { prompt: 'hr-signals', run: hrSignals },
  procedure_question: { prompt: 'procedure-question', run: procedureQuestion },
};

export function createAiRunner(deps: { ai: Ai; legalSearch: LegalSearch }): AiRunner {
  async function executeKind<K extends AiRunKind>(
    kind: K,
    raw: unknown,
    signal: AbortSignal | undefined,
  ): Promise<AiResult<{ output: AiOutput<K>; promptVersion: string }>> {
    const entry = TASKS[kind];
    const input = aiInputSchemas[kind].safeParse(raw);
    if (!input.success) {
      return failure('rejected', `Invalid ${kind} input: ${z.prettifyError(input.error)}`);
    }
    const prompt = loadPrompt(entry.prompt);
    const result = await entry.run(
      input.data as AiInput<K>,
      { ai: deps.ai, legalSearch: deps.legalSearch, system: prompt.system },
      signal,
    );
    if (!result.ok) return result;
    const output = aiOutputSchemas[kind].safeParse(result.value);
    if (!output.success) {
      return failure(
        'invalid_response',
        `Invalid ${kind} output: ${z.prettifyError(output.error)}`,
      );
    }
    return { ok: true, value: { output: output.data as AiOutput<K>, promptVersion: prompt.id } };
  }

  return {
    execute(run, signal) {
      if (!deps.ai.available.text && !deps.ai.available.decision) {
        return Promise.resolve(failure('disabled', 'AI is disabled or no model is configured'));
      }
      return executeKind(run.kind, run.input, signal);
    },
  };
}

/** The runner of the worker: models from `SARMATA_AI_*`, legal search with semble (`SARMATA_SEMBLE_COMMAND`). */
export function aiRunnerFromEnv(env: Record<string, string | undefined>): AiRunner {
  return createAiRunner({
    ai: createAi(aiConfigFromEnv(env)),
    legalSearch: createSembleLegalSearch(legalSearchConfigFromEnv(env)),
  });
}
