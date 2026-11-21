import { createRepositories, createServiceClient } from '@sarmata/repositories';
import { createServices } from '@sarmata/services';
import { workerConfigFromEnv } from './config';
import { jsonLogger } from './logger';

// Loads official regulation versions into the database (pnpm regulations:sync, installer).
const config = workerConfigFromEnv(process.env);
const client = createServiceClient({ url: config.supabaseUrl, secretKey: config.secretKey });
const report = await createServices({
  repositories: createRepositories(client),
}).regulations.syncOfficial();
jsonLogger.info('official regulation versions synced', { ...report });
