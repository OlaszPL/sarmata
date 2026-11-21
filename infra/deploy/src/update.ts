import { win32 } from 'node:path';
import type { InstallConfig } from './config.ts';
import { binaryName, layout, samePath, toEnginePath, type Environment } from './environment.ts';
import { executePlan, type ExecutionEvent, type ExecutionResult, type Hosts } from './execute.ts';
import { runAction, step, type Plan } from './plan.ts';
import { planStageSource, planUpdate, type UpdateSource } from './plans.ts';
import type { Secrets } from './secrets.ts';

/**
 * Two-phase update. Phase one stages the new version as source.next with the running (installed)
 * command. Phase two must run the new version's own code, because the plan, compose.yaml and .env
 * it writes belong to that version: the running command hands over to the staged binary with
 * "update --staged", unless it already is the new version (install.sh update from the new package).
 */

export const UPSTREAM_COMPOSE = ['infra', 'deploy', 'supabase', 'docker-compose.yml'] as const;
const DIST = ['infra', 'deploy', 'dist'] as const;

export interface UpdateContext {
  readonly env: Environment;
  readonly hosts: Hosts;
  readonly onEvent?: (event: ExecutionEvent) => void;
}

export type StageOutcome =
  | { readonly kind: 'failed'; readonly result: ExecutionResult }
  /** The running binary is the new version: continue with applyStagedUpdate here. */
  | { readonly kind: 'continue'; readonly warning: string | null }
  /** Run this system-side binary with "update --staged". */
  | { readonly kind: 'handover'; readonly launcher: string };

/** The new version's binary for this system inside source.next, as the engine host sees it. */
const stagedBinary = (env: Environment): string => {
  const paths = layout(env);
  return paths.join(paths.sourceNext, ...DIST, binaryName(env.os, env.arch));
};

/**
 * Steps that make the staged binary runnable from the system side, and its path there. Windows
 * gets a copy next to the installed command: a running .exe locks its directory, and source.next
 * is renamed during the update. macOS needs the ad-hoc signature that install.sh also adds.
 */
export function handoverPlan(env: Environment): { plan: Plan; launcher: string } {
  const binary = stagedBinary(env);
  if (env.os === 'windows') {
    const launcher = win32.join(env.binDir, 'sarmata-next.exe');
    return {
      plan: {
        steps: [
          step('Przygotowanie kreatora nowej wersji', 'engine', {
            kind: 'copy',
            from: binary,
            to: toEnginePath(env, launcher),
            mode: 0o755,
          }),
        ],
      },
      launcher,
    };
  }
  const sign =
    env.os === 'macos'
      ? [
          step(
            'Podpis kreatora nowej wersji (macOS)',
            'system',
            runAction([
              'sh',
              '-c',
              'xattr -d com.apple.quarantine "$1" 2>/dev/null; codesign --verify "$1" 2>/dev/null || codesign --force --sign - "$1"',
              'sh',
              binary,
            ]),
          ),
        ]
      : [];
  return {
    plan: {
      steps: [
        step('Przygotowanie kreatora nowej wersji', 'engine', runAction(['chmod', '+x', binary])),
        ...sign,
      ],
    },
    launcher: binary,
  };
}

/** Phase one: stage the new version and decide which binary plans the update. */
export async function stageUpdate(ctx: UpdateContext, source: UpdateSource): Promise<StageOutcome> {
  const { env, hosts } = ctx;
  const staged = await executePlan(planStageSource(env, source), hosts, ctx.onEvent);
  if (staged.status !== 'ok') return { kind: 'failed', result: staged };
  if (source.kind === 'dir' && env.releaseDir !== null && samePath(source.path, env.releaseDir))
    return { kind: 'continue', warning: null };
  // Docker Desktop on Windows takes only unpacked releases (planStageSource), which have dist/.
  const dockerDesktop = env.os === 'windows' && env.engineHost === 'local';
  const found =
    dockerDesktop || (await hosts.engine.run('test', ['-f', stagedBinary(env)])).exitCode === 0;
  if (!found) {
    // A git checkout has no compiled installer (infra/deploy/dist is built by the release script).
    return {
      kind: 'continue',
      warning:
        'Nowa wersja nie zawiera skompilowanego kreatora (infra/deploy/dist), więc aktualizację zaplanuje bieżąca wersja kreatora.',
    };
  }
  const handover = handoverPlan(env);
  const prepared = await executePlan(handover.plan, hosts, ctx.onEvent);
  if (prepared.status !== 'ok') return { kind: 'failed', result: prepared };
  return { kind: 'handover', launcher: handover.launcher };
}

/** Phase one, last step: the staged binary takes over in this terminal. Returns its exit code. */
export async function handOver(ctx: UpdateContext, launcher: string): Promise<number> {
  const result = await ctx.hosts.system.run(launcher, ['update', '--staged'], {
    interactive: true,
    timeoutMs: null,
  });
  return result.exitCode ?? 1;
}

/**
 * The command to install after the update: the running binary when it is the new version. A
 * binary inside source.next is found under source/ once the update has swapped the directories.
 */
export function launcherAfterUpdate(env: Environment, runningIsNew: boolean): string | null {
  if (!runningIsNew) return null;
  const paths = layout(env);
  const exec = env.execPath.replaceAll('\\', '/');
  const next = paths.sourceNext.replaceAll('\\', '/');
  if (env.engineHost === 'local' && exec.startsWith(`${next}/`))
    return paths.join(paths.source, exec.slice(next.length + 1));
  return env.execPath;
}

export interface StagedUpdateInput {
  readonly config: InstallConfig;
  readonly secrets: Secrets;
  readonly stamp: string;
  /** False when an older binary plans the update (git source without a compiled installer). */
  readonly runningIsNew: boolean;
}

export type StagedUpdateResult =
  | { readonly kind: 'missing-compose' }
  | { readonly kind: 'executed'; readonly result: ExecutionResult };

/** Phase two: plan and run the update from source.next with the code of the running binary. */
export async function applyStagedUpdate(
  ctx: UpdateContext,
  input: StagedUpdateInput,
): Promise<StagedUpdateResult> {
  const { env, hosts } = ctx;
  const paths = layout(env);
  const upstream = await hosts.engine.readFile(paths.join(paths.sourceNext, ...UPSTREAM_COMPOSE));
  if (upstream === null) return { kind: 'missing-compose' };
  const version = (await hosts.engine.readFile(paths.join(paths.sourceNext, 'VERSION')))?.trim();
  const plan = planUpdate({
    env,
    config: input.config,
    secrets: input.secrets,
    upstreamCompose: upstream,
    newVersion: version === undefined || version === '' ? null : version,
    stamp: input.stamp,
    newLauncher: launcherAfterUpdate(env, input.runningIsNew),
  });
  return { kind: 'executed', result: await executePlan(plan, hosts, ctx.onEvent) };
}
