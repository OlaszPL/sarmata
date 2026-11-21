import { localMachine, readLlamaServerConfig } from '../src/index.ts';
import { describeError, devDataDir, readBielikOneConfig, writeAiEnv } from './dev-env.ts';

/**
 * Writes .env.ai.local for this worktree from the machine-wide AI setup, without downloading
 * anything and without starting a server. Models, llama.cpp and the Hugging Face cache live in
 * the user data dir, shared by all worktrees, so a new worktree only needs this file. Bielik-One
 * is listed only where it runs next to the text model.
 */
async function main(): Promise<void> {
  const dataDir = devDataDir(localMachine());
  const config = await readLlamaServerConfig(dataDir);
  if (!config) {
    console.log(
      'AI is not set up on this machine yet. Run pnpm ai:setup once (downloads the model).',
    );
    return;
  }
  const decision = await readBielikOneConfig(dataDir);
  await writeAiEnv({
    text: { baseUrl: `http://127.0.0.1:${config.port}/v1`, model: config.alias },
    ...(decision?.together ? { decision: { baseUrl: `${decision.url}/v1` } } : {}),
  });
  console.log(
    `Wrote .env.ai.local for ${config.alias}. Start the shared server with pnpm ai:start.`,
  );
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exitCode = 1;
});
