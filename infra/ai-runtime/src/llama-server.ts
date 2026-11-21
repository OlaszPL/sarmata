import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RuntimeContext } from './context.ts';
import { downloadVerified } from './download.ts';
import type { ComputeDevice, Hardware } from './hardware.ts';
import type { LlamaCpp } from './llama-cpp-install.ts';
import type { Machine } from './machine.ts';
import type { ModelFile } from './models.ts';
import { spawnLogged, waitUntilReady, type StartOptions } from './process.ts';

/** Everything needed to start llama-server, saved as `<dataDir>/llama-server.json`. */
export interface LlamaServerConfig {
  serverPath: string;
  modelPath: string;
  /** Model name in the OpenAI-compatible API, used as SARMATA_AI_TEXT_MODEL. */
  alias: string;
  host: string;
  port: number;
  contextSize: number;
  parallel: number;
  /** llama.cpp device such as `MTL0`, `CUDA0` or `Vulkan0`, or `none` for the CPU. */
  device: string;
  logFile: string;
}

export interface Speed {
  promptTokensPerSecond: number;
  generationTokensPerSecond: number;
}

export interface Benchmark {
  gpuDevice: string;
  cpu: Speed;
  /** Null when the GPU run failed. */
  gpu: Speed | null;
}

export interface PrepareOptions {
  llama: LlamaCpp;
  hardware: Hardware;
  model: ModelFile;
  port: number;
  /** Default 127.0.0.1. */
  host?: string;
  contextSize: number;
  parallel: number;
}

export interface PreparedLlamaServer {
  config: LlamaServerConfig;
  /** Null when there was nothing to compare: no GPU, or Apple silicon where Metal always wins. */
  benchmark: Benchmark | null;
}

export interface RunningServer {
  /** OpenAI-compatible base URL ending with /v1, used as SARMATA_AI_TEXT_BASE_URL. */
  url: string;
  pid: number;
  logFile: string;
  stop(): Promise<void>;
}

const CONFIG_FILE = 'llama-server.json';
const BENCH_ARGS = ['-p', '128', '-n', '32', '-r', '1', '-o', 'json'];
const BENCH_TIMEOUT_MS = 10 * 60 * 1000;
const READY_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Gets llama-server ready to start: downloads and verifies the model, picks the device (a short
 * CPU against GPU benchmark) and saves the configuration in the data directory.
 */
