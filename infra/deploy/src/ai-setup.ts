import { setTimeout as sleep } from 'node:timers/promises';
import {
  aiServicePlan,
  aiServiceRemovalPlan,
  aiUnsupportedReason,
  DECISION_SERVICES,
  TEXT_SERVICES,
  uvInstall,
  type ServiceCommand,
} from './ai.ts';
import type { AiSettings, EnabledAi } from './config.ts';
import type { Environment } from './environment.ts';
import { errorMessage, executePlan, type ExecutionEvent, type Hosts } from './execute.ts';
import type { Plan } from './plan.ts';

/** Downloads and installs the native runtimes. Real: ai.ts on @sarmata/ai-runtime, fakes in tests. */
export interface AiInstaller {
  text(ai: EnabledAi): Promise<ServiceCommand>;
  decision(ai: EnabledAi, uv: string): Promise<readonly ServiceCommand[]>;
}

/** Health checks of the registered services. */
export interface AiProbes {
  text(): Promise<boolean>;
  decision(port: number): Promise<boolean>;
}

export interface AiSetupDeps {
  readonly env: Environment;
  readonly hosts: Hosts;
  readonly dataDir: string;
  readonly installer: AiInstaller;
  readonly probes: AiProbes;
  /** Polls a probe until it says ready or the time is up. */
  readonly waitFor: (probe: () => Promise<boolean>, timeoutMs: number) => Promise<boolean>;
  readonly onEvent?: (event: ExecutionEvent) => void;
  /** User-facing progress of the long phases, in Polish. */
  readonly onStep?: (message: string) => void;
}

export interface AiSetupResult {
  /** Settings to write: enabled only with a healthy text runtime. */
  readonly ai: AiSettings;
  readonly warnings: readonly string[];
}

/** llama-server loads the model in a few minutes at most. */
export const TEXT_READY_MS = 10 * 60 * 1000;
/** The first Bielik-One start downloads its base model (tens of GB). */
export const DECISION_READY_MS = 60 * 60 * 1000;

/** Polls every two seconds. */
export async function pollUntil(
  probe: () => Promise<boolean>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return true;
    await sleep(2000);
  }
  return false;
}

const REPAIR = 'Moduł AI można doinstalować albo naprawić poleceniem: sarmata ai.';

async function run(plan: Plan, deps: AiSetupDeps): Promise<void> {
  const result = await executePlan(plan, deps.hosts, deps.onEvent);
  if (result.status === 'halted') throw new Error(result.message);
  if (result.status === 'failed') throw new Error(`${result.step}: ${result.message}`);
}

/** The uv command for Bielik-One: on PATH, installed earlier by us, or installed now. */
async function ensureUv(deps: AiSetupDeps): Promise<string> {
  const install = uvInstall(deps.env, deps.dataDir);
  for (const candidate of ['uv', install.command]) {
    const found = await deps.hosts.system.run(candidate, ['--version']);
    if (found.exitCode === 0) return candidate;
  }
  await run(install.plan, deps);
  return install.command;
}

/**
 * Installs and registers the text runtime first and enables AI only when it answers. Bielik-One
 * is optional: when it fails the text model stays on and decisions fall back to it (ADR 0005).
 * Nothing here fails the caller: problems become warnings and AI stays off.
 */
export async function setUpAi(deps: AiSetupDeps, wanted: EnabledAi): Promise<AiSetupResult> {
  const unsupported = aiUnsupportedReason(deps.env);
  if (unsupported !== null)
    return { ai: { enabled: false }, warnings: [`${unsupported} ${REPAIR}`] };

  try {
    deps.onStep?.('Instalacja modelu tekstowego (pobieranie może potrwać)');
    const llama = await deps.installer.text(wanted);
    await run(aiServicePlan(deps.env, [llama]), deps);
    deps.onStep?.('Oczekiwanie na model tekstowy');
    if (!(await deps.waitFor(() => deps.probes.text(), TEXT_READY_MS)))
      throw new Error(`llama-server nie odpowiada, dziennik: ${llama.logFile}`);
  } catch (error) {
    await executePlan(aiServiceRemovalPlan(deps.env, TEXT_SERVICES), deps.hosts, deps.onEvent);
    return {
      ai: { enabled: false },
      warnings: [`Aplikacja działa bez AI. Szczegóły: ${errorMessage(error)}. ${REPAIR}`],
    };
  }

  const text: EnabledAi = { ...wanted, decisionPort: null };
  const port = wanted.decisionPort;
  if (port === null) return { ai: text, warnings: [] };
  try {
    const uv = await ensureUv(deps);
    deps.onStep?.('Instalacja Bielik-One (vLLM albo MLX)');
    const services = await deps.installer.decision(wanted, uv);
    await run(aiServicePlan(deps.env, services), deps);
    deps.onStep?.('Bielik-One pobiera model bazowy i kalibruje się (do godziny)');
    if (!(await deps.waitFor(() => deps.probes.decision(port), DECISION_READY_MS)))
      throw new Error('Bielik-One nie odpowiada');
    return { ai: wanted, warnings: [] };
  } catch (error) {
    await executePlan(aiServiceRemovalPlan(deps.env, DECISION_SERVICES), deps.hosts, deps.onEvent);
    return {
      ai: text,
      warnings: [
        `Model tekstowy działa, Bielik-One nie: ${errorMessage(error)}. Decyzje podejmuje model tekstowy. ${REPAIR}`,
      ],
    };
  }
}
