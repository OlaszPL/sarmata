import {
  bielikOneAlone,
  detectHardware,
  installBielikOne,
  installLlamaCpp,
  LLAMA_CPP_RELEASE,
  localMachine,
  MODEL_FILES,
  prefetchBielikOne,
  prepareLlamaServer,
  recommendRuntime,
  type Hardware,
  type ModelId,
  type RuntimeContext,
  type RuntimeRecommendation,
} from '../src/index.ts';
import {
  DEV_PORT,
  describeError,
  devDataDir,
  printProgress,
  writeAiEnv,
  writeBielikOneConfig,
} from './dev-env.ts';

// Dev default: Bielik-11B Q4_K_M on Metal (a Mac with 16 GB). SARMATA_AI_MODEL picks another file.
const DEFAULT_DEV_MODEL: ModelId = 'bielik-11b-v3.1-q4_k_m';
const WITH_BIELIK_ONE = '--with-bielik-one';
const GB = 1000 ** 3;

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
  const unknown = process.argv.slice(2).filter((arg) => arg !== WITH_BIELIK_ONE);
  if (unknown.length > 0) throw new Error(`Unknown arguments: ${unknown.join(' ')}`);
  const withBielikOne = process.argv.includes(WITH_BIELIK_ONE);

  const model = MODEL_FILES[devModelId()];
  const machine = localMachine();
  const ctx: RuntimeContext = { machine, dataDir: devDataDir(machine), onProgress: printProgress };
  console.log(`AI data directory (one per user, shared by every worktree): ${ctx.dataDir}`);

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
  console.log(`Tier for this machine: ${recommendRuntime(hardware, 'standard').reason}`);
  const recommendation = recommendRuntime(hardware, 'standard', { model: model.id });
  console.log(`Dev model: ${model.label} ${model.quantization}`);
  console.log(`Bielik-One: ${recommendation.decisionReason}`);

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
  const text = { baseUrl: `http://127.0.0.1:${config.port}/v1`, model: config.alias };

  let decision: { url: string; together: boolean } | null = null;
  if (withBielikOne) {
    decision = await setUpBielikOne(hardware, recommendation, ctx);
  } else {
    console.log(
      `Bielik-One is not installed by default. Add it with: pnpm ai:setup ${WITH_BIELIK_ONE}`,
    );
  }
  const envFile = await writeAiEnv({
    text,
    ...(decision?.together ? { decision: { baseUrl: `${decision.url}/v1` } } : {}),
  });
  console.log(
    `Device: ${config.device}. Wrote SARMATA_AI_* settings to ${envFile}. Next: pnpm ai:start`,
  );
}

/**
 * Installs Bielik-One into the data directory and downloads its package and base model with
 * visible progress. Where it does not fit next to the text model it is still installed alone,
 * for testing one model at a time, with a warning.
 */
async function setUpBielikOne(
  hardware: Hardware,
  recommendation: RuntimeRecommendation,
  ctx: RuntimeContext,
): Promise<{ url: string; together: boolean }> {
  const together = recommendation.bielikOne !== null;
  const choice = recommendation.bielikOne ?? bielikOneAlone(hardware);
  if (!choice) {
    throw new Error(
      `Bielik-One nie uruchomi się na tym komputerze nawet bez modelu tekstowego. ${recommendation.decisionReason}`,
    );
  }
  const pkg = choice.package;
  if (!together) {
    console.warn(
      [
        `UWAGA: ${pkg.label} (${choice.engine.toUpperCase()}) i model tekstowy nie mieszczą się naraz w pamięci tego komputera.`,
        'Instaluję Bielik-One do testów, ale uruchamiaj modele pojedynczo:',
        '  pnpm ai:start --only text      (sam model tekstowy, domyślnie)',
        '  pnpm ai:stop && pnpm ai:start --only decision   (sam Bielik-One)',
        'W aplikacji decyzje podejmuje wtedy model tekstowy z wymuszonym formatem JSON.',
      ].join('\n'),
    );
  }
  console.log(
    `Bielik-One: ${pkg.label} (${pkg.repo}), first download about ${(pkg.downloadBytes / GB).toFixed(1)} GB into ${ctx.dataDir}/huggingface. Files already there are not downloaded again.`,
  );
  const install = await installBielikOne(choice.engine, ctx);
  await prefetchBielikOne(install, pkg, ctx);
  const url = `http://127.0.0.1:${pkg.port}`;
  await writeBielikOneConfig(ctx.dataDir, {
    engine: choice.engine,
    packageId: pkg.id,
    executable: install.executable,
    url,
    together,
  });
  return { url, together };
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exitCode = 1;
});