export async function prepareLlamaServer(
  options: PrepareOptions,
  ctx: RuntimeContext,
): Promise<PreparedLlamaServer> {
  const { model, llama } = options;
  ctx.onProgress?.({
    kind: 'step',
    message: `Pobieranie modelu ${model.label} ${model.quantization}`,
  });
  const modelPath = await downloadVerified(
    { name: model.file, url: model.url, sizeBytes: model.sizeBytes, sha256: model.sha256 },
    join(ctx.dataDir, 'models', model.file),
    ctx,
  );
  ctx.onProgress?.({ kind: 'step', message: 'Wybór urządzenia: procesor czy karta graficzna' });
  const { device, benchmark } = await chooseDevice(
    ctx.machine,
    llama,
    modelPath,
    options.hardware.devices,
  );
  const config: LlamaServerConfig = {
    serverPath: llama.serverPath,
    modelPath,
    alias: model.alias,
    host: options.host ?? '127.0.0.1',
    port: options.port,
    contextSize: options.contextSize,
    parallel: options.parallel,
    device,
    logFile: join(ctx.dataDir, 'logs', 'llama-server.log'),
  };
  await writeFile(join(ctx.dataDir, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
  return { config, benchmark };
}

/** The configuration saved by `prepareLlamaServer`, or null before the first setup. */
export async function readLlamaServerConfig(dataDir: string): Promise<LlamaServerConfig | null> {
  try {
    return JSON.parse(await readFile(join(dataDir, CONFIG_FILE), 'utf8')) as LlamaServerConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** The llama-server command line, also used by the installer to register a system service. */
export function llamaServerCommand(config: LlamaServerConfig): {
  command: string;
  args: string[];
} {
  return {
    command: config.serverPath,
    args: [
      '--model',
      config.modelPath,
      '--alias',
      config.alias,
      '--host',
      config.host,
      '--port',
      String(config.port),
      '--ctx-size',
      String(config.contextSize),
      '--parallel',
      String(config.parallel),
      '--kv-unified',
      // The built-in ChatML template, not the Jinja one of the GGUF. Bielik v3 is ChatML, and its
      // Jinja template breaks forced JSON in b12359: every `response_format` fails with "Failed to
      // initialize samplers" (the grammar starts with the generation prompt). It also adds a
      // provider prompt of about 1000 tokens to every call.
      '--no-jinja',
      '--chat-template',
      'chatml',
      '--no-webui',
      '--device',
      config.device,
      ...(config.device === 'none' ? ['--gpu-layers', '0'] : []),
    ],
  };
}

/** Starts llama-server with its output in `config.logFile` and waits until the model is loaded. */
export async function startLlamaServer(
  config: LlamaServerConfig,
  options: StartOptions = {},
): Promise<RunningServer> {
  const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  const url = `http://${host}:${config.port}/v1`;
  if (await isLlamaServerReady(url)) throw new Error(`Another server already answers at ${url}`);
  const { command, args } = llamaServerCommand(config);
  const server = await spawnLogged(command, args, {
    logFile: config.logFile,
    detached: options.detached ?? false,
  });
  try {
    await waitUntilReady(
      'llama-server',
      () => isLlamaServerReady(url),
      [server],
      options.readyTimeoutMs ?? READY_TIMEOUT_MS,
    );
  } catch (error) {
    await server.stop();
    throw error;
  }
  return { url, pid: server.pid, logFile: config.logFile, stop: () => server.stop() };
}

/** True when llama-server at the /v1 base `url` has loaded its model. */
export async function isLlamaServerReady(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: unknown };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

async function chooseDevice(
  machine: Machine,
  llama: LlamaCpp,
  modelPath: string,
  devices: readonly ComputeDevice[],
): Promise<{ device: string; benchmark: Benchmark | null }> {
  const gpu = bestGpu(devices);
  if (!gpu) return { device: 'none', benchmark: null };
  if (gpu.id.startsWith('MTL')) return { device: gpu.id, benchmark: null };
  const cpu = await measure(machine, llama, modelPath, ['-ngl', '0']);
  if (!cpu) throw new Error(`llama-bench could not run ${modelPath} on the CPU`);
  const onGpu = await measure(machine, llama, modelPath, ['-dev', gpu.id, '-ngl', '99']);
  const useGpu = onGpu !== null && onGpu.generationTokensPerSecond >= cpu.generationTokensPerSecond;
  return { device: useGpu ? gpu.id : 'none', benchmark: { gpuDevice: gpu.id, cpu, gpu: onGpu } };
}

function bestGpu(devices: readonly ComputeDevice[]): ComputeDevice | undefined {
  const score = (device: ComputeDevice): number =>
    (device.id.startsWith('CUDA') ? 2e6 : 0) + (device.integrated ? 0 : 1e6) + device.memoryMiB;
  return [...devices].sort((a, b) => score(b) - score(a))[0];
}

async function measure(
  machine: Machine,
  llama: LlamaCpp,
  modelPath: string,
  deviceArgs: readonly string[],
): Promise<Speed | null> {
  const result = await machine.run(
    llama.benchPath,
    ['-m', modelPath, ...BENCH_ARGS, ...deviceArgs],
    { timeoutMs: BENCH_TIMEOUT_MS },
  );
  return result.exitCode === 0 ? parseBench(result.stdout) : null;
}

// llama-bench -o json prints an array with one row per test: n_prompt > 0 for prompt processing,
// n_gen > 0 for generation, avg_ts in tokens per second (tools/llama-bench, b12359).
function parseBench(stdout: string): Speed | null {
  let rows: unknown;
  try {
    rows = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const speed: Speed = { promptTokensPerSecond: 0, generationTokensPerSecond: 0 };
  for (const row of rows as { n_prompt?: unknown; n_gen?: unknown; avg_ts?: unknown }[]) {
    if (typeof row.avg_ts !== 'number') continue;
    if (typeof row.n_gen === 'number' && row.n_gen > 0)
      speed.generationTokensPerSecond = row.avg_ts;
    else if (typeof row.n_prompt === 'number' && row.n_prompt > 0)
      speed.promptTokensPerSecond = row.avg_ts;
  }
  return speed.generationTokensPerSecond > 0 ? speed : null;
}
