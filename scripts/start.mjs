// `pnpm start`: the whole app from the production build in one command, without the installer.
// Starts the local Supabase "sarmata" if it is down, loads the demo data into an empty database,
// writes frontend/web/.env.local, builds when there is no build yet, starts the local AI when
// `pnpm ai:setup` was run, then runs the Next.js standalone server and the worker until Ctrl+C.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localSupabaseEnv } from './supabase-env.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = `${root}frontend/web/.next/standalone/frontend/web/server.js`;
const port = process.env.PORT ?? '3000';

function run(command, args) {
  console.log(`\n> ${[command, ...args].join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

/** KEY=value lines of an env file, comments and empty lines skipped. */
function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

function supabase() {
  try {
    return localSupabaseEnv();
  } catch {
    run('pnpm', ['db:start']);
    return localSupabaseEnv();
  }
}

/** True when the database has no office yet, so the demo data was never loaded. */
async function databaseIsEmpty({ SUPABASE_URL, SUPABASE_SECRET_KEY }) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/offices?select=id&limit=1`, {
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
  });
  if (!response.ok) return true;
  return (await response.json()).length === 0;
}

async function aiIsRunning(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Starts a long-running process with every output line prefixed by its name. */
function start(name, command, args, env) {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env } });
  for (const stream of [child.stdout, child.stderr]) {
    let rest = '';
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop();
      for (const line of lines) console.log(`[${name}] ${line}`);
    });
  }
  return child;
}

const db = supabase();
if (process.env.SARMATA_SKIP_SEED !== '1' && (await databaseIsEmpty(db))) {
  run('pnpm', ['db:reset']);
}
run('pnpm', ['web:env']);
if (!existsSync(server)) run('pnpm', ['build']);
else run('node', ['scripts/standalone-assets.mjs']);

const ai = readEnvFile(`${root}.env.ai.local`);
let stopAi = false;
if (ai.SARMATA_AI_TEXT_BASE_URL && !(await aiIsRunning(ai.SARMATA_AI_TEXT_BASE_URL))) {
  try {
    run('pnpm', ['ai:start']);
    stopAi = true;
  } catch {
    console.warn('Local AI did not start, the app runs without AI suggestions.');
  }
}

const webEnv = {
  ...readEnvFile(`${root}frontend/web/.env.local`),
  NODE_ENV: 'production',
  PORT: port,
  HOSTNAME: '0.0.0.0',
};
const children = [
  start('web', 'node', [server], webEnv),
  start('worker', 'pnpm', ['--filter', '@sarmata/worker', 'start'], { ...ai, ...db }),
];
console.log(`\nSarmata: http://localhost:${port} (Ctrl+C stops the app and the worker)\n`);

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  if (stopAi) spawnSync('pnpm', ['ai:stop'], { cwd: root, stdio: 'inherit' });
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
for (const child of children) child.on('exit', (code) => stop(code ?? 1));
