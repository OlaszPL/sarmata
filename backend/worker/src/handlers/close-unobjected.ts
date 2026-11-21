import { calendarDateSchema } from '@sarmata/domain';
import { type EvaluationClosing } from '@sarmata/services/system';
import { z } from 'zod';
import { defineJobHandler } from '../job-handler';

/**
 * Closes delivered evaluations whose objection window is over. Queued daily by pg_cron
 * (migration 20261122160500_close_unobjected_schedule.sql, which holds the same type literal).
 * A failure is rethrown, so the queue delivers the job again.
 */
export const closeUnobjectedHandler = (closing: EvaluationClosing) =>
  defineJobHandler({
    type: 'evaluations.close_unobjected',
    payload: z.object({ day: calendarDateSchema }),
    async handle(payload, { logger }) {
      const { closed } = await closing.closeUnobjected(payload.day);
      logger.info(`closed ${String(closed)} evaluations after the objection window`);
    },
  });
