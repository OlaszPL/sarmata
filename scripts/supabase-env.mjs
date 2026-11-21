// Address and keys of the shared local Supabase instance "sarmata", read from `supabase status`.
// One parser for web-env.mjs and with-supabase-env.mjs. For development and integration tests only.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** @returns {{ SUPABASE_URL: string, SUPABASE_PUBLISHABLE_KEY: string, SUPABASE_SECRET_KEY: string }} */
export function localSupabaseEnv() {
  const status = JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      cwd: `${root}/database`,
      encoding: 'utf8',
    }),
  );
  const url = status.API_URL;
  const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  const secretKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !secretKey) {
    throw new Error(
      'supabase status returned no API_URL or keys. Is the stack running (pnpm db:start)?',
    );
  }
  return {
    SUPABASE_URL: url,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
  };
}
