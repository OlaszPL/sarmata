import { writeFile } from 'node:fs/promises';
import {
  isLlamaServerReady,
  localMachine,
  readLlamaServerConfig,
  startLlamaServer,
} from '../src/index.ts';
import { devDataDir, devStateFile, writeAiEnv } from './dev-env.ts';

async function main(): Promise<void> {
  const dataDir = devDataDir(localMachine());
  const config = await readLlamaServerConfig(dataDir);
  if (!config) throw new Error('No llama-server configuration yet. Run pnpm ai:setup first.');
  const url = `http://127.0.0.1:${config.port}/v1`;
  if (await isLlamaServerReady(url)) {
    console.log(`llama-server is already running at ${url}`);
  } else {
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
  await writeAiEnv({ baseUrl: url, model: config.alias });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
