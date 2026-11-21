import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  fakeMachine,
  isLlamaServerReady,
  llamaServerCommand,
  MODEL_FILES,
  prepareLlamaServer,
  readLlamaServerConfig,
  startLlamaServer,
  type CommandResult,
  type ComputeDevice,
  type LlamaCpp,
  type LlamaServerConfig,
  type Machine,
  type ModelFile,
} from './index.ts';
import { freePort, listen } from './test-helpers.ts';

const LLAMA: LlamaCpp = {
  dir: '/opt/llama',
  serverPath: '/opt/llama/llama-server',
  benchPath: '/opt/llama/llama-bench',
  backend: 'vulkan',
  build: 'b12359',
};

const CONFIG: LlamaServerConfig = {
  serverPath: LLAMA.serverPath,
  modelPath: '/data/models/m.gguf',
  alias: 'bielik-11b-v3.1-instruct',
  host: '127.0.0.1',
  port: 55490,
  contextSize: 8192,
  parallel: 2,
  device: 'MTL0',
  logFile: '/data/logs/llama-server.log',
};

describe('llamaServerCommand', () => {
  it('starts llama-server with the model, the alias, the ChatML template and the chosen device', () => {
    expect(llamaServerCommand(CONFIG)).toEqual({
      command: '/opt/llama/llama-server',
      args: [
        '--model',
        '/data/models/m.gguf',
        '--alias',
        'bielik-11b-v3.1-instruct',
        '--host',
        '127.0.0.1',
        '--port',
        '55490',
        '--ctx-size',
        '8192',
        '--parallel',
        '2',
        '--kv-unified',
        '--no-jinja',
        '--chat-template',
        'chatml',
        '--no-webui',
        '--device',
        'MTL0',
      ],
    });
  });

  it('keeps every layer on the CPU when the device is none', () => {
    expect(llamaServerCommand({ ...CONFIG, device: 'none' }).args.slice(-4)).toEqual([
      '--device',
      'none',
      '--gpu-layers',
      '0',
    ]);
  });
});

describe('prepareLlamaServer', () => {
  const content = Buffer.from('GGUF test weights');
  const IGPU: ComputeDevice = {
    id: 'Vulkan0',
    name: 'Intel(R) Iris(R) Xe Graphics (RPL-P)',
    memoryMiB: 7854,
    integrated: true,
  };
  let dataDir: string;
  let requests: number;
  let server: { url: string; close: () => Promise<void> };

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'sarmata-ai-'));
    requests = 0;
    server = await listen((_request, response) => {
      requests += 1;
      response.end(content);
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const testModel = (overrides: Partial<ModelFile> = {}): ModelFile => ({
    ...MODEL_FILES['bielik-4.5b-v3.0-q8_0'],
    file: 'test.gguf',
    url: `${server.url}/test.gguf`,
    sizeBytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
    ...overrides,
  });

  const prepare = (machine: Machine, devices: ComputeDevice[], model: ModelFile = testModel()) =>
    prepareLlamaServer(
      {
        llama: LLAMA,
        hardware: { os: 'linux', arch: 'x64', memoryMiB: 16384, nvidia: [], devices },
        model,
        port: 55490,
        contextSize: 8192,
        parallel: 2,
      },
      { machine, dataDir },
    );

  const bench = (prompt: number, generation: number): CommandResult => ({
    exitCode: 0,
    stdout: JSON.stringify([
      { n_prompt: 128, n_gen: 0, avg_ts: prompt },
      { n_prompt: 0, n_gen: 32, avg_ts: generation },
    ]),
    stderr: '',
  });

  it('downloads and verifies the model once and uses Metal without a benchmark', async () => {
    const machine = fakeMachine({ os: 'macos', arch: 'arm64', totalMemoryGiB: 16 });
    const metal: ComputeDevice = {
      id: 'MTL0',
      name: 'Apple M2',
      memoryMiB: 12124,
      integrated: true,
    };
    const first = await prepare(machine, [metal]);
    const second = await prepare(machine, [metal]);
    expect(requests).toBe(1);
    expect(machine.calls).toEqual([]);
    expect(first.benchmark).toBeNull();
    expect(second.config).toEqual(first.config);
    expect(first.config).toEqual({
      serverPath: LLAMA.serverPath,
      modelPath: join(dataDir, 'models', 'test.gguf'),
      alias: 'bielik-4.5b-v3.0-instruct',
      host: '127.0.0.1',
      port: 55490,
      contextSize: 8192,
      parallel: 2,
      device: 'MTL0',
      logFile: join(dataDir, 'logs', 'llama-server.log'),
    });
    expect(await readFile(first.config.modelPath)).toEqual(content);
    expect(await readLlamaServerConfig(dataDir)).toEqual(first.config);
  });

  it('rejects a download with a wrong checksum and keeps no file', async () => {
    const machine = fakeMachine({ os: 'linux', arch: 'x64', totalMemoryGiB: 16 });
    await expect(prepare(machine, [], testModel({ sha256: '0'.repeat(64) }))).rejects.toThrow(
      /Checksum mismatch/,
    );
    expect(existsSync(join(dataDir, 'models', 'test.gguf'))).toBe(false);
    expect(existsSync(join(dataDir, 'models', 'test.gguf.part'))).toBe(false);
  });

  it('benchmarks the CPU against the GPU and keeps the GPU when it is faster', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: {
        [LLAMA.benchPath]: (args) => (args.includes('-dev') ? bench(420, 9.5) : bench(35, 6.2)),
      },
    });
    const { config, benchmark } = await prepare(machine, [IGPU]);
    expect(config.device).toBe('Vulkan0');
    expect(benchmark).toEqual({
      gpuDevice: 'Vulkan0',
      cpu: { promptTokensPerSecond: 35, generationTokensPerSecond: 6.2 },
      gpu: { promptTokensPerSecond: 420, generationTokensPerSecond: 9.5 },
    });
    expect(machine.calls.map((call) => call.args.slice(-4))).toEqual([
      ['-o', 'json', '-ngl', '0'],
      ['-dev', 'Vulkan0', '-ngl', '99'],
    ]);
  });

  it('falls back to the CPU when the GPU run fails', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: {
        [LLAMA.benchPath]: (args) =>
          args.includes('-dev')
            ? { exitCode: 1, stdout: '', stderr: 'vk::DeviceLostError' }
            : bench(35, 6.2),
      },
    });
    const { config, benchmark } = await prepare(machine, [IGPU]);
    expect(config.device).toBe('none');
    expect(benchmark?.gpu).toBeNull();
  });
});

