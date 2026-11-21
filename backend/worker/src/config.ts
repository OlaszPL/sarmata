import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SARMATA_WORKER_IDLE_DELAY_MS: z.coerce.number().int().positive().default(1_000),
});

export interface WorkerConfig {
  readonly supabaseUrl: string;
  readonly secretKey: string;
  readonly idleDelayMs: number;
}

export function workerConfigFromEnv(env: Record<string, string | undefined>): WorkerConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid worker configuration:\n${z.prettifyError(result.error)}`);
  }
  return {
    supabaseUrl: result.data.SUPABASE_URL,
    secretKey: result.data.SUPABASE_SECRET_KEY,
    idleDelayMs: result.data.SARMATA_WORKER_IDLE_DELAY_MS,
  };
}
