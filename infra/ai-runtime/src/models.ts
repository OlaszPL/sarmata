export type ModelId =
  | 'bielik-4.5b-v3.0-q4_k_m'
  | 'bielik-4.5b-v3.0-q8_0'
  | 'bielik-11b-v3.1-q4_k_m'
  | 'bielik-11b-v3.1-q5_k_m'
  | 'bielik-11b-v3.1-q6_k'
  | 'bielik-11b-v3.1-q8_0';

/** One GGUF file of a Bielik model, pinned to a repository commit and a SHA-256. */
export interface ModelFile {
  id: ModelId;
  label: string;
  quantization: string;
  /** Model name in the OpenAI-compatible API (`--alias`), used as SARMATA_AI_TEXT_MODEL. */
  alias: string;
  repo: string;
  revision: string;
  file: string;
  url: string;
  sizeBytes: number;
  sha256: string;
}

interface ModelRepo {
  label: string;
  alias: string;
  repo: string;
  revision: string;
}

const BIELIK_11B: ModelRepo = {
  label: 'Bielik-11B-v3.1-Instruct',
  alias: 'bielik-11b-v3.1-instruct',
  repo: 'speakleash/Bielik-11B-v3.1-Instruct-GGUF',
  revision: '84799dfb90cb5f827ecc35f32166d0a139ceb59f',
};

const BIELIK_4_5B: ModelRepo = {
  label: 'Bielik-4.5B-v3.0-Instruct',
  alias: 'bielik-4.5b-v3.0-instruct',
  repo: 'speakleash/Bielik-4.5B-v3.0-Instruct-GGUF',
  revision: 'f9b3ef0abcc8c37136800c6c66b46d8d9ea60830',
};

/**
 * SpeakLeash publishes the 4.5B model only as Q8_0 and fp16. Q4_K_M comes from Second State
 * (LlamaEdge): a llama.cpp quantization of speakleash/Bielik-4.5B-v3.0-Instruct, Apache 2.0, pinned
 * by commit and SHA-256 like the official files (ADR 0005).
 */
const BIELIK_4_5B_Q4: ModelRepo = {
  ...BIELIK_4_5B,
  repo: 'second-state/Bielik-4.5B-v3.0-Instruct-GGUF',
  revision: '5ed9534f824c7c184c21320f4d339e75569d0987',
};

function gguf(
  model: ModelRepo,
  id: ModelId,
  quantization: string,
  file: string,
  sizeBytes: number,
  sha256: string,
): ModelFile {
  const url = `https://huggingface.co/${model.repo}/resolve/${model.revision}/${file}`;
  return { ...model, id, quantization, file, url, sizeBytes, sha256 };
}

/** Sizes and SHA-256 (`lfs.oid`) from https://huggingface.co/api/models/<repo>/tree/main, 21.11.2026. */
export const MODEL_FILES: Readonly<Record<ModelId, ModelFile>> = {
  'bielik-4.5b-v3.0-q4_k_m': gguf(
    BIELIK_4_5B_Q4,
    'bielik-4.5b-v3.0-q4_k_m',
    'Q4_K_M',
    'Bielik-4.5B-v3.0-Instruct-Q4_K_M.gguf',
    2_878_886_912,
    '39fb78db7c5e1582d3ef5bded109cd98606aabd5acbb5c98601155174b6763e1',
  ),
  'bielik-4.5b-v3.0-q8_0': gguf(
    BIELIK_4_5B,
    'bielik-4.5b-v3.0-q8_0',
    'Q8_0',
    'Bielik-4.5B-v3.0-Instruct.Q8_0.gguf',
    5_061_215_424,
    '77eafc61197b394566939c7963c66861bb284eec6b183c56f5e531116b724aa6',
  ),
  'bielik-11b-v3.1-q4_k_m': gguf(
    BIELIK_11B,
    'bielik-11b-v3.1-q4_k_m',
    'Q4_K_M',
    'Bielik-11B-v3.1-Instruct.Q4_K_M.gguf',
    6_724_115_232,
    '2b417a21c0e3dacf7e6e64c0aed4d18f43482f00a7f08e85915a9852b4d21d2a',
  ),
  'bielik-11b-v3.1-q5_k_m': gguf(
    BIELIK_11B,
    'bielik-11b-v3.1-q5_k_m',
    'Q5_K_M',
    'Bielik-11B-v3.1-Instruct.Q5_K_M.gguf',
    7_907_105_568,
    '7f210531763baf136628c02df6a64e57b5ac31962c418e920def0533e83fd1d8',
  ),
  'bielik-11b-v3.1-q6_k': gguf(
    BIELIK_11B,
    'bielik-11b-v3.1-q6_k',
    'Q6_K',
    'Bielik-11B-v3.1-Instruct.Q6_K.gguf',
    9_164_032_800,
    '292bab01830655ea8ac2416eb6bd84485df0e917e40d01d985574ba53f2d84a1',
  ),
  'bielik-11b-v3.1-q8_0': gguf(
    BIELIK_11B,
    'bielik-11b-v3.1-q8_0',
    'Q8_0',
    'Bielik-11B-v3.1-Instruct.Q8_0.gguf',
    11_868_875_552,
    '05872343e783322fa2b0fa92461ebef1031251c7372931059f478c761cc92dfc',
  ),
};

