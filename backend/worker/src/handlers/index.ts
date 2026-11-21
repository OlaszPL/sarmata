import { pingHandler } from './ping';

/** Registry of job handlers. A new job type is a new handler added here. */
export const jobHandlers = [pingHandler] as const;

/** Every job type with a handler. Senders of jobs type their messages with it. */
export type JobType = (typeof jobHandlers)[number]['type'];
