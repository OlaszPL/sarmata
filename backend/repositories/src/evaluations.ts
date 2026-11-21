import {
  type CalendarDate,
  type DeadlineSlot,
  type EvaluationStatus,
  type ServiceStatus,
  type SheetContent,
  calendarDate,
  sheetContentSchema,
} from '@sarmata/domain';
import { type Database } from '@sarmata/database';
import { type Db } from './db';
import { RepositoryError } from './errors';
import { toJson } from './json';

export type EvaluationEventKind = Database['public']['Enums']['evaluation_event_kind'];
type EventKind = EvaluationEventKind;
type SheetState = 'draft' | 'locked' | 'superseded' | 'cancelled';

/** Employee data as of the day the evaluation was created. */
export interface EvaluatedSnapshot {
  readonly firstName: string;
  readonly lastName: string;
  readonly positionTitle: string | null;
  readonly orgUnit: string | null;
  readonly serviceStatus: ServiceStatus;
  readonly grade: number | null;
  readonly appointmentYear: number | null;
  readonly gradeGrantedOn: CalendarDate | null;
}

export interface Evaluation {
  readonly id: string;
  readonly officeId: string;
  readonly employeeId: string;
  readonly evaluatorAccountId: string;
  /** The regulation document id, e.g. `regulation-2016`. */
  readonly regulationId: string;
  readonly sheetId: string;
  readonly status: EvaluationStatus;
  readonly cycleStart: CalendarDate;
  readonly afterNegative: boolean;
  readonly previousEvaluationId: string | null;
  readonly snapshot: EvaluatedSnapshot;
  readonly createdAt: string;
}

export interface EvaluationEvent {
  readonly id: string;
  readonly kind: EventKind;
  readonly occurredOn: CalendarDate;
  readonly payload: Record<string, unknown>;
  readonly recordedBy: string;
  readonly recordedAt: string;
}

export interface StoredDeadline {
  readonly slot: DeadlineSlot;
  readonly windowStart: CalendarDate | null;
  readonly dueOn: CalendarDate | null;
  readonly suspendedSince: CalendarDate | null;
}

export type EvaluationDetail = Evaluation & {
  readonly sheet: {
    readonly version: number;
    readonly state: SheetState;
    readonly content: SheetContent;
  };
  readonly events: EvaluationEvent[];
  readonly deadlines: StoredDeadline[];
};

export interface NewEvaluation {
  readonly employeeId: string;
  readonly evaluatorAccountId: string;
  readonly regulationVersionId: string;
  readonly sheetId: string;
  readonly cycleStart: CalendarDate;
  readonly afterNegative: boolean;
  readonly previousEvaluationId: string | null;
  readonly previousAcquaintedOn: CalendarDate | null;
  readonly snapshot: EvaluatedSnapshot;
  readonly content: SheetContent;
}

export interface TransitionInput {
  readonly evaluationId: string;
  readonly expectedStatus: EvaluationStatus;
  readonly nextStatus: EvaluationStatus;
  readonly eventKind: EventKind;
  readonly occurredOn: CalendarDate;
  readonly payload: Record<string, unknown>;
  readonly lockSheet: boolean;
}

export interface EvaluationRepository {
  /** Starts an evaluation with sheet version 1 and the `created` event, atomically. */
  create(input: NewEvaluation): Promise<Evaluation>;
  get(id: string): Promise<EvaluationDetail | null>;
  listForOffice(filter?: {
    status?: EvaluationStatus;
    evaluatorAccountId?: string;
    employeeId?: string;
  }): Promise<Evaluation[]>;
  /** The newest evaluation (by cycle start) of the employee. */
  latestForEmployee(employeeId: string): Promise<EvaluationDetail | null>;
  /** Overwrites the content of the current draft sheet version. */
  saveDraft(evaluationId: string, content: SheetContent): Promise<void>;
  /** Moves the evaluation and logs the event, returns the event id. Rejects with `stale_status` or `invalid_transition`. */
  applyTransition(input: TransitionInput): Promise<string>;
  /** Writes the given slots (insert or update) and nulls the dates of the stored slots that are not listed. */
  saveDeadlines(evaluationId: string, deadlines: readonly StoredDeadline[]): Promise<void>;
}

const BASE_COLUMNS =
  'id, office_id, employee_id, evaluator_account_id, sheet_id, status, cycle_start, after_negative, previous_evaluation_id, snapshot, created_at, regulation_versions(code)' as const;
