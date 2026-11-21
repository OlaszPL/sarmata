import { mkdtemp, rm } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeMachine, installBielikOne, isBielikOneReady } from './index.ts';
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
