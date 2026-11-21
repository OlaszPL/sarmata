import { createJobQueue } from '@sarmata/repositories';
import { connectAndSyncRegulations } from './bootstrap';
import { type JobType, jobHandlers } from './handlers/index';
import { jsonLogger } from './logger';
import { runWorker } from './run-worker';

// Every release restarts the worker, so the official versions known to this code reach the database
// before any job runs.
const { config, client } = await connectAndSyncRegulations(process.env);

const controller = new AbortController();
for (const name of ['SIGTERM', 'SIGINT'] as const) {
  process.once(name, () => {
    jsonLogger.info('shutdown requested', { signal: name });
    controller.abort();
  });
}

await runWorker(
  {
    queue: createJobQueue<JobType>(client),
    handlers: jobHandlers,
    logger: jsonLogger,
    idleDelayMs: config.idleDelayMs,
  },
  controller.signal,
);
