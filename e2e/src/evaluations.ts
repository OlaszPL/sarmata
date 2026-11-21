import { readFileSync } from 'node:fs';
import { DEMO_PASSWORD } from './demo-accounts';

interface SupabaseSettings {
  readonly url: string;
  readonly key: string;
}

/** Address and publishable key of the local Supabase, from the shell or from `frontend/web/.env.local`. */
function supabaseSettings(): SupabaseSettings {
  const fromEnv = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY };
  if (fromEnv.url && fromEnv.key) return { url: fromEnv.url, key: fromEnv.key };
  const file = readFileSync(new URL('../../frontend/web/.env.local', import.meta.url), 'utf8');
  const value = (name: string): string => {
    const line = file.split('\n').find((candidate) => candidate.startsWith(`${name}=`));
    if (line === undefined) throw new Error(`${name} is missing, run "pnpm web:env"`);
    return line.slice(name.length + 1).trim();
  };
  return { url: value('SUPABASE_URL'), key: value('SUPABASE_PUBLISHABLE_KEY') };
}

export interface DemoEvaluation {
  readonly id: string;
  readonly status: string;
}

/** The evaluations the account sees, read through the REST API with its own JWT (RLS applies). */
export async function evaluationsOf(email: string): Promise<DemoEvaluation[]> {
  const { url, key } = supabaseSettings();
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  const { access_token: token } = (await login.json()) as { access_token?: string };
  if (!login.ok || token === undefined) throw new Error(`Cannot sign in as ${email}`);
  const response = await fetch(`${url}/rest/v1/evaluations?select=id,status&order=created_at`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  return (await response.json()) as DemoEvaluation[];
}
