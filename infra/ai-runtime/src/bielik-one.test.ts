import { mkdtemp, rm } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BIELIK_ONE_PACKAGES,
  bielikOneCommands,
  fakeMachine,
  installBielikOne,
  isBielikOneReady,
  prefetchBielikOne,
} from './index.ts';
import { freePort, listen } from './test-helpers.ts';

const ARCHIVE =
  'https://github.com/speakleash/bielik-one/archive/b92c1118d273a5fcdd3f556afbf077a7f5735892.tar.gz';
const UV_OK = { exitCode: 0, stdout: 'uv 0.13.9', stderr: '' };

describe('installBielikOne', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'sarmata-ai-'));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('installs the vLLM variant with uv from the pinned commit, once', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 64,
      commands: { uv: UV_OK },
    });
    const venv = join(dataDir, 'bielik-one', 'vllm');
    const python = join(venv, 'bin', 'python');
    expect(await installBielikOne('vllm', { machine, dataDir })).toEqual({
      engine: 'vllm',
      executable: join(venv, 'bin', 'bielik-one'),
    });
    expect(machine.calls.map((call) => [call.command, ...call.args])).toEqual([
      ['uv', '--version'],
      ['uv', 'venv', '--python', '3.12', '--clear', venv],
      ['uv', 'pip', 'install', '--python', python, `bielik-one[vllm] @ ${ARCHIVE}`],
      [
        'uv',
        'pip',
        'install',
        '--python',
        python,
        '--no-deps',
        `systemone-vllm-heads @ ${ARCHIVE}#subdirectory=vllm-heads-plugin`,
      ],
    ]);
    await installBielikOne('vllm', { machine, dataDir });
    expect(machine.calls).toHaveLength(4);
  });

  it('installs the MLX variant without the vLLM plugin', async () => {
    const machine = fakeMachine({
      os: 'macos',
      arch: 'arm64',
      totalMemoryGiB: 32,
      commands: { uv: UV_OK },
    });
    const venv = join(dataDir, 'bielik-one', 'mlx');
    await installBielikOne('mlx', { machine, dataDir });
    expect(machine.calls.map((call) => call.args)).toEqual([
      ['--version'],
      ['venv', '--python', '3.12', '--clear', venv],
      ['pip', 'install', '--python', join(venv, 'bin', 'python'), `bielik-one[mlx] @ ${ARCHIVE}`],
    ]);
  });

  it('runs the uv executable it is given', async () => {
    const uv = join(dataDir, 'uv', 'uv');
    const machine = fakeMachine({
      os: 'macos',
      arch: 'arm64',
      totalMemoryGiB: 32,
      commands: { [uv]: UV_OK },
    });
    await installBielikOne('mlx', { machine, dataDir }, { uv });
    expect(machine.calls.map((call) => call.command)).toEqual([uv, uv, uv]);
  });

  it('asks for uv when it is missing', async () => {
    const machine = fakeMachine({ os: 'linux', arch: 'x64', totalMemoryGiB: 64 });
    await expect(installBielikOne('vllm', { machine, dataDir })).rejects.toThrow(/needs uv/);
  });

  it('refuses an engine the platform cannot run', async () => {
    const on = (os: 'linux' | 'macos' | 'windows') => ({
      machine: fakeMachine({ os, arch: 'arm64', totalMemoryGiB: 64, commands: { uv: UV_OK } }),
      dataDir,
    });
    await expect(installBielikOne('vllm', on('windows'))).rejects.toThrow(/does not run/);
    await expect(installBielikOne('vllm', on('macos'))).rejects.toThrow(/does not run/);
    await expect(installBielikOne('mlx', on('linux'))).rejects.toThrow(/does not run/);
  });
});

