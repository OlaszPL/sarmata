import 'server-only';
import { parseEnv } from '@sarmata/services';
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Server configuration, validated on first use and not at import, so `next build` needs no
 * Supabase address and one build serves any Supabase instance (ADR 0003).
 */
export function env(): Env {
  cached ??= parseEnv(envSchema, process.env, 'web', 'For the local Supabase run "pnpm web:env".');
  return cached;
}
