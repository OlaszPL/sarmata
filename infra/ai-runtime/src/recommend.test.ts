import { describe, expect, it } from 'vitest';
import {
  appleGpuBudgetMiB,
  bielikOneAlone,
  MODEL_FILES,
  recommendRuntime,
  runtimeChoices,
  type ComputeDevice,
  type Hardware,
  type InstallProfile,
  type LlamaBackend,
  type ModelId,
  type NvidiaGpu,
} from './index.ts';

const GiB = 1024;
const linuxLaptop: Hardware = {
  os: 'linux',
  arch: 'x64',
  memoryMiB: 16 * GiB,
  nvidia: [],
  devices: [],
};
const mac = (memoryGiB: number): Hardware => ({
  os: 'macos',
  arch: 'arm64',
  memoryMiB: memoryGiB * GiB,
  nvidia: [],
  devices: [
    {
      id: 'MTL0',
      name: 'Apple M2',
      memoryMiB: Math.round(memoryGiB * GiB * 0.74),
      integrated: true,
    },
  ],
});
const nvidia = (
  name: string,
  memoryMiB: number,
  driverMajor: number,
  computeCapability: number,
): NvidiaGpu => ({
  name,
  memoryMiB,
  driverMajor,
  computeCapability,
});
const withNvidia = (os: 'linux' | 'windows', gpu: NvidiaGpu): Hardware => ({
  os,
  arch: 'x64',
  memoryMiB: 32 * GiB,
  nvidia: [gpu],
  devices: [],
});
const device = (
  id: string,
  name: string,
  memoryMiB: number,
  integrated: boolean,
): ComputeDevice => ({
  id,
  name,
  memoryMiB,
  integrated,
});

const RTX_4070 = nvidia('NVIDIA GeForce RTX 4070', 12282, 580, 8.9);
const RTX_4090 = nvidia('NVIDIA GeForce RTX 4090', 24564, 580, 8.9);
const RTX_6000_ADA = nvidia('NVIDIA RTX 6000 Ada Generation', 49140, 580, 8.9);
const RADEON_WITH_IGPU: Hardware = {
  ...linuxLaptop,
  os: 'windows',
  devices: [
    device('Vulkan0', 'AMD Radeon RX 7800 XT', 16368, false),
    device('Vulkan1', 'Intel(R) UHD Graphics 770', 16271, true),
  ],
};

