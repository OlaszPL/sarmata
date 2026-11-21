import { type EvaluationClosing, type NotificationDelivery } from '@sarmata/services/system';
import { closeUnobjectedHandler } from './close-unobjected';
import { aiRunHandler } from './ai-run';
import { pingHandler } from './ping';
import { sendDigestHandler } from './send-digest';

export interface JobHandlerDependencies {
  readonly delivery: NotificationDelivery;
  readonly closing: EvaluationClosing;
}

/** Registry of job handlers. A new job type is a new handler added here. */
export const jobHandlersFor = (deps: JobHandlerDependencies) =>
  [
    pingHandler,
    sendDigestHandler(deps.delivery),
    closeUnobjectedHandler(deps.closing),
    aiRunHandler,
  ] as const;

/** Every job type with a handler. Senders of jobs type their messages with it. */
export type JobType = ReturnType<typeof jobHandlersFor>[number]['type'];
