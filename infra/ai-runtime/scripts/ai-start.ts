import { writeFile } from 'node:fs/promises';
import {
  BIELIK_ONE_PACKAGES,
  isBielikOneReady,
  isLlamaServerReady,
  localMachine,
  readLlamaServerConfig,
  startBielikOne,
  startLlamaServer,
  type LlamaServerConfig,
} from '../src/index.ts';
import { parseOnly, planStart, type Endpoint } from './dev-plan.ts';
import {
  describeError,
  devBielikOneStateFile,
  devDataDir,
  devStateFile,
  readBielikOneConfig,
  writeAiEnv,
  type DevBielikOneConfig,
} from './dev-env.ts';

/**
 * Starts the shared local AI in the background: the text model, and Bielik-One where it fits
 * next to it. `--only text|decision` starts one of them (one at a time on a 16 GB Mac).
 */
async function main(): Promise<void> {
  const only = parseOnly(process.argv.slice(2));
  const machine = localMachine();
  const dataDir = devDataDir(machine);
  const text = await readLlamaServerConfig(dataDir);
  const decision = await readBielikOneConfig(dataDir);
  if (!text && only !== 'decision') {
    throw new Error('No llama-server configuration yet. Run pnpm ai:setup first.');
  }
  const textUrl = text ? `http://127.0.0.1:${text.port}/v1` : null;
  const running = new Set<Endpoint>();
  if (textUrl && (await isLlamaServerReady(textUrl))) running.add('text');
  if (decision && (await isBielikOneReady(decision.url))) running.add('decision');

  const plan = planStart(
    only,
    { installed: decision !== null, together: decision?.together ?? false },
    running,
  );
  if (plan.note) console.log(plan.note);
  for (const endpoint of plan.start) {
    if (running.has(endpoint)) {
      console.log(`${endpoint === 'text' ? 'llama-server' : 'Bielik-One'} is already running.`);
      continue;
    }
    if (endpoint === 'text' && text) await startText(text, dataDir);
    if (endpoint === 'decision' && decision) await startDecision(decision, dataDir);
    running.add(endpoint);
  }

  const envFile = await writeAiEnv({
    ...(text && textUrl && running.has('text')
      ? { text: { baseUrl: textUrl, model: text.alias } }
      : {}),
    ...(decision && running.has('decision') ? { decision: { baseUrl: `${decision.url}/v1` } } : {}),
  });
  console.log(`Wrote ${envFile} for: ${[...running].join(', ')}. Check with pnpm ai:smoke`);
}

async function startText(config: LlamaServerConfig, dataDir: string): Promise<void> {
  console.log(
    `Starting llama-server with ${config.alias} on ${config.device}, logs in ${config.logFile}`,
  );
  const server = await startLlamaServer(config, { detached: true });
  await writeFile(
    devStateFile(dataDir),
    `${JSON.stringify({ pid: server.pid, url: server.url })}\n`,
  );
  console.log(
    `llama-server is ready at ${server.url} (pid ${server.pid}). Stop it with pnpm ai:stop`,
  );
}

async function startDecision(config: DevBielikOneConfig, dataDir: string): Promise<void> {
  const pkg = BIELIK_ONE_PACKAGES[config.packageId];
  console.log(
    `Starting Bielik-One (${pkg.label}, ${config.engine}), logs in ${dataDir}/logs/bielik-one-*.log. Loading takes a few minutes.`,
  );
  const server = await startBielikOne(
    { engine: config.engine, executable: config.executable },
    pkg,
    { machine: localMachine(), dataDir },
    { detached: true },
  );
  await writeFile(
    devBielikOneStateFile(dataDir),
    `${JSON.stringify({ pids: server.pids, url: server.url })}\n`,
  );
  console.log(`Bielik-One is ready at ${server.url}/v1/systemone. Stop it with pnpm ai:stop`);
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exitCode = 1;
});
