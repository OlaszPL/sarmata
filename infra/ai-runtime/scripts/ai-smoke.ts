import {
  localMachine,
  readLlamaServerConfig,
  smokeDecision,
  smokeText,
  type SmokeResult,
} from '../src/index.ts';
import { parseOnly } from './dev-plan.ts';
import { describeError, devDataDir, readBielikOneConfig } from './dev-env.ts';

function report(name: string, result: SmokeResult | string, start: string): void {
  if (typeof result === 'string') {
    console.log(`${name}: ${result}`);
    return;
  }
  if (result.status === 'ok') {
    console.log(`${name}: OK w ${result.latencyMs} ms. ${result.detail}`);
  } else if (result.status === 'not-running') {
    console.log(`${name}: nie działa (${result.detail}). Uruchom: ${start}`);
  } else {
    console.log(`${name}: BŁĄD, ${result.detail}`);
  }
}

/**
 * Checks each configured local AI endpoint on its own: a short Polish completion from the text
 * model and one yes/no question to Bielik-One. Fails when an endpoint that runs answers wrong, or
 * when none answers. Downloads and starts nothing.
 */
async function main(): Promise<void> {
  const only = parseOnly(process.argv.slice(2));
  const dataDir = devDataDir(localMachine());
  const results: SmokeResult[] = [];

  if (only !== 'decision') {
    const text = await readLlamaServerConfig(dataDir);
    if (text) {
      const result = await smokeText(`http://127.0.0.1:${text.port}/v1`, text.alias);
      results.push(result);
      report(`Model tekstowy (${text.alias})`, result, 'pnpm ai:start --only text');
    } else {
      report('Model tekstowy', 'nie zainstalowany. Najpierw: pnpm ai:setup', '');
    }
  }
  if (only !== 'text') {
    const decision = await readBielikOneConfig(dataDir);
    if (decision) {
      const result = await smokeDecision(decision.url);
      results.push(result);
      report(`Bielik-One (${decision.packageId})`, result, 'pnpm ai:start --only decision');
    } else {
      report('Bielik-One', 'nie zainstalowany. Opcjonalnie: pnpm ai:setup --with-bielik-one', '');
    }
  }

  const failed = results.some((result) => result.status === 'failed');
  const passed = results.some((result) => result.status === 'ok');
  if (failed || !passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exitCode = 1;
});