describe('recommendRuntime: model tier', () => {
  it('gives Bielik-4.5B Q8_0 on a machine without a GPU', () => {
    const recommendation = recommendRuntime(linuxLaptop, 'standard');
    expect(recommendation.model?.id).toBe('bielik-4.5b-v3.0-q8_0');
    expect(recommendation.enabledByDefault).toBe(true);
    expect(recommendation.bielikOne).toBeNull();
    expect(recommendation.server).toEqual({ contextSize: 8192, parallel: 2 });
  });

  it('keeps AI off by default in the light profile', () => {
    const recommendation = recommendRuntime(linuxLaptop, 'light');
    expect(recommendation.enabledByDefault).toBe(false);
    expect(recommendation.model?.id).toBe('bielik-4.5b-v3.0-q8_0');
  });

  it('recommends no model below 8 GB of RAM', () => {
    const recommendation = recommendRuntime({ ...linuxLaptop, memoryMiB: 6 * GiB }, 'standard');
    expect(recommendation.model).toBeNull();
    expect(recommendation.enabledByDefault).toBe(false);
  });

  it.each<[string, Hardware]>([
    ['a Mac with 16 GB', mac(16)],
    ['an 8 GB RTX 4060', withNvidia('linux', nvidia('NVIDIA GeForce RTX 4060', 8188, 580, 8.9))],
    ['a 12 GB RTX 4070', withNvidia('linux', RTX_4070)],
    ['a 16 GB Radeon seen through Vulkan', RADEON_WITH_IGPU],
  ])('gives Bielik-11B Q4_K_M on %s', (_name, hardware) => {
    expect(recommendRuntime(hardware, 'standard').model?.id).toBe('bielik-11b-v3.1-q4_k_m');
  });

  it('does not count integrated graphics as a GPU', () => {
    const hardware: Hardware = {
      ...linuxLaptop,
      devices: [device('Vulkan0', 'Intel(R) Iris(R) Xe Graphics (RPL-P)', 7854, true)],
    };
    expect(recommendRuntime(hardware, 'standard').model?.id).toBe('bielik-4.5b-v3.0-q8_0');
  });

  it.each<[string, Hardware, ModelId]>([
    ['a 12 GB card', withNvidia('linux', RTX_4070), 'bielik-11b-v3.1-q5_k_m'],
    ['a 24 GB card', withNvidia('linux', RTX_4090), 'bielik-11b-v3.1-q8_0'],
    ['a Mac with 16 GB', mac(16), 'bielik-11b-v3.1-q4_k_m'],
    ['a Mac with 32 GB', mac(32), 'bielik-11b-v3.1-q8_0'],
  ])('takes a higher quantization on a server with %s', (_name, hardware, expected) => {
    const recommendation = recommendRuntime(hardware, 'server');
    expect(recommendation.model?.id).toBe(expected);
    expect(recommendation.server).toEqual({ contextSize: 16_384, parallel: 4 });
  });

  it('uses a model chosen by hand', () => {
    const recommendation = recommendRuntime(linuxLaptop, 'standard', {
      model: 'bielik-11b-v3.1-q4_k_m',
    });
    expect(recommendation.model?.id).toBe('bielik-11b-v3.1-q4_k_m');
    expect(recommendation.reason).toContain('ręcznie');
  });
});

const PLATFORMS: [string, Hardware, LlamaBackend, string[]][] = [
  ['Mac on Apple silicon', mac(16), 'metal', ['llama-b12359-bin-macos-arm64.tar.gz']],
  [
    'Intel Mac',
    { ...mac(16), arch: 'x64', devices: [] },
    'cpu',
    ['llama-b12359-bin-macos-x64.tar.gz'],
  ],
  ['Linux without NVIDIA', linuxLaptop, 'vulkan', ['llama-b12359-bin-ubuntu-vulkan-x64.tar.gz']],
  [
    'Linux on arm64',
    { ...linuxLaptop, arch: 'arm64' },
    'vulkan',
    ['llama-b12359-bin-ubuntu-vulkan-arm64.tar.gz'],
  ],
  [
    'Linux with driver 580 and an Ada card',
    withNvidia('linux', RTX_4070),
    'cuda',
    [
      'llama-b12359-bin-ubuntu-cuda-13.5-x64.tar.gz',
      'cudart-llama-b12359-bin-ubuntu-cuda-13.5-x64.tar.gz',
    ],
  ],
  [
    'Linux with a Pascal card',
    withNvidia('linux', nvidia('NVIDIA GeForce GTX 1080', 8192, 580, 6.1)),
    'cuda',
    [
      'llama-b12359-bin-ubuntu-cuda-12.8-x64.tar.gz',
      'cudart-llama-b12359-bin-ubuntu-cuda-12.8-x64.tar.gz',
    ],
  ],
  [
    'Windows with driver 560',
    withNvidia('windows', nvidia('NVIDIA GeForce RTX 3060', 12288, 560, 8.6)),
    'cuda',
    ['llama-b12359-bin-win-cuda-12.4-x64.zip', 'cudart-llama-bin-win-cuda-12.4-x64.zip'],
  ],
  [
    'Windows with an old driver',
    withNvidia('windows', nvidia('NVIDIA GeForce GTX 750 Ti', 2048, 470, 5.0)),
    'vulkan',
    ['llama-b12359-bin-win-vulkan-x64.zip'],
  ],
  ['Windows without NVIDIA', RADEON_WITH_IGPU, 'vulkan', ['llama-b12359-bin-win-vulkan-x64.zip']],
];