export type BielikOneEngine = 'vllm' | 'mlx';
export type BielikOnePackageId = 'bielik-one-11b-v3.1-r1-adapter' | 'bielik-one-4b-r1-adapter';

/** A Bielik-One adapter package (LoRA and decision heads over its unchanged base model). */
export interface BielikOnePackage {
  id: BielikOnePackageId;
  repo: string;
  revision: string;
  /** Port of `bielik-one frontend`, fixed by the launcher per package (backend runs one below). */
  port: number;
  /** Short name for installer messages. */
  label: string;
  /** GPU memory (vLLM, bfloat16) or unified memory (MLX) for base weights, adapter and cache. */
  requiredMiB: Readonly<Record<BielikOneEngine, number>>;
  /** First download: the package repository plus its base model (Hugging Face API sizes). */
  downloadBytes: number;
  /** The base model repository needs a Hugging Face account that accepted its terms. */
  gatedBase: boolean;
}

/**
 * Revisions and sizes from https://huggingface.co/api/models/<repo>, 21.11.2026. Both adapter repos
 * are ungated. The 4B base (Qwen/Qwen3.5-4B) is ungated, the 11B base
 * (speakleash/Bielik-11B-v3.1-Instruct) is gated with automatic approval, so it needs a token in
 * `<dataDir>/huggingface` (ADR 0005). requiredMiB follows the bielik-one README: about 30 GB in
 * bfloat16 for the 11B model on vLLM, 12 GB for the 4B model, and on MLX the bfloat16 weights (8.2
 * GiB for 4B, 20.8 GiB for 11B) with the LoRA and the MLX buffer cache.
 */
export const BIELIK_ONE_PACKAGES: Readonly<Record<BielikOnePackageId, BielikOnePackage>> = {
  'bielik-one-11b-v3.1-r1-adapter': {
    id: 'bielik-one-11b-v3.1-r1-adapter',
    repo: 'speakleash/Bielik-One-11B-v3.1-r1-Adapter',
    revision: 'e8ded5d3b6076ec82ca23d173e6e9460a7650580',
    port: 8026,
    label: 'Bielik-One 11B',
    requiredMiB: { vllm: 31 * 1024, mlx: 26 * 1024 },
    downloadBytes: 1_057_279_806 + 22_340_130_855,
    gatedBase: true,
  },
  'bielik-one-4b-r1-adapter': {
    id: 'bielik-one-4b-r1-adapter',
    repo: 'speakleash/Bielik-One-4B-r1-Adapter',
    revision: '9b543720409e112985bf977fb17a3dc91d845656',
    port: 8012,
    label: 'Bielik-One 4B',
    requiredMiB: { vllm: 13 * 1024, mlx: 9 * 1024 },
    downloadBytes: 766_633_209 + 9_342_907_469,
    gatedBase: false,
  },
};

/** bielik-one 1.2.0 has no PyPI release and no tags, so it is pinned to a commit of 17.11.2026. */
export const BIELIK_ONE_SOURCE = {
  repo: 'https://github.com/speakleash/bielik-one',
  commit: 'b92c1118d273a5fcdd3f556afbf077a7f5735892',
  python: '3.12',
} as const;
