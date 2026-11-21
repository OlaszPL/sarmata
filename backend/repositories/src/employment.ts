import { type CalendarDate, calendarDate } from '@sarmata/domain';
import { type Db } from './db';
import { RepositoryError } from './errors';

export interface EndEmploymentRecord {
  readonly employeeId: string;
  readonly endedOn: CalendarDate;
  readonly reason: string;
  /** Last day of retention, computed by `retentionEndsOn` in @sarmata/domain. */
  readonly purgeDueOn: CalendarDate;
}

export interface RetentionOverviewRow {
  readonly employeeId: string;
  /** Last day of retention, anonymization is due the day after. */
  readonly purgeDueOn: CalendarDate;
  readonly archiveExportedAt: string | null;
}

/** Ending of employments and the retention register, for the signed-in account (hr only). */
export interface EmploymentRepository {
  /** One transaction: end date, retention row, end of access, interruption of the open evaluations. */
  end(input: EndEmploymentRecord): Promise<{ interruptedEvaluationIds: string[] }>;
  /** Records that the archive of the employee was downloaded. Fails with code `not_ended` before the end. */
  confirmArchiveExport(employeeId: string): Promise<void>;
  /** Former employees whose retention ends within the window (or has ended) and who are not anonymized. */
  retentionOverview(withinDays?: number): Promise<RetentionOverviewRow[]>;
}

const DEFAULT_WINDOW_DAYS = 90;

/** SQL raises these in P0001, the code of the error becomes the one the service maps. */
function toRepositoryError(operation: string, error: { message: string; code?: string }) {
  if (error.code === 'P0001') {
    for (const code of ['already_ended', 'not_ended']) {
      if (error.message.includes(code)) return new RepositoryError(operation, { ...error, code });
    }
  }
  return new RepositoryError(operation, error);
}

export function createEmploymentRepository(db: Db): EmploymentRepository {
  return {
    async end(input) {
      const { data, error } = await db.rpc('end_employment', {
        p_employee_id: input.employeeId,
        p_ended_on: input.endedOn,
        p_reason: input.reason,
        p_purge_due_on: input.purgeDueOn,
      });
      if (error) throw toRepositoryError('employment.end', error);
      return { interruptedEvaluationIds: data.map((row) => row.interrupted_evaluation_id) };
    },

    async confirmArchiveExport(employeeId) {
      const { error } = await db.rpc('confirm_archive_export', { p_employee_id: employeeId });
      if (error) throw toRepositoryError('employment.confirmArchiveExport', error);
    },

    async retentionOverview(withinDays = DEFAULT_WINDOW_DAYS) {
      const { data, error } = await db.rpc('retention_overview', { p_within_days: withinDays });
      if (error) throw toRepositoryError('employment.retentionOverview', error);
      return data.map((row) => ({
        employeeId: row.employee_id,
        purgeDueOn: calendarDate(row.purge_due_on),
        archiveExportedAt: row.archive_exported_at,
      }));
    },
  };
}
