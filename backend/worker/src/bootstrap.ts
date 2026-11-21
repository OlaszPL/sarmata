import { type ServiceDb, createServiceClient } from '@sarmata/repositories';
import { createSystemServices } from '@sarmata/services/system';
import { type WorkerConfig, workerConfigFromEnv } from './config';
import { jsonLogger } from './logger';

/**
 * Shared start of the worker and of `pnpm regulations:sync`: reads the configuration, connects with
 * the service key and loads the official regulation versions into the database. A drift between
 * the code and the database stops the process (ADR 0006).
 */
export async function connectAndSyncRegulations(
  env: Record<string, string | undefined>,
): Promise<{ config: WorkerConfig; client: ServiceDb }> {
  const config = workerConfigFromEnv(env);
  const client = createServiceClient({ url: config.supabaseUrl, secretKey: config.secretKey });
  const report = await createSystemServices(client).regulations.syncOfficial();
  jsonLogger.info('official regulation versions synced', { ...report });
  return { config, client };
}
