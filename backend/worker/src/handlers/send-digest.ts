import { DIGEST_JOB_TYPE, calendarDateSchema } from '@sarmata/domain';
import { type NotificationDelivery } from '@sarmata/services/system';
import { z } from 'zod';
import { defineJobHandler } from '../job-handler';

/** Sends the digest e-mail of one account and day. Queued by `public.collect_notifications`. */
export const sendDigestHandler = (delivery: NotificationDelivery) =>
  defineJobHandler({
    type: DIGEST_JOB_TYPE,
    payload: z.object({ accountId: z.uuid(), day: calendarDateSchema }),
    async handle(payload, { logger }) {
      const outcome = await delivery.sendDigest(payload.accountId, payload.day);
      logger.info(
        'digest processed',
        outcome.status === 'sent'
          ? { status: outcome.status }
          : { status: outcome.status, reason: outcome.reason },
      );
    },
  });
