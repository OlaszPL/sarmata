import { RETENTION_JOB_TYPE, calendarDateSchema } from '@sarmata/domain';
import { type RetentionService } from '@sarmata/services/system';
import { z } from 'zod';
import { defineJobHandler } from '../job-handler';

/**
 * Purges expired notes and AI content and anonymizes former employees whose retention ended. Queued daily
 * by pg_cron (migration 20261122220500_retention_schedule.sql, which holds the same type literal).
 * A failure is rethrown, so the queue delivers the job again: the steps are idempotent.
 */
export const retentionRunHandler = (retention: RetentionService) =>
  defineJobHandler({
    type: RETENTION_JOB_TYPE,
    payload: z.object({ day: calendarDateSchema }),
    async handle(payload, { logger }) {
      const report = await retention.run(payload.day);
      logger.info(
        `retention: purged ${String(report.notes)} notes and the content of ${String(report.aiRuns)} AI runs, anonymized ${String(report.anonymized)} employees`,
      );
    },
  });
