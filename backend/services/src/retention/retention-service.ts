import { type CalendarDate, retainedFacts } from '@sarmata/domain';
import { type RetentionStore } from '@sarmata/repositories';

export interface RetentionReport {
  readonly notes: number;
  readonly aiRuns: number;
  readonly anonymized: number;
  readonly failed: number;
}

/** Thrown after the whole run when some employees failed, so the queue delivers the job again. */
export class RetentionRunError extends Error {
  readonly report: RetentionReport;

  constructor(report: RetentionReport) {
    super(`retention run failed for ${String(report.failed)} employees`);
    this.name = 'RetentionRunError';
    this.report = report;
  }
}

/** Data lifecycle for the system: expiring content and anonymizing former employees. */
export interface RetentionService {
  /**
   * Step one removes notes and AI content older than the period of each office, step two anonymizes the
   * employees whose retention ended. A failing employee is counted and skipped, the run goes on and
   * throws `RetentionRunError` at the end (the steps are idempotent, so a retry is safe). The archive
   * confirmation is not a condition: hr gets the deadlines in advance.
   */
  run(day: CalendarDate): Promise<RetentionReport>;
}

export interface RetentionServiceDependencies {
  readonly store: RetentionStore;
  /** Gets a line without personal data (an employee id is a pseudonym, never a name). */
  readonly log?: (message: string) => void;
}

export function createRetentionService(deps: RetentionServiceDependencies): RetentionService {
  const { store } = deps;
  return {
    async run(day) {
      const purged = await store.purgeExpiredContent(day);
      let anonymized = 0;
      let failed = 0;
      for (const due of await store.dueEmployees(day)) {
        try {
          const sources = await store.evaluationsOf(due.employeeId);
          const facts = sources.flatMap((source) => retainedFacts(source.regulation, source) ?? []);
          await store.anonymize(due.employeeId, day, facts);
          anonymized += 1;
        } catch (error) {
          failed += 1;
          deps.log?.(
            `anonymization of employee ${due.employeeId} failed: ${error instanceof Error ? error.name : 'unknown error'}`,
          );
        }
      }
      const report = { notes: purged.notes, aiRuns: purged.aiRuns, anonymized, failed };
      if (failed > 0) throw new RetentionRunError(report);
      return report;
    },
  };
}
