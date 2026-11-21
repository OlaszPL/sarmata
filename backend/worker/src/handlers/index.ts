import { type JobHandler } from '../job-handler';
import { pingHandler } from './ping';

/** Registry of job handlers. A new job type is a new handler added here. */
export const jobHandlers: readonly JobHandler[] = [pingHandler];
