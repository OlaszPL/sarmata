import {
  type EvaluationClosing,
  type InvitationProcessing,
  type NotificationDelivery,
  type RetentionService,
} from '@sarmata/services/system';
import { closeUnobjectedHandler } from './close-unobjected';
import { aiRunHandler } from './ai-run';
import { inviteAccountHandler } from './invite-account';
import { pingHandler } from './ping';
import { retentionRunHandler } from './retention-run';
import { sendDigestHandler } from './send-digest';

export interface JobHandlerDependencies {
  readonly delivery: NotificationDelivery;
  readonly closing: EvaluationClosing;
  readonly retention: RetentionService;
  readonly invitations: InvitationProcessing;
}

/** Registry of job handlers. A new job type is a new handler added here. */
export const jobHandlersFor = (deps: JobHandlerDependencies) =>
  [
    pingHandler,
    sendDigestHandler(deps.delivery),
    closeUnobjectedHandler(deps.closing),
    aiRunHandler,
    retentionRunHandler(deps.retention),
    inviteAccountHandler(deps.invitations),
  ] as const;

/** Every job type with a handler. Senders of jobs type their messages with it. */
export type JobType = ReturnType<typeof jobHandlersFor>[number]['type'];
