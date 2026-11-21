import {
  type CalendarDate,
  type HistoryEntry,
  type RegulationDocument,
  type RetainedEvaluationFacts,
  type RetainedFactsInput,
  calendarDate,
  parseRegulationDocument,
  sheetContentSchema,
} from '@sarmata/domain';
import { type ServiceDb } from './db';
import { RepositoryError } from './errors';
import { HISTORY_COLUMNS, type HistoryRow, toHistoryEntry } from './evaluations';
import { toJson } from './json';

/** What `retainedFacts` needs about one evaluation of an employee who is about to be anonymized. */
export type RetentionEvaluationSource = RetainedFactsInput & {
  readonly regulation: RegulationDocument;
};

export interface DueEmployee {
  readonly employeeId: string;
  readonly officeId: string;
}

export interface PurgedContent {
  readonly notes: number;
  readonly aiRuns: number;
  readonly decisions: number;
}

/** System side of the data lifecycle (worker, scripts): one call per step, as the service role. */
export interface RetentionStore {
  /** Removes notes and AI content older than the period of each office. Idempotent. */
  purgeExpiredContent(day: CalendarDate): Promise<PurgedContent>;
  /** Employees whose retention ended before `day` and who are not anonymized yet. */
  dueEmployees(day: CalendarDate): Promise<DueEmployee[]>;
  /** Every evaluation of the employee with what the statistics facts are computed from. */
  evaluationsOf(employeeId: string): Promise<RetentionEvaluationSource[]>;
  /** Anonymizes the employee in one transaction, keeping the given facts. Fails with `not_due` or `facts_mismatch`. */
  anonymize(
    employeeId: string,
    day: CalendarDate,
    facts: readonly RetainedEvaluationFacts[],
  ): Promise<void>;
}

const SOURCE_COLUMNS = `id, status, sheet_id, snapshot, evaluator_account_id, regulation_versions(document), evaluation_sheets(version, state, content), evaluation_events(kind, occurred_on, recorded_at, payload)`;

interface SourceRow {
  id: string;
  status: RetainedFactsInput['status'];
  sheet_id: string;
  snapshot: { orgUnit?: string | null; serviceStatus?: string; gradeGrantedOn?: string | null };
  evaluator_account_id: string;
  regulation_versions: { document: unknown } | null;
  evaluation_sheets: { version: number; state: string; content: unknown }[];
  evaluation_events: {
    kind: string;
    occurred_on: string;
    recorded_at: string;
    payload: { outcome?: string } | null;
  }[];
}

const optionalDate = (value: string | null | undefined): CalendarDate | null =>
  value === null || value === undefined ? null : calendarDate(value);

const objectionOf = (events: SourceRow['evaluation_events']): RetainedFactsInput['objection'] => {
  const byTime = (a: { occurred_on: string; recorded_at: string }, b: typeof a) =>
    `${a.occurred_on} ${a.recorded_at}`.localeCompare(`${b.occurred_on} ${b.recorded_at}`);
  const filed = events
    .filter((event) => event.kind === 'objection_filed')
    .sort(byTime)
    .at(-1);
  if (filed === undefined) return 'none';
  const outcome = events
    .filter((event) => event.kind === 'objection_outcome' && byTime(event, filed) > 0)
    .sort(byTime)[0]?.payload?.outcome;
  return outcome === 'rejected' || outcome === 'changed' || outcome === 'redraft'
    ? outcome
    : 'pending';
};

const lastOn = (events: SourceRow['evaluation_events'], kinds: readonly string[]) =>
  events
    .filter((event) => kinds.includes(event.kind))
    .map((event) => event.occurred_on)
    .sort()
    .at(-1);

