import type { Architecture, Machine, OperatingSystem } from './machine.ts';

/** An NVIDIA card as nvidia-smi reports it. */
export interface NvidiaGpu {
  name: string;
  memoryMiB: number;
  driverMajor: number;
  /** CUDA compute capability, e.g. 8.9 for Ada Lovelace. */
  computeCapability: number;
}

/** A GPU as llama.cpp sees it (`llama-server --list-devices`), e.g. `CUDA0`, `Vulkan0`, `MTL0`. */
export interface ComputeDevice {
  id: string;
  name: string;
  memoryMiB: number;
  /** Shares system memory with the CPU (Apple, Intel and AMD integrated graphics). */
  integrated: boolean;
}

export interface Hardware {
  os: OperatingSystem;
  /** Native architecture, also when Node runs under Rosetta 2. */
  arch: Architecture;
  memoryMiB: number;
  nvidia: NvidiaGpu[];
  /** Empty until llama.cpp is installed and passed to `detectHardware`. */
  devices: ComputeDevice[];
}

const MiB = 1024 * 1024;
const NVIDIA_QUERY = [
  '--query-gpu=name,memory.total,driver_version,compute_cap',
  '--format=csv,noheader,nounits',
];
// Format from common/arg.cpp (b12359): "  %s: %s (%zu MiB, %zu MiB free)". CPU and BLAS have no index.
const DEVICE_LINE = /^\s+([A-Za-z]+\d+):\s+(.+?)\s+\((\d+) MiB, \d+ MiB free\)\s*$/;
const INTEGRATED_GPU =
  /^Apple\b|\b(UHD|HD) Graphics\b|\bIris\b|Intel\(R\) Graphics|Arc\(TM\) Graphics|Arc\(TM\) \d{3}V\b|Radeon\(TM\)( \d{3,4}M)? Graphics|Radeon \d{3,4}M\b|Vega \d* ?Graphics/i;

/**
 * Detects what the AI runtime can use. Without `llama` it knows the OS, memory and NVIDIA cards.
 * With an installed llama.cpp it also lists every GPU llama.cpp can drive (AMD, Intel, Apple).
 * Throws when the given llama-server cannot list its devices.
 */
export async function detectHardware(
  machine: Machine,
  llama?: { serverPath: string },
): Promise<Hardware> {
  const arch = await nativeArch(machine);
  const nvidia = await nvidiaGpus(machine);
  const devices = llama ? await llamaDevices(machine, llama.serverPath) : [];
  return {
    os: machine.os,
    arch,
    memoryMiB: Math.floor(machine.totalMemoryBytes / MiB),
    nvidia,
    devices,
  };
}

/** The NVIDIA card with the most memory, if any. */
export function largestNvidia(gpus: readonly NvidiaGpu[]): NvidiaGpu | undefined {
  return [...gpus].sort((a, b) => b.memoryMiB - a.memoryMiB)[0];
}

async function nativeArch(machine: Machine): Promise<Architecture> {
  if (machine.os !== 'macos' || machine.arch === 'arm64') return machine.arch;
  // An x64 Node under Rosetta 2 still runs on Apple silicon, so arm64 binaries are the right ones.
  const result = await machine.run('sysctl', ['-n', 'hw.optional.arm64'], { timeoutMs: 5000 });
  return result.exitCode === 0 && result.stdout.trim() === '1' ? 'arm64' : 'x64';
}

async function nvidiaGpus(machine: Machine): Promise<NvidiaGpu[]> {
  if (machine.os === 'macos') return [];
  const result = await machine.run('nvidia-smi', NVIDIA_QUERY, { timeoutMs: 15_000 });
  return result.exitCode === 0 ? parseNvidiaSmi(result.stdout) : [];
}

function parseNvidiaSmi(stdout: string): NvidiaGpu[] {
  return stdout.split(/\r?\n/).flatMap((line) => {
    const [name, memory, driver, capability, ...rest] = line.split(',').map((part) => part.trim());
    if (!name || memory === undefined || driver === undefined || capability === undefined)
      return [];
    if (rest.length > 0) return [];
    const gpu: NvidiaGpu = {
      name,
      memoryMiB: Number(memory),
      driverMajor: Number.parseInt(driver, 10),
      computeCapability: Number(capability),
    };
    const valid = [gpu.memoryMiB, gpu.driverMajor, gpu.computeCapability].every(Number.isFinite);
    return valid ? [gpu] : [];
  });
}

async function llamaDevices(machine: Machine, serverPath: string): Promise<ComputeDevice[]> {
  const result = await machine.run(serverPath, ['--list-devices'], { timeoutMs: 60_000 });
  if (result.exitCode !== 0) {
    throw new Error(`${serverPath} --list-devices failed: ${result.stderr.trim()}`);
  }
  return result.stdout.split(/\r?\n/).flatMap((line) => {
    const match = DEVICE_LINE.exec(line);
    const [, id, name, memory] = match ?? [];
    if (!id || !name || !memory) return [];
    return [{ id, name, memoryMiB: Number(memory), integrated: INTEGRATED_GPU.test(name) }];
  });
}