const DETAIL_COLUMNS =
  `${BASE_COLUMNS}, evaluation_sheets(version, state, content), evaluation_events(id, kind, occurred_on, payload, recorded_by, recorded_at), evaluation_deadlines(slot, window_start, due_on, suspended_since)` as const;

type EvaluationRow = Omit<
  Database['public']['Tables']['evaluations']['Row'],
  'created_by' | 'regulation_version_id'
> & { regulation_versions: { code: string } | null };

const optionalDate = (value: string | null): CalendarDate | null =>
  value === null ? null : calendarDate(value);

function toSnapshot(value: unknown): EvaluatedSnapshot {
  const raw = value as EvaluatedSnapshot;
  return { ...raw, gradeGrantedOn: optionalDate(raw.gradeGrantedOn) };
}

const toEvaluation = (row: EvaluationRow): Evaluation => ({
  id: row.id,
  officeId: row.office_id,
  employeeId: row.employee_id,
  evaluatorAccountId: row.evaluator_account_id,
  regulationId: row.regulation_versions?.code ?? '',
  sheetId: row.sheet_id,
  status: row.status,
  cycleStart: calendarDate(row.cycle_start),
  afterNegative: row.after_negative,
  previousEvaluationId: row.previous_evaluation_id,
  snapshot: toSnapshot(row.snapshot),
  createdAt: row.created_at,
});

/** Generated RPC types make nullable arguments non-null, SQL accepts null for them. */
const nullArg = (value: string | null): string => value as unknown as string;

function toRepositoryError(operation: string, error: { message: string; code?: string }) {
  if (error.code === 'P0001') {
    for (const code of ['stale_status', 'invalid_transition']) {
      if (error.message.includes(code)) return new RepositoryError(operation, { ...error, code });
    }
  }
  return new RepositoryError(operation, error);
}

type DetailRow = EvaluationRow & {
  evaluation_sheets: { version: number; state: string; content: unknown }[];
  evaluation_events: {
    id: string;
    kind: EventKind;
    occurred_on: string;
    payload: unknown;
    recorded_by: string;
    recorded_at: string;
  }[];
  evaluation_deadlines: {
    slot: string;
    window_start: string | null;
    due_on: string | null;
    suspended_since: string | null;
  }[];
};

function toDetail(row: DetailRow): EvaluationDetail {
  const sheet = [...row.evaluation_sheets]
    .filter((candidate) => candidate.state === 'draft' || candidate.state === 'locked')
    .sort((a, b) => b.version - a.version)[0];
  const current = sheet ?? [...row.evaluation_sheets].sort((a, b) => b.version - a.version)[0];
  if (current === undefined) {
    throw new RepositoryError('evaluations.get', { message: `Evaluation ${row.id} has no sheet` });
  }
  return {
    ...toEvaluation(row),
    sheet: {
      version: current.version,
      state: current.state as SheetState,
      content: sheetContentSchema.parse(current.content),
    },
    events: [...row.evaluation_events]
      .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
      .map((event) => ({
        id: event.id,
        kind: event.kind,
        occurredOn: calendarDate(event.occurred_on),
        payload: event.payload as Record<string, unknown>,
        recordedBy: event.recorded_by,
        recordedAt: event.recorded_at,
      })),
    deadlines: row.evaluation_deadlines.map((deadline) => ({
      slot: deadline.slot as DeadlineSlot,
      windowStart: optionalDate(deadline.window_start),
      dueOn: optionalDate(deadline.due_on),
      suspendedSince: optionalDate(deadline.suspended_since),
    })),
  };
}

