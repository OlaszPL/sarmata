import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuntimeContext } from './context.ts';
import { readTextOrNull } from './download.ts';
import { BIELIK_ONE_SOURCE, type BielikOneEngine, type BielikOnePackage } from './models.ts';
import { spawnLogged, waitUntilReady, type StartOptions } from './process.ts';

export interface BielikOneInstall {
  engine: BielikOneEngine;
  executable: string;
}

export interface BielikOneServer {
  /** Frontend base URL: `/v1/systemone` for decisions, `/health` for readiness. */
  url: string;
  stop(): Promise<void>;
}

const INSTALL_TIMEOUT_MS = 60 * 60 * 1000;
const READY_TIMEOUT_MS = 60 * 60 * 1000;

const SMOKE_DECISION = {
  model: 'decision',
  state: 'Wniosek o ocenę okresową złożono 3 marca 2026 r.',
  questions: {
    filed: {
      type: 'noul',
      instructions: 'Czy wniosek został złożony?',
      criteria: { true: 'Tak', false: 'Nie' },
    },
  },
};

/**
 * Installs bielik-one into its own Python 3.12 environment with uv (ADR 0003): vLLM on Linux with
 * NVIDIA, MLX on Apple silicon. A finished install of the pinned commit is reused.
 */
export async function installBielikOne(
  engine: BielikOneEngine,
  ctx: RuntimeContext,
): Promise<BielikOneInstall> {
  const { machine } = ctx;
  const supported =
    engine === 'vllm' ? machine.os === 'linux' : machine.os === 'macos' && machine.arch === 'arm64';
  if (!supported) {
    throw new Error(`Bielik-One with ${engine} does not run on ${machine.os} ${machine.arch}`);
  }

  const venv = join(ctx.dataDir, 'bielik-one', engine);
  const install: BielikOneInstall = { engine, executable: join(venv, 'bin', 'bielik-one') };
  const marker = join(venv, '.sarmata-install');
  if ((await readTextOrNull(marker)) === BIELIK_ONE_SOURCE.commit) return install;

  const uv = await machine.run('uv', ['--version'], { timeoutMs: 15_000 });
  if (uv.exitCode !== 0) {
    throw new Error('Installing Bielik-One needs uv on PATH (https://docs.astral.sh/uv/)');
  }
  const python = join(venv, 'bin', 'python');
  const archive = `${BIELIK_ONE_SOURCE.repo}/archive/${BIELIK_ONE_SOURCE.commit}.tar.gz`;
  const steps: string[][] = [
    ['venv', '--python', BIELIK_ONE_SOURCE.python, '--clear', venv],
    ['pip', 'install', '--python', python, `bielik-one[${engine}] @ ${archive}`],
  ];
  if (engine === 'vllm') {
    steps.push([
      'pip',
      'install',
      '--python',
      python,
      '--no-deps',
      `systemone-vllm-heads @ ${archive}#subdirectory=vllm-heads-plugin`,
    ]);
  }
  for (const args of steps) {
    ctx.onProgress?.({ kind: 'step', message: `Instalacja Bielik-One: uv ${args[0] ?? ''}` });
    const result = await machine.run('uv', args, { timeoutMs: INSTALL_TIMEOUT_MS });
    if (result.exitCode !== 0) {
      throw new Error(`uv ${args.join(' ')} failed: ${result.stderr.trim()}`);
    }
  }
  await mkdir(venv, { recursive: true });
  await writeFile(marker, BIELIK_ONE_SOURCE.commit);
  return install;
}

/**
 * Starts `bielik-one backend` and `bielik-one frontend` for an adapter package and waits until
 * the frontend answers calibrated decisions. The first start downloads the package and its base
 * model into `<dataDir>/huggingface`.
 */
export async function startBielikOne(
  install: BielikOneInstall,
  pkg: BielikOnePackage,
  ctx: RuntimeContext,
  options: StartOptions = {},
): Promise<BielikOneServer> {
  const logs = join(ctx.dataDir, 'logs');
  const env = { HF_HOME: join(ctx.dataDir, 'huggingface') };
  const detached = options.detached ?? false;
  const packageArgs = [pkg.repo, '--revision', pkg.revision];
  const engineArgs = install.engine === 'mlx' ? ['--engine', 'mlx'] : [];
  const backend = await spawnLogged(
    install.executable,
    ['backend', ...packageArgs, ...engineArgs],
    { logFile: join(logs, 'bielik-one-backend.log'), env, detached },
  );
  const frontend = await spawnLogged(install.executable, ['frontend', ...packageArgs], {
    logFile: join(logs, 'bielik-one-frontend.log'),
    env,
    detached,
  });
  const url = `http://127.0.0.1:${pkg.port}`;
  const stop = async (): Promise<void> => {
    await frontend.stop();
    await backend.stop();
  };
  try {
    await waitUntilReady(
      'Bielik-One',
      () => isBielikOneReady(url),
      [backend, frontend],
      options.readyTimeoutMs ?? READY_TIMEOUT_MS,
    );
  } catch (error) {
    await stop();
    throw error;
  }
  return { url, stop };
}

/** True when the frontend is calibrated and answers a one-question decision. */
export async function isBielikOneReady(url: string): Promise<boolean> {
  try {
    const health = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    if (!health.ok) return false;
    const body = (await health.json()) as { status?: unknown; calibrated?: unknown };
    if (body.status !== 'ok' || body.calibrated !== true) return false;
    const decision = await fetch(`${url}/v1/systemone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(SMOKE_DECISION),
      signal: AbortSignal.timeout(30_000),
    });
    return decision.ok;
  } catch {
    return false;
  }
}
