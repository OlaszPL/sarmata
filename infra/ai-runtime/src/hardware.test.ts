import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectHardware, fakeMachine, type CommandResult } from './index.ts';

const fixture = (name: string): string =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const ok = (stdout: string): CommandResult => ({ exitCode: 0, stdout, stderr: '' });
const LLAMA = { serverPath: '/opt/sarmata/llama-server' };

describe('detectHardware', () => {
  it('reads Apple silicon with Metal from a recorded M2 sample', async () => {
    const machine = fakeMachine({
      os: 'macos',
      arch: 'arm64',
      totalMemoryGiB: 16,
      commands: { [LLAMA.serverPath]: ok(fixture('list-devices-macos-m2.txt')) },
    });
    expect(await detectHardware(machine, LLAMA)).toEqual({
      os: 'macos',
      arch: 'arm64',
      memoryMiB: 16384,
      nvidia: [],
      devices: [{ id: 'MTL0', name: 'Apple M2', memoryMiB: 12124, integrated: true }],
    });
  });

  it('reads NVIDIA cards from nvidia-smi and CUDA devices from llama.cpp', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 32,
      commands: {
        'nvidia-smi': ok(fixture('nvidia-smi-linux.txt')),
        [LLAMA.serverPath]: ok(fixture('list-devices-linux-cuda.txt')),
      },
    });
    const hardware = await detectHardware(machine, LLAMA);
    expect(hardware.nvidia).toEqual([
      {
        name: 'NVIDIA GeForce RTX 4070',
        memoryMiB: 12282,
        driverMajor: 580,
        computeCapability: 8.9,
      },
      {
        name: 'NVIDIA GeForce GTX 1080',
        memoryMiB: 8192,
        driverMajor: 580,
        computeCapability: 6.1,
      },
    ]);
    expect(hardware.devices).toEqual([
      { id: 'CUDA0', name: 'NVIDIA GeForce RTX 4070', memoryMiB: 11873, integrated: false },
    ]);
    expect(machine.calls[0]).toEqual({
      command: 'nvidia-smi',
      args: [
        '--query-gpu=name,memory.total,driver_version,compute_cap',
        '--format=csv,noheader,nounits',
      ],
    });
  });

  it('tells a dedicated AMD card from Intel integrated graphics on Windows', async () => {
    const machine = fakeMachine({
      os: 'windows',
      arch: 'x64',
      totalMemoryGiB: 32,
      commands: { [LLAMA.serverPath]: ok(fixture('list-devices-windows-vulkan.txt')) },
    });
    expect((await detectHardware(machine, LLAMA)).devices).toEqual([
      { id: 'Vulkan0', name: 'AMD Radeon RX 7800 XT', memoryMiB: 16368, integrated: false },
      { id: 'Vulkan1', name: 'Intel(R) UHD Graphics 770', memoryMiB: 16271, integrated: true },
    ]);
  });

  it('marks Intel Iris Xe as integrated', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: { [LLAMA.serverPath]: ok(fixture('list-devices-linux-igpu.txt')) },
    });
    expect((await detectHardware(machine, LLAMA)).devices).toEqual([
      {
        id: 'Vulkan0',
        name: 'Intel(R) Iris(R) Xe Graphics (RPL-P)',
        memoryMiB: 7854,
        integrated: true,
      },
    ]);
  });

  it('treats a failing nvidia-smi as no NVIDIA card', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: {
        'nvidia-smi': {
          exitCode: 9,
          stdout: "NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver.",
          stderr: '',
        },
      },
    });
    expect((await detectHardware(machine)).nvidia).toEqual([]);
  });

  it('reports the native architecture under Rosetta 2', async () => {
    const machine = fakeMachine({
      os: 'macos',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: { sysctl: ok('1\n') },
    });
    expect((await detectHardware(machine)).arch).toBe('arm64');
  });

  it('does not ask llama.cpp before it is installed', async () => {
    const machine = fakeMachine({ os: 'linux', arch: 'x64', totalMemoryGiB: 16 });
    expect((await detectHardware(machine)).devices).toEqual([]);
    expect(machine.calls.map((call) => call.command)).toEqual(['nvidia-smi']);
  });

  it('fails when llama-server cannot list devices', async () => {
    const machine = fakeMachine({
      os: 'linux',
      arch: 'x64',
      totalMemoryGiB: 16,
      commands: {
        [LLAMA.serverPath]: {
          exitCode: 127,
          stdout: '',
          stderr: 'error while loading shared libraries: libgomp.so.1',
        },
      },
    });
    await expect(detectHardware(machine, LLAMA)).rejects.toThrow(/--list-devices failed/);
  });
});
