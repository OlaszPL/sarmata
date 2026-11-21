import { type InvitationProcessing } from '@sarmata/services/system';
import { z } from 'zod';
import { defineJobHandler } from '../job-handler';

/**
 * Carries out one account invitation requested by an admin (`public.account_invitations`, queued by its
 * insert trigger, which holds the same type literal). The result lands in the row, the frontend polls it.
 * A failed invitation is a result, not an error: no retry, the admin asks again. A database error while
 * writing the result is thrown, so the queue delivers the job again. The log has no e-mail address.
 */
export const inviteAccountHandler = (invitations: InvitationProcessing) =>
  defineJobHandler({
    type: 'accounts.invite',
    payload: z.object({ invitationId: z.uuid() }),
    async handle({ invitationId }, { logger }) {
      const result = await invitations.process(invitationId);
      if (result.status === 'sent') {
        logger.info('account invitation sent', { invitationId, mode: result.mode });
      } else if (result.status === 'failed') {
        logger.error('account invitation failed', {
          invitationId,
          errorCode: result.errorCode,
          error: result.cause instanceof Error ? result.cause.message : String(result.cause),
        });
      } else {
        logger.info('account invitation skipped', { invitationId });
      }
    },
  });