const FAKE_SERVER = `
const http = require('node:http');
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]);
const startedAt = Date.now();
console.log('fake llama-server ' + args.join(' '));
http
  .createServer((request, response) => {
    if (request.url !== '/v1/health') {
      response.statusCode = 404;
      response.end();
      return;
    }
    const ready = Date.now() - startedAt > 300;
    response.statusCode = ready ? 200 : 503;
    response.setHeader('content-type', 'application/json');
    response.end(ready ? '{"status":"ok"}' : '{"error":{"code":503,"message":"Loading model"}}');
  })
  .listen(port, '127.0.0.1');
process.on('SIGTERM', () => process.exit(0));
`;

describe.skipIf(process.platform === 'win32')('startLlamaServer', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sarmata-llama-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const script = async (name: string, body: string): Promise<string> => {
    const path = join(dir, name);
    await writeFile(path, `#!/usr/bin/env node\n${body}\n`);
    await chmod(path, 0o755);
    return path;
  };

  it('waits for /v1/health, logs the output and stops the server', async () => {
    const port = await freePort();
    const config = {
      ...CONFIG,
      serverPath: await script('fake-llama-server.cjs', FAKE_SERVER),
      port,
      logFile: join(dir, 'logs', 'llama-server.log'),
    };
    const server = await startLlamaServer(config, { readyTimeoutMs: 10_000 });
    try {
      expect(server.url).toBe(`http://127.0.0.1:${port}/v1`);
      expect(await isLlamaServerReady(server.url)).toBe(true);
      expect(await readFile(config.logFile, 'utf8')).toContain('--chat-template chatml');
    } finally {
      await server.stop();
    }
    expect(await isLlamaServerReady(server.url)).toBe(false);
  }, 20_000);

  it('reports a server that exits before it is ready', async () => {
    const config = {
      ...CONFIG,
      serverPath: await script(
        'broken-llama-server.cjs',
        'console.error("failed to load model"); process.exit(3);',
      ),
      port: await freePort(),
      logFile: join(dir, 'broken.log'),
    };
    await expect(startLlamaServer(config, { readyTimeoutMs: 10_000 })).rejects.toThrow(
      /exited with code 3/,
    );
    expect(await readFile(config.logFile, 'utf8')).toContain('failed to load model');
  }, 20_000);
});
