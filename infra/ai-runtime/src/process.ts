import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export interface StartOptions {
  /** Keep the server running after this process exits (dev scripts). Default false. */
  detached?: boolean;
  /** How long to wait for the health check before giving up. */
  readyTimeoutMs?: number;
}

export interface ManagedProcess {
  pid: number;
  logFile: string;
  exited(): boolean;
  exitCode(): number | null;
  stop(): Promise<void>;
}

const STOP_GRACE_MS = 10_000;
const POLL_MS = 500;

/** Starts a long-running command with stdout and stderr appended to `logFile`. */
export async function spawnLogged(
  command: string,
  args: readonly string[],
  options: { logFile: string; detached: boolean; env?: Readonly<Record<string, string>> },
): Promise<ManagedProcess> {
  await mkdir(dirname(options.logFile), { recursive: true });
  const log = await open(options.logFile, 'a');
  const child = spawn(command, [...args], {
    stdio: ['ignore', log.fd, log.fd],
    detached: options.detached,
    env: { ...process.env, ...options.env },
    windowsHide: true,
  });
  let exited = false;
  let exitCode: number | null = null;
  const exit = new Promise<void>((resolve) => {
    child.once('exit', (code) => {
      exited = true;
      exitCode = code;
      resolve();
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
  } finally {
    await log.close();
  }
  if (options.detached) child.unref();
  const pid = child.pid;
  if (pid === undefined) throw new Error(`${command} started without a process id`);
  return {
    pid,
    logFile: options.logFile,
    exited: () => exited,
    exitCode: () => exitCode,
    async stop() {
      if (exited) return;
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), STOP_GRACE_MS);
      await exit;
      clearTimeout(force);
    },
  };
}

/** Polls `probe` until it says ready. Fails early when one of the processes exits. */
export async function waitUntilReady(
  name: string,
  probe: () => Promise<boolean>,
  processes: readonly ManagedProcess[],
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const dead = processes.find((managed) => managed.exited());
    if (dead) {
      throw new Error(
        `${name} exited with code ${dead.exitCode()} before it became ready, see ${dead.logFile}`,
      );
    }
    if (await probe()) return;
    await sleep(POLL_MS);
  }
  const logs = processes.map((managed) => managed.logFile).join(', ');
  throw new Error(
    `${name} did not become ready within ${Math.round(timeoutMs / 1000)} s, see ${logs}`,
  );
}
