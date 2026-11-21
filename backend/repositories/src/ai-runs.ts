import {
  type AiInput,
  type AiInputRefs,
  type AiOutput,
  type AiRunKind,
  type AiRunStatus,
  aiInputRefsSchema,
  aiOutputSchemas,
} from '@sarmata/domain';
import { type Db, type ServiceDb } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

export type AiFragmentDecisionKind = 'accepted' | 'edited' | 'rejected';

/** Decyzja o fragmencie AI: the latest decision about one fragment of a run output. */
export interface AiFragmentDecision {
  readonly fragment: string;
  readonly decision: AiFragmentDecisionKind;
  /** Null unless edited, and after retention removed the content. */
  readonly finalText: string | null;
  readonly contentDeletedAt: string | null;
  readonly decidedBy: string;
  readonly decidedAt: string;
}

interface AiRunBase {
  readonly id: string;
  readonly officeId: string;
  readonly status: AiRunStatus;
  readonly requestedBy: string;
  readonly employeeId: string | null;
  readonly evaluationId: string | null;
  readonly inputRefs: AiInputRefs;
  readonly promptVersion: string | null;
  readonly failure: { readonly reason: string; readonly message: string | null } | null;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  /** Set when retention removed the content: the output is null then, the metadata stays. */
  readonly contentDeletedAt: string | null;
  readonly decisions: AiFragmentDecision[];
}

/** Przebieg AI: one entry of the AI usage log and the state of its job. */
export type AiRun = {
  [K in AiRunKind]: AiRunBase & { readonly kind: K; readonly output: AiOutput<K> | null };
}[AiRunKind];

export interface AiRunFilter {
  readonly employeeId?: string;
  readonly evaluationId?: string;
  readonly kind?: AiRunKind;
  readonly status?: AiRunStatus;
}

export interface NewAiFragmentDecision {
  readonly fragment: string;
  readonly decision: AiFragmentDecisionKind;
  readonly finalText?: string;
}

export interface AiRunRepository {
  /** A queued run of the signed-in account. The trigger sends `ai.run` to the worker. */
  create<K extends AiRunKind>(run: {
    readonly kind: K;
    readonly employeeId: string | null;
    readonly evaluationId: string | null;
    readonly input: AiInput<K>;
    readonly inputRefs: AiInputRefs;
  }): Promise<AiRun>;
  /** `null` for a run that does not exist or is not visible. */
  get(id: string): Promise<AiRun | null>;
  /** Newest first, at most 50, without the input snapshot. */
  list(filter: AiRunFilter): Promise<AiRun[]>;
  /** `false` when access rules do not allow it (not a done run, or not a reader with a writing role). */
  addDecisions(runId: string, decisions: readonly NewAiFragmentDecision[]): Promise<boolean>;
}

/** The worker side of a run. Needs the service client. */
export interface AiRunQueueStore {
  /**
   * Marks a queued run, or a running one started more than `staleAfterMs` ago, as running. `null` when
   * another delivery already has it or it is finished.
   */
  claim(
    id: string,
    staleAfterMs: number,
  ): Promise<{ kind: AiRunKind; input: unknown; aiEnabled: boolean } | null>;
  finish(
    id: string,
    outcome:
      | { readonly output: unknown; readonly promptVersion: string }
      | { readonly failure: { readonly reason: string; readonly message: string } },
  ): Promise<void>;
}

const DECISION_COLUMNS =
  'fragment, decision, final_text, content_deleted_at, decided_by, decided_at';

const COLUMNS =
  `id, office_id, kind, status, requested_by, employee_id, evaluation_id, input_refs, output, prompt_version, failure_reason, failure_message, requested_at, started_at, finished_at, content_deleted_at, ai_fragment_decisions(${DECISION_COLUMNS})` as const;

interface DecisionRow {
  fragment: string;
  decision: string;
  final_text: string | null;
  content_deleted_at: string | null;
  decided_by: string;
  decided_at: string;
}

interface RunRow {
  id: string;
  office_id: string;
  kind: AiRunKind;
  status: AiRunStatus;
  requested_by: string;
  employee_id: string | null;
  evaluation_id: string | null;
  input_refs: unknown;
  output: unknown;
  prompt_version: string | null;
  failure_reason: string | null;
  failure_message: string | null;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  content_deleted_at: string | null;
  ai_fragment_decisions: DecisionRow[];
}

const asDecision = (value: string): AiFragmentDecisionKind =>
  value === 'edited' || value === 'rejected' ? value : 'accepted';

