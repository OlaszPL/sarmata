import 'server-only';
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /**
   * Public address of the app, for links in auth e-mails (invites, password reset).
   * TODO: nothing reads it yet, the first user is the invite and password reset plan.
   */
  SITE_URL: z.url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Server configuration, validated on first use and not at import, so `next build` needs no
 * Supabase address and one build serves any Supabase instance (ADR 0003).
 */
export function env(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid environment for @sarmata/web:\n${z.prettifyError(result.error)}\n` +
        'For the local Supabase run "pnpm web:env".',
    );
  }
  cached = result.data;
  return cached;
}
