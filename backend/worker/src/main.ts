import { createJobQueue, createRepositories, createServiceClient } from '@sarmata/repositories';
import { createServices } from '@sarmata/services';
import { workerConfigFromEnv } from './config';
import { jobHandlers } from './handlers/index';
import { jsonLogger } from './logger';
import { runWorker } from './run-worker';

const config = workerConfigFromEnv(process.env);
const client = createServiceClient({ url: config.supabaseUrl, secretKey: config.secretKey });

// Every release restarts the worker, so the official versions known to this code reach the database
// before any job runs. A drift stops the process (ADR 0006).
const report = await createServices({
  repositories: createRepositories(client),
}).regulations.syncOfficial();
jsonLogger.info('official regulation versions synced', { ...report });

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