/** The latest decision per fragment, in the order the fragments were first decided. */
function latestDecisions(rows: readonly DecisionRow[]): AiFragmentDecision[] {
  const latest = new Map<string, AiFragmentDecision>();
  for (const row of [...rows].sort((a, b) => a.decided_at.localeCompare(b.decided_at))) {
    latest.set(row.fragment, {
      fragment: row.fragment,
      decision: asDecision(row.decision),
      finalText: row.final_text,
      contentDeletedAt: row.content_deleted_at,
      decidedBy: row.decided_by,
      decidedAt: row.decided_at,
    });
  }
  return [...latest.values()];
}

function toRun(row: RunRow): AiRun {
  let output: unknown = null;
  if (row.output !== null && row.content_deleted_at === null) {
    const parsed = aiOutputSchemas[row.kind].safeParse(row.output);
    if (!parsed.success) {
      throw new RepositoryError('aiRuns.read', {
        message: `Invalid ${row.kind} output of ${row.id}`,
      });
    }
    output = parsed.data;
  }
  return {
    id: row.id,
    officeId: row.office_id,
    kind: row.kind,
    status: row.status,
    requestedBy: row.requested_by,
    employeeId: row.employee_id,
    evaluationId: row.evaluation_id,
    inputRefs: aiInputRefsSchema.parse(row.input_refs) as AiInputRefs,
    output,
    promptVersion: row.prompt_version,
    failure:
      row.failure_reason === null
        ? null
        : { reason: row.failure_reason, message: row.failure_message },
    requestedAt: row.requested_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    contentDeletedAt: row.content_deleted_at,
    decisions: latestDecisions(row.ai_fragment_decisions),
  } as AiRun;
}

export function createAiRunRepository(db: Db): AiRunRepository {
  return {
    async create(run) {
      const { data, error } = await db
        .from('ai_runs')
        .insert({
          kind: run.kind,
          employee_id: run.employeeId,
          evaluation_id: run.evaluationId,
          input: toJson(run.input),
          input_refs: toJson(run.inputRefs),
        })
        .select(COLUMNS)
        .single();
      if (error) throw new RepositoryError('aiRuns.create', error);
      return toRun(data);
    },

    async get(id) {
      const { data, error } = await db.from('ai_runs').select(COLUMNS).eq('id', id).maybeSingle();
      if (error) throw new RepositoryError('aiRuns.get', error);
      return data === null ? null : toRun(data);
    },

    async list(filter) {
      let query = db.from('ai_runs').select(COLUMNS);
      if (filter.employeeId !== undefined) query = query.eq('employee_id', filter.employeeId);
      if (filter.evaluationId !== undefined) query = query.eq('evaluation_id', filter.evaluationId);
      if (filter.kind !== undefined) query = query.eq('kind', filter.kind);
      if (filter.status !== undefined) query = query.eq('status', filter.status);
      const { data, error } = await query.order('requested_at', { ascending: false }).limit(50);
      if (error) throw new RepositoryError('aiRuns.list', error);
      return data.map(toRun);
    },

    async addDecisions(runId, decisions) {
      if (decisions.length === 0) return true;
      const { error } = await db.from('ai_fragment_decisions').insert(
        decisions.map((decision) => ({
          run_id: runId,
          fragment: decision.fragment,
          decision: decision.decision,
          final_text: decision.finalText ?? null,
        })),
      );
      if (error?.code === '42501') return false;
      if (error) throw new RepositoryError('aiRuns.addDecisions', error);
      return true;
    },
  };
}

export function createAiRunQueueStore(db: ServiceDb): AiRunQueueStore {
  return {
    async claim(id, staleAfterMs) {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - staleAfterMs).toISOString();
      const { data, error } = await db
        .from('ai_runs')
        .update({ status: 'running', started_at: now.toISOString() })
        .eq('id', id)
        .or(`status.eq.queued,and(status.eq.running,started_at.lt."${staleBefore}")`)
        .select('kind, input, office_id')
        .maybeSingle();
      if (error) throw new RepositoryError('aiRuns.claim', error);
      if (data === null) return null;
      const { data: settings, error: settingsError } = await db
        .from('office_settings')
        .select('ai_enabled')
        .eq('office_id', data.office_id)
        .maybeSingle();
      if (settingsError) throw new RepositoryError('aiRuns.claim', settingsError);
      return { kind: data.kind, input: data.input, aiEnabled: settings?.ai_enabled ?? false };
    },

    async finish(id, outcome) {
      const columns =
        'output' in outcome
          ? {
              status: 'done' as const,
              output: toJson(outcome.output),
              prompt_version: outcome.promptVersion,
              failure_reason: null,
              failure_message: null,
            }
          : {
              status: 'failed' as const,
              output: null,
              failure_reason: outcome.failure.reason,
              failure_message: outcome.failure.message,
            };
      const { error } = await db
        .from('ai_runs')
        .update({ ...columns, finished_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new RepositoryError('aiRuns.finish', error);
    },
  };
}
