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

/** Installation profiles of ADR 0003, shared with the installer (@sarmata/deploy). */
export const INSTALL_PROFILES = ['light', 'standard', 'server'] as const;
export type InstallProfile = (typeof INSTALL_PROFILES)[number];

/** A Bielik-One package and the engine that runs it. */
export interface BielikOneChoice {
  engine: BielikOneEngine;
  package: BielikOnePackage;
}

/**
 * How Bielik-One runs on the machine. `concurrent`: next to the text model. `switching`: it fits only
 * alone, so one model is in memory at a time and a host-side switcher swaps them (not built yet, the
 * installer may already offer it as "tryb przełączany"). `text-only`: no Bielik-One, decisions come
 * from the text model with forced JSON.
 */
export type BielikOnePlan =
  | { mode: 'concurrent'; choice: BielikOneChoice }
  | { mode: 'switching'; choice: BielikOneChoice }
  | { mode: 'text-only' };

export interface RuntimeRecommendation {
  /** AI is on by default in every profile except light (ADR 0003, ADR 0005). */
  enabledByDefault: boolean;
  llamaCpp: LlamaCppBundle;
  /** Null when the machine is too weak even for Bielik-4.5B. */
  model: ModelFile | null;
  /** Only on vLLM (Linux, NVIDIA) or MLX (Apple silicon), and only when it fits next to the text model. */
  bielikOne: BielikOneChoice | null;
  /** Concurrent (the same choice as `bielikOne`), switching, or text only. */
  bielikOnePlan: BielikOnePlan;
  /**
   * Why Bielik-One is or is not installed next to the text model, with the fallback and the memory
   * it would need. In Polish, for the installer screen. Never empty.
   */
  decisionReason: string;
  /** llama-server settings for the profile. */
  server: { contextSize: number; parallel: number };
  /** The text model and the Bielik-One decision, for the installer screen, in Polish. */
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
// Bielik-11B is the default only from a clearly faster tier: a Mac with 24 GB (24576 MiB) or a
// card with 12 GB (12282 MiB). Below it the fast tier is Bielik-4.5B Q4_K_M: Bielik-11B Q4_K_M
// generates 8 to 10 tok/s on an M2 with 16 GB, and a full sheet draft took about 4 minutes there.
const MIN_MAC_11B_RAM_MiB = 23 * GiB_IN_MiB;
const MIN_GPU_11B_MiB = 11.5 * GiB_IN_MiB;
const FAST_TIER_REASON =
  'To szybszy model na tym sprzęcie, około 2 razy szybsze generowanie, trochę słabsza polszczyzna.';
// KV cache for a 16k context and compute buffers next to the weights on a server.
const SERVER_HEADROOM_MiB = 4 * GiB_IN_MiB;
// Compute buffers next to the weights on a workstation: an 8 GB card still takes Q4_K_M.
const DESKTOP_HEADROOM_MiB = 1 * GiB_IN_MiB;
// KV cache and compute buffers of the text model next to Bielik-One on a workstation: the 8k context
// of Bielik-11B (50 layers, 8 KV heads of 128) takes 1.6 GiB in f16.
const BIELIK_ONE_HEADROOM_MiB = 2 * GiB_IN_MiB;
// Memory sizes the minimum in a message is rounded up to.
const MAC_MEMORY_GB = [16, 18, 24, 32, 36, 48, 64, 96, 128, 192, 256, 512] as const;
const GPU_MEMORY_GB = [8, 12, 16, 20, 24, 32, 40, 48, 80, 96, 141, 192] as const;
// An NVIDIA card reports a little less than its nominal size (24564 MiB for 24 GB).
const GPU_REPORTED_SLACK_MiB = 128;
const DECISION_FALLBACK = 'Decyzje podejmuje model tekstowy z wymuszonym formatem JSON.';
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
 * Bielik-4.5B Q8_0. A Mac below 24 GB or a card below 12 GB gives Bielik-4.5B Q4_K_M for speed. A
 * Mac from 24 GB or a card from 12 GB gives Bielik-11B Q4_K_M, and there the server profile takes
 * the highest 11B quantization that fits. Pure: no I/O.
 */
export function recommendRuntime(
  hardware: Hardware,
  profile: InstallProfile,
  options: RecommendOptions = {},
): RuntimeRecommendation {
  const { model, reason } = chooseModel(hardware, profile, options);
  const decision = model
    ? chooseBielikOne(hardware, profile, model)
    : {
        bielikOne: null,
        bielikOnePlan: { mode: 'text-only' } as const,
        decisionReason: 'Bez modelu tekstowego Bielik-One nie jest instalowany.',
      };
  return {
    enabledByDefault: profile !== 'light' && model !== null,
    llamaCpp: llamaCppBundle(hardware.os, hardware.arch, hardware.nvidia),
    model,
    ...decision,
    server:
      profile === 'server'
        ? { contextSize: 16_384, parallel: 4 }
        : { contextSize: 8192, parallel: 2 },
    reason: model ? `${reason} ${decision.decisionReason}` : reason,
  };
}

const SIZE_ORDER: readonly ModelId[] = [
  'bielik-4.5b-v3.0-q4_k_m',
  'bielik-4.5b-v3.0-q8_0',
  'bielik-11b-v3.1-q4_k_m',
  'bielik-11b-v3.1-q5_k_m',
  'bielik-11b-v3.1-q6_k',
  'bielik-11b-v3.1-q8_0',
];

/**
 * Every model the machine can run for a profile, as full recommendations: the recommended tier
 * first, then the other fitting models from the smallest. Empty when nothing fits. The installer
 * offers this list, so the user may pick another model than the tier (or none at all). On a Mac
 * with 16 GB the list is Bielik-4.5B Q4_K_M, then Bielik-11B Q4_K_M and the larger 11B files.
 */
export function runtimeChoices(
  hardware: Hardware,
  profile: InstallProfile,
): RuntimeRecommendation[] {
  const recommended = recommendRuntime(hardware, profile);
  if (recommended.model === null) return [];
  const recommendedId = recommended.model.id;
  const others = SIZE_ORDER.filter((id) => id !== recommendedId && fits(hardware, profile, id));
  return [recommended, ...others.map((model) => recommendRuntime(hardware, profile, { model }))];
}

function fits(hardware: Hardware, profile: InstallProfile, id: ModelId): boolean {
  const model = MODEL_FILES[id];
  const apple = isAppleSilicon(hardware);
  if (id === 'bielik-4.5b-v3.0-q4_k_m') return hardware.memoryMiB >= MIN_RAM_MiB;
  // On Metal the Q4_K_M file of the same model is faster, and the memory is better spent on 11B.
  if (id === 'bielik-4.5b-v3.0-q8_0') return !apple && hardware.memoryMiB >= MIN_RAM_MiB;
  const budget = apple ? appleGpuBudgetMiB(hardware.memoryMiB) : dedicatedGpuMiB(hardware);
  const headroom = profile === 'server' ? SERVER_HEADROOM_MiB : DESKTOP_HEADROOM_MiB;
  return sizeMiB(model) + headroom <= budget;
}

const isAppleSilicon = (hardware: Hardware): boolean =>
  hardware.os === 'macos' && hardware.arch === 'arm64';
const sizeMiB = (model: ModelFile): number => model.sizeBytes / MiB;
const gb = (mib: number): number => Math.round(mib / GiB_IN_MiB);
const gbOneDecimal = (mib: number): string => (mib / GiB_IN_MiB).toFixed(1).replace('.', ',');

/**
 * Unified memory the GPU of a Mac may use: macOS reports about two thirds of it as
 * recommendedMaxWorkingSetSize up to 32 GB and three quarters above (10.7 GiB on a 16 GB M2). The
 * rest stays for macOS, the browser and Docker.
 */
export function appleGpuBudgetMiB(memoryMiB: number): number {
  return memoryMiB * (memoryMiB > 32 * GiB_IN_MiB ? 0.75 : 2 / 3);
}

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
  const where = apple
    ? `Mac z procesorem Apple i ${gb(hardware.memoryMiB)} GB pamięci`
    : `Karta graficzna z ${gb(gpuMiB)} GB pamięci`;
  if (apple ? hardware.memoryMiB >= MIN_MAC_11B_RAM_MiB : gpuMiB >= MIN_GPU_11B_MiB) {
    const budget = apple ? appleGpuBudgetMiB(hardware.memoryMiB) : gpuMiB;
    const model =
      profile === 'server' ? largestFitting(budget) : MODEL_FILES['bielik-11b-v3.1-q4_k_m'];
    return { model, reason: `${where}: ${model.label} w kwantyzacji ${model.quantization}.` };
  }
  if (apple ? hardware.memoryMiB >= MIN_RAM_MiB : gpuMiB >= MIN_GPU_MiB) {
    const model = MODEL_FILES['bielik-4.5b-v3.0-q4_k_m'];
    return {
      model,
      reason: `${where}: ${model.label} w kwantyzacji ${model.quantization}. ${FAST_TIER_REASON}`,
    };
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

/** The engine that can run Bielik-One here, if any (ADR 0005). */
function bielikOneEngine(hardware: Hardware): BielikOneEngine | null {
  if (isAppleSilicon(hardware)) return 'mlx';
  const nvidia = largestNvidia(hardware.nvidia);
  // vLLM runs on Linux, and bfloat16 (the calibrated precision) needs compute capability 8.0.
  const vllm =
    hardware.os === 'linux' &&
    hardware.arch === 'x64' &&
    nvidia !== undefined &&
    nvidia.computeCapability >= 8;
  return vllm ? 'vllm' : null;
}

/** Memory Bielik-One and the text model share: the Mac's GPU budget, or the largest NVIDIA card. */
function bielikOneBudgetMiB(hardware: Hardware, engine: BielikOneEngine): number {
  return engine === 'mlx'
    ? appleGpuBudgetMiB(hardware.memoryMiB)
    : (largestNvidia(hardware.nvidia)?.memoryMiB ?? 0);
}

const engineName = (engine: BielikOneEngine): string => (engine === 'vllm' ? 'vLLM' : 'MLX');

/** The smallest common memory size (in GB) that holds `needMiB` on this engine. */
function minimumMemoryGb(engine: BielikOneEngine, needMiB: number): number | null {
  const sizes = engine === 'mlx' ? MAC_MEMORY_GB : GPU_MEMORY_GB;
  const fits = (size: number): boolean =>
    engine === 'mlx'
      ? appleGpuBudgetMiB(size * GiB_IN_MiB) >= needMiB
      : size * GiB_IN_MiB - GPU_REPORTED_SLACK_MiB >= needMiB;
  return sizes.find(fits) ?? null;
}

function chooseBielikOne(
  hardware: Hardware,
  profile: InstallProfile,
  model: ModelFile,
): Pick<RuntimeRecommendation, 'bielikOne' | 'bielikOnePlan' | 'decisionReason'> {
  if (profile === 'light') {
    return {
      bielikOne: null,
      bielikOnePlan: { mode: 'text-only' },
      decisionReason: `W profilu light Bielik-One nie jest instalowany. ${DECISION_FALLBACK}`,
    };
  }
  const engine = bielikOneEngine(hardware);
  if (!engine) {
    return {
      bielikOne: null,
      bielikOnePlan: { mode: 'text-only' },
      decisionReason: `Bielik-One działa tylko na Macu z procesorem Apple (MLX) albo na Linuksie z kartą NVIDIA o compute capability co najmniej 8.0 (vLLM). ${DECISION_FALLBACK}`,
    };
  }
  const budget = bielikOneBudgetMiB(hardware, engine);
  const text =
    sizeMiB(model) + (profile === 'server' ? SERVER_HEADROOM_MiB : BIELIK_ONE_HEADROOM_MiB);
  const where = engine === 'mlx' ? 'GPU tego Maca może użyć' : 'karta graficzna ma';
  const pkg = BIELIK_ONE_BY_SIZE.find(
    (candidate) => text + candidate.requiredMiB[engine] <= budget,
  );
  if (pkg) {
    const gated = pkg.gatedBase
      ? ' Jego model bazowy wymaga konta Hugging Face z zaakceptowaną licencją (ADR 0005).'
      : '';
    const choice = { engine, package: pkg };
    return {
      bielikOne: choice,
      bielikOnePlan: { mode: 'concurrent', choice },
      decisionReason: `Obok modelu tekstowego zmieści się ${pkg.label} (${engineName(engine)}): razem około ${gbOneDecimal(text + pkg.requiredMiB[engine])} GB, a ${where} ${gbOneDecimal(budget)} GB.${gated}`,
    };
  }
  const smallest = BIELIK_ONE_BY_SIZE[BIELIK_ONE_BY_SIZE.length - 1];
  if (!smallest) throw new Error('No Bielik-One package defined');
  const need = text + smallest.requiredMiB[engine];
  const minimum = minimumMemoryGb(engine, need);
  const threshold =
    minimum === null
      ? ''
      : ` Oba modele naraz mieszczą się od ${minimum} GB ${engine === 'mlx' ? 'pamięci Maca' : 'pamięci karty NVIDIA'}.`;
  const alone = bielikOneAlone(hardware);
  const switching =
    alone === null
      ? ''
      : ` W trybie przełączanym (jeden model w pamięci naraz) może działać ${alone.package.label} (${engineName(alone.engine)}).`;
  return {
    bielikOne: null,
    bielikOnePlan: alone === null ? { mode: 'text-only' } : { mode: 'switching', choice: alone },
    decisionReason: `Bielik-One nie zmieści się na stałe obok modelu tekstowego: ${smallest.label} (${engineName(engine)}) z modelem ${model.label} ${model.quantization} potrzebuje około ${gbOneDecimal(need)} GB, a ${where} ${gbOneDecimal(budget)} GB. ${DECISION_FALLBACK}${threshold}${switching}`,
  };
}

/**
 * The largest Bielik-One package that fits here on its own, with the text model stopped: the
 * switching mode, and dev testing where the two do not fit together (pnpm ai:setup --with-bielik-one).
 */
export function bielikOneAlone(hardware: Hardware): BielikOneChoice | null {
  const engine = bielikOneEngine(hardware);
  if (!engine) return null;
  const budget = bielikOneBudgetMiB(hardware, engine);
  const pkg = BIELIK_ONE_BY_SIZE.find((candidate) => candidate.requiredMiB[engine] <= budget);
  return pkg ? { engine, package: pkg } : null;
}
