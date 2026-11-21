import { rm } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { localMachine } from '../src/index.ts';
import { parseOnly } from './dev-plan.ts';
import {
  describeError,
  devBielikOneStateFile,
  devDataDir,
  devStateFile,
  isAlive,
  readJsonOrNull,
  type DevBielikOneState,
} from './dev-env.ts';

async function stopPids(pids: readonly number[]): Promise<void> {
  for (const pid of pids) if (isAlive(pid)) process.kill(pid, 'SIGTERM');
  for (let attempt = 0; attempt < 50 && pids.some(isAlive); attempt += 1) await sleep(200);
  for (const pid of pids) if (isAlive(pid)) process.kill(pid, 'SIGKILL');
}

/** Stops what pnpm ai:start started: both by default, one with --only text|decision. */
async function main(): Promise<void> {
  const only = parseOnly(process.argv.slice(2));
  const dataDir = devDataDir(localMachine());
  if (only !== 'decision') {
    const file = devStateFile(dataDir);
    const state = await readJsonOrNull<{ pid: number; url: string }>(file);
    if (state) {
      await stopPids([state.pid]);
      await rm(file, { force: true });
      console.log(`Stopped llama-server (${state.url}).`);
    } else {
      console.log('No llama-server started by pnpm ai:start.');
    }
  }
  if (only !== 'text') {
    const file = devBielikOneStateFile(dataDir);
    const state = await readJsonOrNull<DevBielikOneState>(file);
    if (state) {
      await stopPids(state.pids);
      await rm(file, { force: true });
      console.log(`Stopped Bielik-One (${state.url}).`);
    } else if (only === 'decision') {
      console.log('No Bielik-One started by pnpm ai:start.');
    }
  }
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exitCode = 1;
});
