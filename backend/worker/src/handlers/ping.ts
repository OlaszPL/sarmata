import { z } from 'zod';
import { defineJobHandler } from '../job-handler';

/** Liveness check: `select public.job_queue_send('{"type":"system.ping","payload":{"note":"hi"}}')`. */
export const pingHandler = defineJobHandler({
  type: 'system.ping',
  payload: z.object({ note: z.string().max(200) }),
  handle(payload, { logger }) {
    logger.info('pong', { note: payload.note });
    return Promise.resolve();
  },
});
