import { readFile, rm } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { localMachine } from '../src/index.ts';
import { devDataDir, devStateFile } from './dev-env.ts';

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function main(): Promise<void> {
  const stateFile = devStateFile(devDataDir(localMachine()));
  let state: { pid: number; url: string };
  try {
    state = JSON.parse(await readFile(stateFile, 'utf8')) as { pid: number; url: string };
  } catch {
    console.log('No llama-server started by pnpm ai:start.');
    return;
  }
  if (isAlive(state.pid)) {
    process.kill(state.pid, 'SIGTERM');
    for (let attempt = 0; attempt < 50 && isAlive(state.pid); attempt += 1) await sleep(200);
    if (isAlive(state.pid)) process.kill(state.pid, 'SIGKILL');
  }
  await rm(stateFile, { force: true });
  console.log(`Stopped llama-server (${state.url}).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
