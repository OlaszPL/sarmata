import type { DownloadAsset } from './context.ts';
import { largestNvidia, type NvidiaGpu } from './hardware.ts';
import type { Architecture, OperatingSystem } from './machine.ts';

export type LlamaBackend = 'metal' | 'cuda' | 'vulkan' | 'cpu';

/** Stable llama.cpp v1.0.0 is a tag on nightly build b12359, whose release holds the archives. */
export const LLAMA_CPP_RELEASE = { version: 'v1.0.0', build: 'b12359' } as const;

/** Archives for one platform and backend. The first holds llama-server, the rest add libraries. */
export interface LlamaCppBundle {
  key: string;
  backend: LlamaBackend;
  assets: readonly DownloadAsset[];
}

const RELEASE_URL = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_RELEASE.build}/`;

const asset = (name: string, sizeBytes: number, sha256: string): DownloadAsset => ({
  name,
  url: `${RELEASE_URL}${name}`,
  sizeBytes,
  sha256,
});

// Sizes and digests from `gh api repos/ggml-org/llama.cpp/releases/tags/b12359`, 21.11.2026.
const BUNDLES = {
  'macos-metal-arm64': {
    backend: 'metal',
    assets: [
      asset(
        'llama-b12359-bin-macos-arm64.tar.gz',
        16_907_811,
        '82b00abc740160e1b9980e6cc79c117345fa34af058c80e6c0a69aa8ddccde75',
      ),
    ],
  },
  'macos-cpu-x64': {
    backend: 'cpu',
    assets: [
      asset(
        'llama-b12359-bin-macos-x64.tar.gz',
        12_661_621,
        '25320d529077ef5a3d16e7b5da26438f221d88c8c0930a32b0c79457f5eede56',
      ),
    ],
  },
  'linux-vulkan-x64': {
    backend: 'vulkan',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-vulkan-x64.tar.gz',
        36_153_377,
        '19b60f00395a3f4954e46a5037695bc1d843404fc9d3124f82a612ecd8fbe9f0',
      ),
    ],
  },
  'linux-vulkan-arm64': {
    backend: 'vulkan',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-vulkan-arm64.tar.gz',
        29_435_221,
        '3f8ae812a58ac92e5a596ca9fbc988f52854d147c5a7fe1264dddc90c1d085b4',
      ),
    ],
  },
  'linux-cuda-12.8-x64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-cuda-12.8-x64.tar.gz',
        199_223_370,
        '50c937bec5bbd9f74c99138034f7403283ee21f1943f2429d7b1e4c079eafc11',
      ),
      asset(
        'cudart-llama-b12359-bin-ubuntu-cuda-12.8-x64.tar.gz',
        594_371_571,
        '75a12d227f44a391608992329241765343bd143ee9445b90dc62e154ee726e5d',
      ),
    ],
  },
  'linux-cuda-13.5-x64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-cuda-13.5-x64.tar.gz',
        178_419_847,
        '9440f417615bed0e191acef03bff0249117d2be74335358265a6d28475a9baf0',
      ),
      asset(
        'cudart-llama-b12359-bin-ubuntu-cuda-13.5-x64.tar.gz',
        444_078_822,
        '976a9146bb8a487a6ea701224d7fb14b05e494ab3c8f5c1799ffc4e5805d640c',
      ),
    ],
  },
  'linux-cuda-13.5-arm64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-ubuntu-cuda-13.5-arm64.tar.gz',
        173_529_798,
        'e12fd3ca9a599349cac5ec767825e17f8cab9dc2dab8d8e5b85d50ce21ef6d7d',
      ),
      asset(
        'cudart-llama-b12359-bin-ubuntu-cuda-13.5-arm64.tar.gz',
        559_874_231,
        '998f62318999710d398dad40821d1d037731f360791e41628d9dfcde207909d1',
      ),
    ],
  },
  'windows-vulkan-x64': {
    backend: 'vulkan',
    assets: [
      asset(
        'llama-b12359-bin-win-vulkan-x64.zip',
        38_090_643,
        'e8d18c6e4210cca87e7307c2ea78363ac8d158e4e1397358ec96ab70b53a0d5e',
      ),
    ],
  },
  'windows-vulkan-arm64': {
    backend: 'vulkan',
    assets: [
      asset(
        'llama-b12359-bin-win-vulkan-arm64.zip',
        26_027_698,
        '62cd50089cffdd825524a91c5a8819041eb75d8e2beacd6eca68194dba50574f',
      ),
    ],
  },
  'windows-cuda-12.4-x64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-win-cuda-12.4-x64.zip',
        318_976_332,
        'e9c0abf442e8339c06728366c1ad2c711332f9939c0c00603fb75d85fd44c914',
      ),
      asset(
        'cudart-llama-bin-win-cuda-12.4-x64.zip',
        391_443_627,
        '8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6',
      ),
    ],
  },
  'windows-cuda-13.5-x64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-win-cuda-13.5-x64.zip',
        179_546_112,
        '1de9ca1ff408d6e348ea0007c6880ad2393311a02e7799bcde26dc16daef03dd',
      ),
      asset(
        'cudart-llama-bin-win-cuda-13.5-x64.zip',
        426_314_199,
        'c2bf4cc202bfbaaa7a0b75f5082457c3811326947bb216059b72839d844e9cba',
      ),
    ],
  },
  'windows-cuda-13.5-arm64': {
    backend: 'cuda',
    assets: [
      asset(
        'llama-b12359-bin-win-cuda-13.5-arm64.zip',
        167_147_417,
        'f40398808e74b88c3ccee904824667ef9825692843533e7fc22881ab2e4de9da',
      ),
      asset(
        'cudart-llama-bin-win-cuda-13.5-arm64.zip',
        278_821_062,
        'f89e7b2457f627d052dd99f42205ddfd01964454809754cdc649cffc74320dca',
      ),
    ],
  },
} satisfies Record<string, { backend: LlamaBackend; assets: readonly DownloadAsset[] }>;

type BundleKey = keyof typeof BUNDLES;

/**
 * Picks the llama.cpp archives for a platform: Metal on Apple silicon, CUDA when the NVIDIA
 * driver and card allow it, otherwise Vulkan, which also runs on the CPU alone.
 */
export function llamaCppBundle(
  os: OperatingSystem,
  arch: Architecture,
  nvidia: readonly NvidiaGpu[],
): LlamaCppBundle {
  const key = bundleKey(os, arch, nvidia);
  return { key, ...BUNDLES[key] };
}

function bundleKey(
  os: OperatingSystem,
  arch: Architecture,
  nvidia: readonly NvidiaGpu[],
): BundleKey {
  if (os === 'macos') return arch === 'arm64' ? 'macos-metal-arm64' : 'macos-cpu-x64';
  const gpu = largestNvidia(nvidia);
  const cuda = gpu ? cudaBundleKey(os, arch, gpu) : null;
  return cuda ?? (`${os}-vulkan-${arch}` as const);
}

// CUDA 13 needs driver 580+ and compute capability 7.5+ (Turing). CUDA 12.4 needs driver 551.61+
// on Windows and CUDA 12.8 needs 570+ on Linux, and both still run Maxwell and Pascal (5.0+).
function cudaBundleKey(
  os: 'linux' | 'windows',
  arch: Architecture,
  gpu: NvidiaGpu,
): BundleKey | null {
  if (gpu.driverMajor >= 580 && gpu.computeCapability >= 7.5) {
    return `${os}-cuda-13.5-${arch}` as const;
  }
  if (arch !== 'x64' || gpu.computeCapability < 5) return null;
  if (os === 'linux') return gpu.driverMajor >= 570 ? 'linux-cuda-12.8-x64' : null;
  return gpu.driverMajor >= 552 ? 'windows-cuda-12.4-x64' : null;
}