export function createEvaluationRepository(db: Db): EvaluationRepository {
  async function fetchDetail(
    operation: string,
    apply: (query: ReturnType<typeof detailQuery>) => PromiseLike<{
      data: unknown;
      error: { message: string; code?: string } | null;
    }>,
  ): Promise<EvaluationDetail | null> {
    const { data, error } = await apply(detailQuery());
    if (error) throw toRepositoryError(operation, error);
    return data === null ? null : toDetail(data as DetailRow);
  }

  const detailQuery = () => db.from('evaluations').select(DETAIL_COLUMNS);

  return {
    async create(input) {
      const { data, error } = await db.rpc('start_evaluation', {
        p_employee_id: input.employeeId,
        p_evaluator_account_id: input.evaluatorAccountId,
        p_regulation_version_id: input.regulationVersionId,
        p_sheet_id: input.sheetId,
        p_cycle_start: input.cycleStart,
        p_after_negative: input.afterNegative,
        p_previous_evaluation_id: nullArg(input.previousEvaluationId),
        p_previous_acquainted_on: nullArg(input.previousAcquaintedOn),
        p_snapshot: toJson(input.snapshot),
        p_content: toJson(input.content),
      });
      if (error) throw toRepositoryError('evaluations.create', error);
      const { data: row, error: readError } = await db
        .from('evaluations')
        .select(BASE_COLUMNS)
        .eq('id', data)
        .single();
      if (readError) throw toRepositoryError('evaluations.create', readError);
      return toEvaluation(row);
    },

    get(id) {
      return fetchDetail('evaluations.get', (query) => query.eq('id', id).maybeSingle());
    },

    async listForOffice(filter = {}) {
      let query = db.from('evaluations').select(BASE_COLUMNS);
      if (filter.status !== undefined) query = query.eq('status', filter.status);
      if (filter.evaluatorAccountId !== undefined) {
        query = query.eq('evaluator_account_id', filter.evaluatorAccountId);
      }
      if (filter.employeeId !== undefined) query = query.eq('employee_id', filter.employeeId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw toRepositoryError('evaluations.listForOffice', error);
      return (data as unknown as EvaluationRow[]).map(toEvaluation);
    },

    latestForEmployee(employeeId) {
      return fetchDetail('evaluations.latestForEmployee', (query) =>
        query
          .eq('employee_id', employeeId)
          .order('cycle_start', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
    },

    async saveDraft(evaluationId, content) {
      const { data: current, error: readError } = await db
        .from('evaluation_sheets')
        .select('id')
        .eq('evaluation_id', evaluationId)
        .eq('state', 'draft')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (readError) throw toRepositoryError('evaluations.saveDraft', readError);
      if (current === null) {
        throw new RepositoryError('evaluations.saveDraft', { message: 'No draft sheet to save' });
      }
      const { error } = await db
        .from('evaluation_sheets')
        .update({ content: toJson(content) })
        .eq('id', current.id);
      if (error) throw toRepositoryError('evaluations.saveDraft', error);
    },

    async applyTransition(input) {
      const { data, error } = await db.rpc('apply_evaluation_transition', {
        p_evaluation_id: input.evaluationId,
        p_expected_status: input.expectedStatus,
        p_next_status: input.nextStatus,
        p_event_kind: input.eventKind,
        p_occurred_on: input.occurredOn,
        p_payload: toJson(input.payload),
        p_lock_sheet: input.lockSheet,
      });
      if (error) throw toRepositoryError('evaluations.applyTransition', error);
      return data;
    },

    async saveDeadlines(evaluationId, deadlines) {
      const { data: officeRow, error: officeError } = await db
        .from('evaluations')
        .select('office_id')
        .eq('id', evaluationId)
        .single();
      if (officeError) throw toRepositoryError('evaluations.saveDeadlines', officeError);
      const computedAt = new Date().toISOString();
      const { data: stored, error: storedError } = await db
        .from('evaluation_deadlines')
        .select('slot')
        .eq('evaluation_id', evaluationId);
      if (storedError) throw toRepositoryError('evaluations.saveDeadlines', storedError);
      const listed = new Set<string>(deadlines.map((deadline) => deadline.slot));
      const rows = [
        ...deadlines.map((deadline) => ({
          evaluation_id: evaluationId,
          office_id: officeRow.office_id,
          slot: deadline.slot,
          window_start: deadline.windowStart,
          due_on: deadline.dueOn,
          suspended_since: deadline.suspendedSince,
          computed_at: computedAt,
        })),
        ...stored
          .filter((row) => !listed.has(row.slot))
          .map((row) => ({
            evaluation_id: evaluationId,
            office_id: officeRow.office_id,
            slot: row.slot,
            window_start: null,
            due_on: null,
            suspended_since: null,
            computed_at: computedAt,
          })),
      ];
      // No upsert: its conflict update would write key columns, which accounts may not update.
      const storedSlots = new Set(stored.map((row) => row.slot));
      const inserts = rows.filter((row) => !storedSlots.has(row.slot));
      if (inserts.length > 0) {
        const { error } = await db.from('evaluation_deadlines').insert(inserts);
        if (error) throw toRepositoryError('evaluations.saveDeadlines', error);
      }
      for (const row of rows.filter((candidate) => storedSlots.has(candidate.slot))) {
        const { error } = await db
          .from('evaluation_deadlines')
          .update({
            window_start: row.window_start,
            due_on: row.due_on,
            suspended_since: row.suspended_since,
            computed_at: row.computed_at,
          })
          .eq('evaluation_id', evaluationId)
          .eq('slot', row.slot);
        if (error) throw toRepositoryError('evaluations.saveDeadlines', error);
      }
    },
  };
}
