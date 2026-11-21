// Runs a command with SUPABASE_URL and the keys of the local "sarmata" instance.
// For development and integration tests only. A set SUPABASE_URL (e.g. an external instance) wins.
import { spawnSync } from 'node:child_process';
import { localSupabaseEnv } from './supabase-env.mjs';

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node scripts/with-supabase-env.mjs <command> [args...]');
  process.exit(2);
}

const env = process.env.SUPABASE_URL ? process.env : { ...process.env, ...localSupabaseEnv() };
const result = spawnSync(command, args, { env, stdio: 'inherit' });

if (result.error) throw result.error;
if (result.signal) process.kill(process.pid, result.signal);
process.exit(result.status ?? 1);
