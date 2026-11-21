import { localMachine, readLlamaServerConfig } from '../src/index.ts';
import { devDataDir, writeAiEnv } from './dev-env.ts';

/**
 * Writes .env.ai.local for this worktree from the machine-wide AI setup, without downloading
 * anything and without starting the server. Models and llama.cpp live in the user data dir,
 * shared by all worktrees, so a new worktree only needs this file.
 */
async function main(): Promise<void> {
  const config = await readLlamaServerConfig(devDataDir(localMachine()));
  if (!config) {
    console.log(
      'AI is not set up on this machine yet. Run pnpm ai:setup once (downloads the model).',
    );
    return;
  }
  await writeAiEnv({ baseUrl: `http://127.0.0.1:${config.port}/v1`, model: config.alias });
  console.log(
    `Wrote .env.ai.local for ${config.alias}. Start the shared server with pnpm ai:start.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