describe('isBielikOneReady', () => {
  const json = (response: ServerResponse, body: unknown): void => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  };

  const frontend = (calibrated: boolean) =>
    listen((request, response) => {
      if (request.url === '/health') {
        json(response, { status: 'ok', calibrated });
        return;
      }
      if (request.url === '/v1/systemone' && request.method === 'POST') {
        json(response, { filed: { probability: 0.97 } });
        return;
      }
      response.statusCode = 404;
      response.end();
    });

  it('is ready when /health reports calibration and a decision answers', async () => {
    const server = await frontend(true);
    try {
      expect(await isBielikOneReady(server.url)).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('is not ready while the model is not calibrated', async () => {
    const server = await frontend(false);
    try {
      expect(await isBielikOneReady(server.url)).toBe(false);
    } finally {
      await server.close();
    }
  });

  it('is not ready when nothing listens', async () => {
    expect(await isBielikOneReady(`http://127.0.0.1:${await freePort()}`)).toBe(false);
  });
});

describe('bielikOneCommands', () => {
  const dataDir = join('/data', 'sarmata', 'ai');
  const hfHome = { HF_HOME: join(dataDir, 'huggingface') };

  it('gives the MLX backend and the frontend with the Hugging Face cache and logs in the data directory', () => {
    const pkg = BIELIK_ONE_PACKAGES['bielik-one-4b-r1-adapter'];
    const executable = join(dataDir, 'bielik-one', 'mlx', 'bin', 'bielik-one');
    const commands = bielikOneCommands({ engine: 'mlx', executable }, pkg, dataDir);
    expect(commands.backend).toEqual({
      command: executable,
      args: ['backend', pkg.repo, '--revision', pkg.revision, '--engine', 'mlx'],
      env: hfHome,
      logFile: join(dataDir, 'logs', 'bielik-one-backend.log'),
    });
    expect(commands.frontend).toEqual({
      command: executable,
      args: ['frontend', pkg.repo, '--revision', pkg.revision],
      env: hfHome,
      logFile: join(dataDir, 'logs', 'bielik-one-frontend.log'),
    });
  });

  it('runs the vLLM backend without the engine flag', () => {
    const pkg = BIELIK_ONE_PACKAGES['bielik-one-11b-v3.1-r1-adapter'];
    const executable = join(dataDir, 'bielik-one', 'vllm', 'bin', 'bielik-one');
    expect(bielikOneCommands({ engine: 'vllm', executable }, pkg, dataDir).backend.args).toEqual([
      'backend',
      pkg.repo,
      '--revision',
      pkg.revision,
    ]);
  });
});

describe('prefetchBielikOne', () => {
  it('downloads the package and its base model into the shared Hugging Face cache', async () => {
    const machine = fakeMachine({
      os: 'macos',
      arch: 'arm64',
      totalMemoryGiB: 16,
      commands: { env: { exitCode: 0, stdout: '', stderr: '' } },
    });
    const pkg = BIELIK_ONE_PACKAGES['bielik-one-4b-r1-adapter'];
    const install = { engine: 'mlx' as const, executable: '/data/bielik-one/mlx/bin/bielik-one' };
    await prefetchBielikOne(install, pkg, { machine, dataDir: '/data' });
    const [call] = machine.calls;
    expect(call?.command).toBe('env');
    expect(call?.args.slice(0, 3)).toEqual([
      'HF_HOME=/data/huggingface',
      '/data/bielik-one/mlx/bin/python',
      '-c',
    ]);
    expect(call?.args.slice(4)).toEqual([pkg.repo, pkg.revision]);
    expect(call?.args[3]).toContain('allow_patterns=mlx_backend.BASE_FILES');
  });

  it('points to the Hugging Face login when a gated base model fails to download', async () => {
    const machine = fakeMachine({
      os: 'macos',
      arch: 'arm64',
      totalMemoryGiB: 64,
      commands: { env: { exitCode: 1, stdout: '', stderr: '' } },
    });
    const install = { engine: 'mlx' as const, executable: '/data/bielik-one/mlx/bin/bielik-one' };
    await expect(
      prefetchBielikOne(install, BIELIK_ONE_PACKAGES['bielik-one-11b-v3.1-r1-adapter'], {
        machine,
        dataDir: '/data',
      }),
    ).rejects.toThrow(/gated/);
  });
});
