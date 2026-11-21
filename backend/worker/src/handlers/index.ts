import { type NotificationDelivery } from '@sarmata/services/system';
import { pingHandler } from './ping';
import { sendDigestHandler } from './send-digest';

export interface JobHandlerDependencies {
  readonly delivery: NotificationDelivery;
}

/** Registry of job handlers. A new job type is a new handler added here. */
export const jobHandlersFor = (deps: JobHandlerDependencies) =>
  [pingHandler, sendDigestHandler(deps.delivery)] as const;

/** Every job type with a handler. Senders of jobs type their messages with it. */
export type JobType = ReturnType<typeof jobHandlersFor>[number]['type'];
