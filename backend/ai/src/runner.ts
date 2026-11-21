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
import { type AiRunProgress, trackRunProgress } from './progress';
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

export interface ExecuteOptions {
  readonly signal?: AbortSignal;
  /**
   * Called on every streamed piece of a long task (sheet draft, conversation preparation, HR
   * signals) with the whole state of the run. Often: the caller throttles its writes.
   */
  readonly onProgress?: (progress: AiRunProgress) => void;
}

export interface AiRunResult {
  readonly output: AiOutput<AiRunKind>;
  readonly promptVersion: string;
}

/** Runs one AI service on the input snapshot of a run. Prompts, model schemas and checks live inside. */
export interface AiRunner {
  /**
   * The input is validated with `aiInputSchemas[kind]` (`rejected` when it does not match). The output
   * always matches `aiOutputSchemas[kind]`.
   */
  execute(
    run: { readonly kind: AiRunKind; readonly input: unknown },
    options?: ExecuteOptions,
  ): Promise<AiResult<AiRunResult>>;
}

interface TaskEntry<K extends AiRunKind> {
  readonly prompt: PromptName;
  readonly run: Task<K>;
  /** The model writes long text: the call gets `AiConfig.longTimeoutMs`. */
  readonly long: boolean;
}

const TASKS: { readonly [K in AiRunKind]: TaskEntry<K> } = {
  sheet_draft: { prompt: 'sheet-draft', run: sheetDraft, long: true },
  quality_check: { prompt: 'quality-check', run: qualityCheck, long: false },
  sensitive_data: { prompt: 'sensitive-data', run: sensitiveData, long: false },
  conversation_prep: { prompt: 'conversation-prep', run: conversationPrep, long: true },
  // Expectations for every criterion of the sheet: about 120 s on a 16 GB Mac, past the short limit.
  criteria_proposals: { prompt: 'criteria-proposals', run: criteriaProposals, long: true },
  appreciation_moments: { prompt: 'appreciation-moments', run: appreciationMoments, long: false },
  hr_signals: { prompt: 'hr-signals', run: hrSignals, long: true },
  procedure_question: { prompt: 'procedure-question', run: procedureQuestion, long: false },
};

export function createAiRunner(deps: { ai: Ai; legalSearch: LegalSearch }): AiRunner {
  async function executeKind<K extends AiRunKind>(
    kind: K,
    raw: unknown,
    { signal, onProgress }: ExecuteOptions,
  ): Promise<AiResult<{ output: AiOutput<K>; promptVersion: string }>> {
    const entry = TASKS[kind];
    const input = aiInputSchemas[kind].safeParse(raw);
    if (!input.success) {
      return failure('rejected', `Invalid ${kind} input: ${z.prettifyError(input.error)}`);
    }
    const prompt = loadPrompt(entry.prompt);
    const result = await entry.run(
      input.data as AiInput<K>,
      {
        ai: entry.long ? deps.ai.long : deps.ai,
        legalSearch: deps.legalSearch,
        system: prompt.system,
        progress: trackRunProgress<K>(onProgress),
      },
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
    execute(run, options = {}) {
      if (!deps.ai.available.text && !deps.ai.available.decision) {
        return Promise.resolve(failure('disabled', 'AI is disabled or no model is configured'));
      }
      return executeKind(run.kind, run.input, options);
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
