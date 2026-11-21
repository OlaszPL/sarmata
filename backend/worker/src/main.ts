import { createJobQueue } from '@sarmata/repositories';
import { syncOfficialFromEnv } from './bootstrap';
import { jobHandlers } from './handlers/index';
import { jsonLogger } from './logger';
import { runWorker } from './run-worker';

// Every release restarts the worker, so the official versions known to this code reach the database
// before any job runs.
const { config, client } = await syncOfficialFromEnv(process.env);

const controller = new AbortController();
for (const name of ['SIGTERM', 'SIGINT'] as const) {
  process.once(name, () => {
    jsonLogger.info('shutdown requested', { signal: name });
    controller.abort();
  });
}

await runWorker(
  {
    queue: createJobQueue(client),
    handlers: jobHandlers,
    logger: jsonLogger,
    idleDelayMs: config.idleDelayMs,
  },
  controller.signal,
);
