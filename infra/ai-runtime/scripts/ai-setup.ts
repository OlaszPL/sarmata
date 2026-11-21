import {
  detectHardware,
  installLlamaCpp,
  LLAMA_CPP_RELEASE,
  localMachine,
  MODEL_FILES,
  prepareLlamaServer,
  recommendRuntime,
  type ModelId,
  type RuntimeContext,
} from '../src/index.ts';
import { DEV_PORT, describeError, devDataDir, printProgress, writeAiEnv } from './dev-env.ts';

// Dev default: Bielik-11B Q4_K_M on Metal (a Mac with 16 GB). SARMATA_AI_MODEL picks another file.
const DEFAULT_DEV_MODEL: ModelId = 'bielik-11b-v3.1-q4_k_m';

function devModelId(): ModelId {
  const requested = process.env.SARMATA_AI_MODEL ?? DEFAULT_DEV_MODEL;
  if (!(requested in MODEL_FILES)) {
    throw new Error(
      `Unknown SARMATA_AI_MODEL ${requested}, expected one of: ${Object.keys(MODEL_FILES).join(', ')}`,
    );
  }
  return requested as ModelId;
}

async function main(): Promise<void> {
  const model = MODEL_FILES[devModelId()];
  const machine = localMachine();
  const ctx: RuntimeContext = { machine, dataDir: devDataDir(machine), onProgress: printProgress };
  console.log(`AI data directory: ${ctx.dataDir}`);

  const bundle = recommendRuntime(await detectHardware(machine), 'standard').llamaCpp;
  console.log(
    `llama.cpp ${LLAMA_CPP_RELEASE.version} (${LLAMA_CPP_RELEASE.build}), backend ${bundle.backend}`,
  );
  const llama = await installLlamaCpp(bundle, ctx);

  const hardware = await detectHardware(machine, llama);
  const devices = hardware.devices.map(
    (device) => `${device.id} ${device.name} (${device.memoryMiB} MiB)`,
  );
  console.log(`Devices: ${devices.join(', ') || 'CPU only'}`);
  const recommendation = recommendRuntime(hardware, 'standard');
  console.log(`Tier for this machine: ${recommendation.reason}`);
  console.log(`Dev model: ${model.label} ${model.quantization}`);

  const { config, benchmark } = await prepareLlamaServer(
    { llama, hardware, model, port: DEV_PORT, ...recommendation.server },
    ctx,
  );
  if (benchmark) {
    const gpu = benchmark.gpu
      ? `${benchmark.gpu.generationTokensPerSecond.toFixed(1)} tok/s`
      : 'failed';
    console.log(
      `Benchmark: CPU ${benchmark.cpu.generationTokensPerSecond.toFixed(1)} tok/s, ${benchmark.gpuDevice} ${gpu}`,
    );
  }
  const envFile = await writeAiEnv({
    baseUrl: `http://127.0.0.1:${config.port}/v1`,
    model: config.alias,
  });
  console.log(
    `Device: ${config.device}. Wrote SARMATA_AI_* settings to ${envFile}. Next: pnpm ai:start`,
  );
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exitCode = 1;
});
