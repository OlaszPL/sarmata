import {
  type AiRequestInput,
  type AiRunKind,
  aiFragmentPaths,
  aiRequestSchema,
} from '@sarmata/domain';
import {
  type AiFragmentDecisionKind,
  type AiRun,
  type AiRunRepository,
  type AiUsageLogEntry,
  type NoteRepository,
  type OfficeSettingsRepository,
  type RegulationVersionRepository,
  RepositoryError,
} from '@sarmata/repositories';
import { z } from 'zod';
import { ServiceError } from '../errors';
import { type EvaluationService } from '../evaluations/evaluation-service';
import { buildAiInput } from './ai-input';

export interface AiDecisionInput {
  readonly fragment: string;
  readonly decision: AiFragmentDecisionKind;
  /** Required for `edited`, absent otherwise. */
  readonly finalText?: string;
}

export interface AiRunListFilter {
  readonly employeeId?: string;
  readonly evaluationId?: string;
  readonly kind?: AiRunKind;
}

/**
 * The AI services for evaluators and hr. `start` stores a queued run with the input snapshot, the
 * worker runs it, the frontend polls `get`. Every result is a suggestion the user decides about
 * fragment by fragment (`decide`), the run with its decisions is the AI usage log. The admin reads
 * that log through `usageLog`: metadata and decisions, never the content.
 */
export interface AiService {
  /** Throws `ZodError` for an invalid request, `ai_disabled` when the office switched AI off. */
  start(request: AiRequestInput): Promise<AiRun>;
  /**
   * `not_found` for a run the account cannot see. While the run is running it carries the progress
   * the worker writes about once per second: `partialText` (raw model text), `partialOutput` (the
   * finished part, e.g. the finished criteria of a sheet draft) and `outputTokens`. Poll it about
   * once per second until `done` or `failed`.
   */
  get(id: string): Promise<AiRun>;
  /** Newest first, at most 50. */
  list(filter: AiRunListFilter): Promise<AiRun[]>;
  /**
   * `ai_run_not_done` before the result, `ai_fragment_unknown` for a fragment outside the output
   * (details: the unknown fragments), `forbidden` when access rules reject the decision.
   */
  decide(runId: string, decisions: readonly AiDecisionInput[]): Promise<AiRun>;
  /**
   * Admin only (`forbidden` otherwise): metadata of the office's AI runs and the decisions, no
   * content. Newest first, default `limit` 100, the database clamps it to 1..500.
   */
  usageLog(options?: { readonly limit?: number }): Promise<AiUsageLogEntry[]>;
}

const DEFAULT_USAGE_LOG_LIMIT = 100;

export interface AiServiceDependencies {
  readonly runs: AiRunRepository;
  readonly notes: NoteRepository;
  readonly settings: OfficeSettingsRepository;
  readonly evaluations: EvaluationService;
  readonly regulations: RegulationVersionRepository;
}

const decisionsSchema = z.array(
  z
    .strictObject({
      fragment: z.string().min(1),
      decision: z.enum(['accepted', 'edited', 'rejected']),
      finalText: z.string().trim().min(1).max(10_000).optional(),
    })
    .refine((entry) => (entry.decision === 'edited') === (entry.finalText !== undefined), {
      message: 'An edited fragment has its final text, other decisions have none',
      path: ['finalText'],
    }),
);

export function createAiService(deps: AiServiceDependencies): AiService {
  async function get(id: string): Promise<AiRun> {
    const run = await deps.runs.get(id);
    if (run === null) throw new ServiceError('not_found', `AI run ${id} not found`);
    return run;
  }

  return {
    async start(raw) {
      const request = aiRequestSchema.parse(raw);
      const settings = await deps.settings.get();
      if (settings === null) throw new ServiceError('not_found', 'Office settings not found');
      if (!settings.aiEnabled) {
        throw new ServiceError('ai_disabled', 'AI is switched off in the office settings');
      }
      const built = await buildAiInput(request, {
        runs: deps.runs,
        notes: deps.notes,
        evaluations: deps.evaluations,
        regulations: deps.regulations,
        settings,
      });
      try {
        return await deps.runs.create({ kind: request.kind, ...built });
      } catch (error) {
        if (error instanceof RepositoryError && error.code === '42501') {
          throw new ServiceError('forbidden', 'This account cannot use the AI services');
        }
        throw error;
      }
    },

    get,

    list: (filter) => deps.runs.list(filter),

    async decide(runId, raw) {
      const decisions = decisionsSchema.parse(raw);
      const run = await get(runId);
      if (run.status !== 'done') {
        throw new ServiceError('ai_run_not_done', `AI run ${runId} has no result yet`);
      }
      const paths = new Set(run.output === null ? [] : aiFragmentPaths(run.kind, run.output));
      const unknown = decisions.filter((entry) => !paths.has(entry.fragment));
      if (unknown.length > 0) {
        throw new ServiceError(
          'ai_fragment_unknown',
          'The run output has no such fragment',
          unknown.map((entry) => entry.fragment),
        );
      }
      const saved = await deps.runs.addDecisions(
        runId,
        decisions.map((entry) => ({
          fragment: entry.fragment,
          decision: entry.decision,
          ...(entry.finalText === undefined ? {} : { finalText: entry.finalText }),
        })),
      );
      if (!saved) throw new ServiceError('forbidden', 'This account cannot decide about this run');
      return get(runId);
    },

    async usageLog(options = {}) {
      try {
        return await deps.runs.usageLog(options.limit ?? DEFAULT_USAGE_LOG_LIMIT);
      } catch (error) {
        if (error instanceof RepositoryError && error.code === '42501') {
          throw new ServiceError('forbidden', 'Only the office admin reads the AI usage log');
        }
        throw error;
      }
    },
  };
}
