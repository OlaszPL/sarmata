import { largestNvidia, type Hardware } from './hardware.ts';
import { llamaCppBundle, type LlamaCppBundle } from './llama-cpp-release.ts';
import {
  BIELIK_ONE_PACKAGES,
  MODEL_FILES,
  type BielikOneEngine,
  type BielikOnePackage,
  type ModelFile,
  type ModelId,
} from './models.ts';

export type InstallProfile = 'light' | 'standard' | 'server';

export interface RuntimeRecommendation {
  /** AI is on by default in every profile except light (ADR 0003, ADR 0005). */
  enabledByDefault: boolean;
  llamaCpp: LlamaCppBundle;
  /** Null when the machine is too weak even for Bielik-4.5B. */
  model: ModelFile | null;
  /** Only on vLLM (Linux, NVIDIA) or MLX (Apple silicon), and only when it fits next to the text model. */
  bielikOne: { engine: BielikOneEngine; package: BielikOnePackage } | null;
  /** llama-server settings for the profile. */
  server: { contextSize: number; parallel: number };
  /** One sentence for the installer screen, in Polish. */
  reason: string;
}

export interface RecommendOptions {
  /** A model chosen by hand instead of the tier. */
  model?: ModelId;
}

const MiB = 1024 * 1024;
const GiB_IN_MiB = 1024;
// Thresholds sit below the nominal sizes: an "8 GB" card reports 8188 MiB, an "8 GB" laptop ~7.6 GiB.
const MIN_RAM_MiB = 7 * GiB_IN_MiB;
const MIN_GPU_MiB = 7.5 * GiB_IN_MiB;
const MIN_MAC_RAM_MiB = 15 * GiB_IN_MiB;
// Metal may use about three quarters of unified memory.
const METAL_SHARE = 0.75;
// KV cache for a 16k context and compute buffers next to the weights on a server.
const SERVER_HEADROOM_MiB = 4 * GiB_IN_MiB;
// Memory left free when Bielik-One runs next to the text model.
const BIELIK_ONE_HEADROOM_MiB = 2 * GiB_IN_MiB;
const SERVER_QUANTS: readonly ModelId[] = [
  'bielik-11b-v3.1-q8_0',
  'bielik-11b-v3.1-q6_k',
  'bielik-11b-v3.1-q5_k_m',
  'bielik-11b-v3.1-q4_k_m',
];
const BIELIK_ONE_BY_SIZE: readonly BielikOnePackage[] = [
  BIELIK_ONE_PACKAGES['bielik-one-11b-v3.1-r1-adapter'],
  BIELIK_ONE_PACKAGES['bielik-one-4b-r1-adapter'],
];

/**
 * Tier of the local model for a machine and an install profile (ADR 0005). No GPU gives
 * Bielik-4.5B Q8_0, a GPU with 8 GB or a Mac with 16 GB gives Bielik-11B Q4_K_M, and the server
 * profile takes the highest 11B quantization that fits. Pure: no I/O.
 */
export function recommendRuntime(
  hardware: Hardware,
  profile: InstallProfile,
  options: RecommendOptions = {},
): RuntimeRecommendation {
  const { model, reason } = chooseModel(hardware, profile, options);
  const bielikOne = model ? chooseBielikOne(hardware, profile, model) : null;
  const engineName = bielikOne?.engine === 'vllm' ? 'vLLM' : 'MLX';
  return {
    enabledByDefault: profile !== 'light' && model !== null,
    llamaCpp: llamaCppBundle(hardware.os, hardware.arch, hardware.nvidia),
    model,
    bielikOne,
    server:
      profile === 'server'
        ? { contextSize: 16_384, parallel: 4 }
        : { contextSize: 8192, parallel: 2 },
    reason: bielikOne ? `${reason} Obok zmieści się Bielik-One (${engineName}).` : reason,
  };
}

const isAppleSilicon = (hardware: Hardware): boolean =>
  hardware.os === 'macos' && hardware.arch === 'arm64';
const sizeMiB = (model: ModelFile): number => model.sizeBytes / MiB;
const gb = (mib: number): number => Math.round(mib / GiB_IN_MiB);

function dedicatedGpuMiB(hardware: Hardware): number {
  return Math.max(
    0,
    ...hardware.nvidia.map((gpu) => gpu.memoryMiB),
    ...hardware.devices.filter((device) => !device.integrated).map((device) => device.memoryMiB),
  );
}

function chooseModel(
  hardware: Hardware,
  profile: InstallProfile,
  options: RecommendOptions,
): { model: ModelFile | null; reason: string } {
  if (options.model) {
    const model = MODEL_FILES[options.model];
    return { model, reason: `Model wybrany ręcznie: ${model.label} ${model.quantization}.` };
  }
  const apple = isAppleSilicon(hardware);
  const gpuMiB = dedicatedGpuMiB(hardware);
  if (apple ? hardware.memoryMiB >= MIN_MAC_RAM_MiB : gpuMiB >= MIN_GPU_MiB) {
    const budget = apple ? hardware.memoryMiB * METAL_SHARE : gpuMiB;
    const model =
      profile === 'server' ? largestFitting(budget) : MODEL_FILES['bielik-11b-v3.1-q4_k_m'];
    const where = apple
      ? `Mac z procesorem Apple i ${gb(hardware.memoryMiB)} GB pamięci`
      : `Karta graficzna z ${gb(gpuMiB)} GB pamięci`;
    return { model, reason: `${where}: ${model.label} w kwantyzacji ${model.quantization}.` };
  }
  if (hardware.memoryMiB >= MIN_RAM_MiB) {
    const model = MODEL_FILES['bielik-4.5b-v3.0-q8_0'];
    return {
      model,
      reason: `Brak karty graficznej z co najmniej 8 GB pamięci: ${model.label} w kwantyzacji ${model.quantization}.`,
    };
  }
  return {
    model: null,
    reason: `Za mało pamięci RAM na lokalny model (${gb(hardware.memoryMiB)} GB, potrzeba 8 GB). Moduł AI pozostaje wyłączony.`,
  };
}

function largestFitting(budgetMiB: number): ModelFile {
  const fitting = SERVER_QUANTS.map((id) => MODEL_FILES[id]).find(
    (model) => sizeMiB(model) + SERVER_HEADROOM_MiB <= budgetMiB,
  );
  return fitting ?? MODEL_FILES['bielik-11b-v3.1-q4_k_m'];
}

function chooseBielikOne(
  hardware: Hardware,
  profile: InstallProfile,
  model: ModelFile,
): RuntimeRecommendation['bielikOne'] {
  if (profile === 'light') return null;
  const nvidia = largestNvidia(hardware.nvidia);
  // vLLM runs on Linux, and bfloat16 (the calibrated precision) needs compute capability 8.0.
  const vllm =
    hardware.os === 'linux' &&
    hardware.arch === 'x64' &&
    nvidia !== undefined &&
    nvidia.computeCapability >= 8;
  const engine: BielikOneEngine | null = isAppleSilicon(hardware) ? 'mlx' : vllm ? 'vllm' : null;
  if (!engine) return null;
  const memory = engine === 'mlx' ? hardware.memoryMiB * METAL_SHARE : (nvidia?.memoryMiB ?? 0);
  const budget = memory - sizeMiB(model) - BIELIK_ONE_HEADROOM_MiB;
  const pkg = BIELIK_ONE_BY_SIZE.find((candidate) => candidate.requiredMiB[engine] <= budget);
  return pkg ? { engine, package: pkg } : null;
}