export function createRetentionStore(db: ServiceDb): RetentionStore {
  async function historyOf(employeeId: string): Promise<HistoryEntry[]> {
    const closed = await db
      .from('evaluations')
      .select(HISTORY_COLUMNS)
      .eq('employee_id', employeeId)
      .eq('status', 'closed');
    if (closed.error) throw new RepositoryError('retention.history', closed.error);
    const archived = await db
      .from('archived_evaluations')
      .select('drafted_on, acquainted_on, level_code, outcome')
      .eq('employee_id', employeeId);
    if (archived.error) throw new RepositoryError('retention.history', archived.error);
    return [
      ...(closed.data as unknown as HistoryRow[])
        .map(toHistoryEntry)
        .filter((entry): entry is HistoryEntry => entry !== null),
      ...archived.data.map((entry): HistoryEntry => ({
        drafted: calendarDate(entry.drafted_on),
        levelCode: entry.level_code,
        outcome:
          entry.outcome === 'positive' || entry.outcome === 'negative' ? entry.outcome : null,
        acquaintedOn: optionalDate(entry.acquainted_on),
      })),
    ].sort((a, b) => a.drafted.localeCompare(b.drafted));
  }

  return {
    async purgeExpiredContent(day) {
      const { data, error } = await db.rpc('purge_expired_content', { p_today: day });
      if (error) throw new RepositoryError('retention.purgeExpiredContent', error);
      const row = data[0];
      if (row === undefined) {
        throw new RepositoryError('retention.purgeExpiredContent', { message: 'No report' });
      }
      return { notes: row.notes, aiRuns: row.ai_runs, decisions: row.decisions };
    },

    async dueEmployees(day) {
      const { data, error } = await db
        .from('employee_retention')
        .select('employee_id, office_id, employees!inner(anonymized_at)')
        .lt('retained_until', day)
        .is('employees.anonymized_at', null)
        .order('retained_until')
        .order('employee_id');
      if (error) throw new RepositoryError('retention.dueEmployees', error);
      return data.map((row) => ({ employeeId: row.employee_id, officeId: row.office_id }));
    },

    async evaluationsOf(employeeId) {
      const { data, error } = await db
        .from('evaluations')
        .select(SOURCE_COLUMNS)
        .eq('employee_id', employeeId);
      if (error) throw new RepositoryError('retention.evaluationsOf', error);
      const rows = data as unknown as SourceRow[];
      if (rows.length === 0) return [];
      const history = await historyOf(employeeId);
      return rows.flatMap((row): RetentionEvaluationSource[] => {
        if (row.regulation_versions === null) return [];
        const current = row.evaluation_sheets
          .filter((sheet) => sheet.state === 'draft' || sheet.state === 'locked')
          .sort((a, b) => b.version - a.version)[0];
        return [
          {
            evaluationId: row.id,
            status: row.status,
            sheetId: row.sheet_id,
            lockedContent:
              current?.state === 'locked' ? sheetContentSchema.parse(current.content) : null,
            orgUnit: row.snapshot.orgUnit ?? null,
            serviceStatus:
              row.snapshot.serviceStatus === 'civil_servant' ? 'civil_servant' : 'employee',
            gradeGrantedOn: optionalDate(row.snapshot.gradeGrantedOn),
            drafted: optionalDate(lastOn(row.evaluation_events, ['sheet_approved'])),
            acquaintedOn: optionalDate(
              lastOn(row.evaluation_events, ['acquainted', 'signature_refused']),
            ),
            history,
            objection: objectionOf(row.evaluation_events),
            labourCourtAppealOn: optionalDate(
              lastOn(row.evaluation_events, ['labour_court_appeal']),
            ),
            evaluatorAccountId: row.evaluator_account_id,
            regulation: parseRegulationDocument(row.regulation_versions.document),
          },
        ];
      });
    },

    async anonymize(employeeId, day, facts) {
      const { error } = await db.rpc('anonymize_employee', {
        p_employee_id: employeeId,
        p_today: day,
        p_facts: toJson(facts),
      });
      if (error) throw new RepositoryError('retention.anonymize', error);
    },
  };
}