describe('recommendRuntime: llama.cpp files', () => {
  it.each(PLATFORMS)('%s', (_name, hardware, backend, names) => {
    const bundle = recommendRuntime(hardware, 'standard').llamaCpp;
    expect(bundle.backend).toBe(backend);
    expect(bundle.assets.map((asset) => asset.name)).toEqual(names);
  });

  it('pins every archive to the b12359 release by URL, size and SHA-256', () => {
    for (const [, hardware] of PLATFORMS) {
      for (const asset of recommendRuntime(hardware, 'standard').llamaCpp.assets) {
        expect(asset.url).toBe(
          `https://github.com/ggml-org/llama.cpp/releases/download/b12359/${asset.name}`,
        );
        expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(asset.sizeBytes).toBeGreaterThan(1_000_000);
      }
    }
  });
});

describe('recommendRuntime: Bielik-One', () => {
  it('gives the GPU of a Mac two thirds of memory up to 32 GB and three quarters above', () => {
    expect(Math.round(appleGpuBudgetMiB(16 * GiB))).toBe(10_923);
    expect(Math.round(appleGpuBudgetMiB(32 * GiB))).toBe(21_845);
    expect(appleGpuBudgetMiB(36 * GiB)).toBe(27_648);
  });

  it('installs only Bielik-11B Q4_K_M on an M2 with 16 GB and says why, with the fallback', () => {
    const recommendation = recommendRuntime(mac(16), 'standard');
    expect(recommendation.model?.id).toBe('bielik-11b-v3.1-q4_k_m');
    expect(recommendation.bielikOne).toBeNull();
    expect(recommendation.decisionReason).toBe(
      'Bielik-One nie zmieści się na stałe obok modelu tekstowego: Bielik-One 4B (MLX) z modelem Bielik-11B-v3.1-Instruct Q4_K_M potrzebuje około 17,3 GB, a GPU tego Maca może użyć 10,7 GB. Decyzje podejmuje model tekstowy z wymuszonym formatem JSON. Oba modele naraz mieszczą się od 32 GB pamięci Maca.',
    );
    expect(recommendation.reason).toContain(recommendation.decisionReason);
  });

  it('has no room for Bielik-One next to the smaller model on a Mac with 16 GB either', () => {
    const choices = runtimeChoices(mac(16), 'standard');
    expect(choices.length).toBeGreaterThan(1);
    expect(choices.every((choice) => choice.bielikOne === null)).toBe(true);
  });

  it('still runs Bielik-One 4B alone on a Mac with 16 GB, for testing one model at a time', () => {
    expect(bielikOneAlone(mac(16))).toMatchObject({
      engine: 'mlx',
      package: { id: 'bielik-one-4b-r1-adapter' },
    });
    expect(bielikOneAlone(linuxLaptop)).toBeNull();
  });

  it.each<[number, string | undefined]>([
    [24, undefined],
    [32, 'bielik-one-4b-r1-adapter'],
    [36, 'bielik-one-4b-r1-adapter'],
    [48, 'bielik-one-11b-v3.1-r1-adapter'],
  ])('on a Mac with %i GB next to Q4_K_M picks %s', (memoryGiB, expected) => {
    expect(recommendRuntime(mac(memoryGiB), 'standard').bielikOne?.package.id).toBe(expected);
  });

  it('fits Bielik-One-4B on MLX next to the text model on a Mac with 32 GB', () => {
    const recommendation = recommendRuntime(mac(32), 'standard');
    expect(recommendation.bielikOne?.engine).toBe('mlx');
    expect(recommendation.bielikOne?.package.id).toBe('bielik-one-4b-r1-adapter');
    expect(recommendation.decisionReason).toBe(
      'Obok modelu tekstowego zmieści się Bielik-One 4B (MLX): razem około 17,3 GB, a GPU tego Maca może użyć 21,3 GB.',
    );
  });

  it('warns that the 11B base model needs a Hugging Face account', () => {
    expect(recommendRuntime(mac(48), 'standard').decisionReason).toContain('Hugging Face');
  });

  it('fits Bielik-One-4B on vLLM next to Q4_K_M on a 24 GB card', () => {
    const recommendation = recommendRuntime(withNvidia('linux', RTX_4090), 'standard');
    expect(recommendation.bielikOne).toMatchObject({
      engine: 'vllm',
      package: { id: 'bielik-one-4b-r1-adapter' },
    });
  });

  it('names the card size Bielik-One needs on a 12 GB card', () => {
    const recommendation = recommendRuntime(withNvidia('linux', RTX_4070), 'standard');
    expect(recommendation.bielikOne).toBeNull();
    expect(recommendation.decisionReason).toContain('od 24 GB pamięci karty NVIDIA');
  });

  it('fits Bielik-One-11B on vLLM next to Q8_0 on a 48 GB server card', () => {
    const recommendation = recommendRuntime(withNvidia('linux', RTX_6000_ADA), 'server');
    expect(recommendation.model?.id).toBe('bielik-11b-v3.1-q8_0');
    expect(recommendation.bielikOne).toMatchObject({
      engine: 'vllm',
      package: { id: 'bielik-one-11b-v3.1-r1-adapter' },
    });
  });

  it.each<[string, Hardware, InstallProfile, string]>([
    ['on Windows', withNvidia('windows', RTX_4090), 'standard', 'działa tylko na Macu'],
    ['in the light profile', withNvidia('linux', RTX_4090), 'light', 'W profilu light'],
  ])('leaves Bielik-One out %s and says why', (_name, hardware, profile, why) => {
    const recommendation = recommendRuntime(hardware, profile);
    expect(recommendation.bielikOne).toBeNull();
    expect(recommendation.decisionReason).toContain(why);
    expect(recommendation.decisionReason).toContain('wymuszonym formatem JSON');
  });
});

