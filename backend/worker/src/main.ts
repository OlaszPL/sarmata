import { createJobQueue, createNotificationDeliveryStore } from '@sarmata/repositories';
import { createNotificationDelivery } from '@sarmata/services/system';
import { connectAndSyncRegulations } from './bootstrap';
import { type JobType, jobHandlersFor } from './handlers/index';
import { jsonLogger } from './logger';
import { createSmtpMailer } from './notifications/smtp-mailer';
import { runWorker } from './run-worker';

// Every release restarts the worker, so the official versions known to this code reach the database
// before any job runs.
const { config, client } = await connectAndSyncRegulations(process.env);

const delivery = createNotificationDelivery({
  store: createNotificationDeliveryStore(client),
  mailer: createSmtpMailer(),
  siteUrl: config.siteUrl,
  defaultSmtp:
    config.smtp === null
      ? null
      : {
          host: config.smtp.host,
          port: config.smtp.port,
          user: config.smtp.user,
          password: config.smtp.password,
          from: config.smtp.senderEmail,
          fromName: config.smtp.senderName,
        },
});

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
    handlers: jobHandlersFor({ delivery }),
    logger: jsonLogger,
    idleDelayMs: config.idleDelayMs,
  },
  controller.signal,
);
