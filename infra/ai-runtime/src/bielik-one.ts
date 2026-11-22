import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
  /** Process ids of the backend and the frontend, for a later stop from another process. */
  pids: number[];
  stop(): Promise<void>;
}

export interface InstallBielikOneOptions {
  /** The uv executable. Default: uv on PATH. The installer passes the copy it installed. */
  uv?: string;
}

const INSTALL_TIMEOUT_MS = 60 * 60 * 1000;
const READY_TIMEOUT_MS = 60 * 60 * 1000;

/** One yes/no question: the readiness check and `pnpm ai:smoke` send it. */
export const SMOKE_DECISION = {
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
  options: InstallBielikOneOptions = {},
): Promise<BielikOneInstall> {
  const uvCommand = options.uv ?? 'uv';
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

  const uv = await machine.run(uvCommand, ['--version'], { timeoutMs: 15_000 });
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
    const result = await machine.run(uvCommand, args, { timeoutMs: INSTALL_TIMEOUT_MS });
    if (result.exitCode !== 0) {
      throw new Error(`uv ${args.join(' ')} failed: ${result.stderr.trim()}`);
    }
  }
  await mkdir(venv, { recursive: true });
  await writeFile(marker, BIELIK_ONE_SOURCE.commit);
  return install;
}

// Downloads the package and the base model files the backend loads, as the backend itself would
// (bielik_one.mlx_backend.resolve_base), so the first start does not download tens of GB unseen.
// huggingface_hub keeps finished files by etag and resumes .incomplete ones.
const PREFETCH_SCRIPT = `
import sys
from pathlib import Path
from huggingface_hub import snapshot_download
from bielik_one import launch, mlx_backend
repo, revision = sys.argv[1], sys.argv[2]
root = Path(snapshot_download(repo, revision=revision))
info = mlx_backend.adapter_package(root, launch.detect(root))
snapshot_download(info["repo"], revision=info["revision"], allow_patterns=mlx_backend.BASE_FILES)
print(f"Bielik-One: {repo} and {info['repo']}@{info['revision'][:7]} are in the cache", flush=True)
`;

/**
 * Downloads an adapter package and its base model into `<dataDir>/huggingface`, the cache the
 * services use, with the progress bars of huggingface_hub on the terminal. Files already in the
 * cache are not downloaded again.
 */
export async function prefetchBielikOne(
  install: BielikOneInstall,
  pkg: BielikOnePackage,
  ctx: RuntimeContext,
): Promise<void> {
  const python = join(dirname(install.executable), 'python');
  const result = await ctx.machine.run(
    'env',
    [
      `HF_HOME=${join(ctx.dataDir, 'huggingface')}`,
      python,
      '-c',
      PREFETCH_SCRIPT,
      pkg.repo,
      pkg.revision,
    ],
    { interactive: true, timeoutMs: null },
  );
  if (result.exitCode !== 0) {
    const login = pkg.gatedBase
      ? ' The base model is gated: accept its terms on huggingface.co and log in with HF_HOME set to the AI data directory (docs/dla-deweloperow.md).'
      : '';
    throw new Error(`Downloading ${pkg.repo} failed (exit code ${result.exitCode}).${login}`);
  }
}

/** A Bielik-One process as a command line: started by startBielikOne, or registered as a system service. */
export interface BielikOneCommand {
  command: string;
  args: string[];
  env: Readonly<Record<string, string>>;
  logFile: string;
}

/**
 * Command lines of `bielik-one backend` and `bielik-one frontend` for an adapter package. The
 * launcher fixes the ports per package and listens on 127.0.0.1.
 */
export function bielikOneCommands(
  install: BielikOneInstall,
  pkg: BielikOnePackage,
  dataDir: string,
): { backend: BielikOneCommand; frontend: BielikOneCommand } {
  const logs = join(dataDir, 'logs');
  const env = { HF_HOME: join(dataDir, 'huggingface') };
  const packageArgs = [pkg.repo, '--revision', pkg.revision];
  const engineArgs = install.engine === 'mlx' ? ['--engine', 'mlx'] : [];
  return {
    backend: {
      command: install.executable,
      args: ['backend', ...packageArgs, ...engineArgs],
      env,
      logFile: join(logs, 'bielik-one-backend.log'),
    },
    frontend: {
      command: install.executable,
      args: ['frontend', ...packageArgs],
      env,
      logFile: join(logs, 'bielik-one-frontend.log'),
    },
  };
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
  const detached = options.detached ?? false;
  const commands = bielikOneCommands(install, pkg, ctx.dataDir);
  const backend = await spawnLogged(commands.backend.command, commands.backend.args, {
    logFile: commands.backend.logFile,
    env: commands.backend.env,
    detached,
  });
  const frontend = await spawnLogged(commands.frontend.command, commands.frontend.args, {
    logFile: commands.frontend.logFile,
    env: commands.frontend.env,
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
  return { url, pids: [backend.pid, frontend.pid], stop };
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
