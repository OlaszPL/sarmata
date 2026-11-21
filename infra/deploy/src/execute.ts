import type { Host } from './host.ts';
import type { Plan, Step } from './plan.ts';

export interface Hosts {
  readonly system: Host;
  readonly engine: Host;
}

export type ExecutionEvent =
  | { readonly type: 'start'; readonly step: Step }
  | { readonly type: 'done'; readonly step: Step }
  | { readonly type: 'fail'; readonly step: Step; readonly message: string }
  | { readonly type: 'rollback'; readonly step: Step }
  | { readonly type: 'rollback-fail'; readonly step: Step; readonly message: string }
  | { readonly type: 'warning'; readonly step: Step; readonly message: string };

export type ExecutionResult =
  /** warnings: cleanup steps that failed after the plan was committed. */
  | { readonly status: 'ok'; readonly warnings: readonly string[] }
  | { readonly status: 'halted'; readonly message: string }
  | {
      readonly status: 'failed';
      readonly step: string;
      readonly message: string;
      /** Undo steps attempted. */
      readonly rolledBack: number;
      readonly rollbackErrors: readonly string[];
    };

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
const tail = (text: string): string => text.trim().split('\n').slice(-20).join('\n');

async function perform(current: Step, hosts: Hosts): Promise<void> {
  const host = hosts[current.on];
  const action = current.action;
  switch (action.kind) {
    case 'run': {
      const [command, ...args] = action.argv;
      if (command === undefined) throw new Error('empty command');
      // Plan steps include image builds and package installs: no time limit here.
      const result = await host.run(command, args, {
        stdin: action.stdin,
        interactive: action.interactive,
        timeoutMs: null,
      });
      if (result.exitCode !== 0 && action.allowFailure !== true) {
        throw new Error(
          `exit code ${String(result.exitCode ?? 'none')}: ${tail(result.stderr === '' ? result.stdout : result.stderr)}`,
        );
      }
      return;
    }
    case 'write':
      return host.writeFile(action.path, action.content, action.mode);
    case 'copy':
      return host.copy(action.from, action.to, action.mode);
    case 'remove':
      return host.remove(action.path);
    case 'rename':
      return host.rename(action.from, action.to);
    case 'halt':
      throw new Error('halt steps are handled by executePlan');
  }
}

async function rollBack(
  completed: readonly Step[],
  hosts: Hosts,
  onEvent: (event: ExecutionEvent) => void,
): Promise<{ rolledBack: number; rollbackErrors: string[] }> {
  let rolledBack = 0;
  const rollbackErrors: string[] = [];
  for (const done of [...completed].reverse()) {
    for (const undo of done.undo ?? []) {
      onEvent({ type: 'rollback', step: undo });
      rolledBack += 1;
      try {
        await perform(undo, hosts);
      } catch (error) {
        const message = errorMessage(error);
        rollbackErrors.push(`${undo.title}: ${message}`);
        onEvent({ type: 'rollback-fail', step: undo, message });
      }
    }
  }
  return { rolledBack, rollbackErrors };
}

async function runCleanup(
  cleanup: readonly Step[],
  hosts: Hosts,
  onEvent: (event: ExecutionEvent) => void,
): Promise<string[]> {
  const warnings: string[] = [];
  for (const current of cleanup) {
    onEvent({ type: 'start', step: current });
    try {
      await perform(current, hosts);
      onEvent({ type: 'done', step: current });
    } catch (error) {
      const message = errorMessage(error);
      warnings.push(`${current.title}: ${message}`);
      onEvent({ type: 'warning', step: current, message });
    }
  }
  return warnings;
}

/**
 * Runs the steps in order. A halt step ends the plan with its message. When a step fails, the undo
 * steps of the completed steps run in reverse order (the failed step's own undo does not). After
 * the last step the plan is committed: cleanup runs, never rolls back, and reports its failures as
 * warnings.
 */
export async function executePlan(
  plan: Plan,
  hosts: Hosts,
  onEvent: (event: ExecutionEvent) => void = () => undefined,
): Promise<ExecutionResult> {
  const completed: Step[] = [];
  for (const current of plan.steps) {
    if (current.action.kind === 'halt')
      return { status: 'halted', message: current.action.message };
    onEvent({ type: 'start', step: current });
    try {
      await perform(current, hosts);
    } catch (error) {
      const message = errorMessage(error);
      onEvent({ type: 'fail', step: current, message });
      return {
        status: 'failed',
        step: current.title,
        message,
        ...(await rollBack(completed, hosts, onEvent)),
      };
    }
    completed.push(current);
    onEvent({ type: 'done', step: current });
  }
  return { status: 'ok', warnings: await runCleanup(plan.cleanup ?? [], hosts, onEvent) };
}