describe('runtimeChoices', () => {
  const ids = (hardware: Hardware, profile: InstallProfile): (string | undefined)[] =>
    runtimeChoices(hardware, profile).map((choice) => choice.model?.id);

  it('puts the recommended tier first, then the other models that fit, smallest first', () => {
    expect(ids(withNvidia('linux', RTX_4070), 'standard')).toEqual([
      'bielik-11b-v3.1-q4_k_m',
      'bielik-4.5b-v3.0-q8_0',
      'bielik-11b-v3.1-q5_k_m',
      'bielik-11b-v3.1-q6_k',
    ]);
  });

  it('offers only Bielik-4.5B without a GPU', () => {
    expect(ids(linuxLaptop, 'standard')).toEqual(['bielik-4.5b-v3.0-q8_0']);
  });

  it('offers nothing below 8 GB of RAM', () => {
    expect(runtimeChoices({ ...linuxLaptop, memoryMiB: 4 * GiB }, 'light')).toEqual([]);
  });

  it('decides Bielik-One per model: it fits next to Q4_K_M on a 32 GB Mac, not next to Q8_0', () => {
    const decisions = new Map(
      runtimeChoices(mac(32), 'standard').map((choice) => [choice.model?.id, choice.bielikOne]),
    );
    expect(decisions.get('bielik-11b-v3.1-q4_k_m')?.engine).toBe('mlx');
    expect(decisions.get('bielik-4.5b-v3.0-q8_0')?.engine).toBe('mlx');
    expect(decisions.get('bielik-11b-v3.1-q8_0')).toBeNull();
  });
});

describe('MODEL_FILES', () => {
  it('pins every model to a commit and a SHA-256', () => {
    for (const model of Object.values(MODEL_FILES)) {
      expect(model.url).toBe(
        `https://huggingface.co/${model.repo}/resolve/${model.revision}/${model.file}`,
      );
      expect(model.revision).toMatch(/^[0-9a-f]{40}$/);
      expect(model.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
