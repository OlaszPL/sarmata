/** Where a step runs: the user's computer, or the host of the container engine (same computer or WSL). */
export type Target = 'system' | 'engine';

export type Action =
  | {
      readonly kind: 'run';
      readonly argv: readonly string[];
      readonly stdin?: string | undefined;
      /** Inherit the terminal: sudo and UAC prompts, long installs and builds with their own output. */
      readonly interactive?: boolean | undefined;
      /** A non-zero exit code does not fail the plan. */
      readonly allowFailure?: boolean | undefined;
    }
  | {
      readonly kind: 'write';
      readonly path: string;
      readonly content: string;
      readonly mode?: number | undefined;
    }
  | {
      readonly kind: 'copy';
      readonly from: string;
      readonly to: string;
      readonly mode?: number | undefined;
    }
  | { readonly kind: 'remove'; readonly path: string }
  | { readonly kind: 'rename'; readonly from: string; readonly to: string }
  | { readonly kind: 'halt'; readonly message: string };

export interface Step {
  /** Shown to the user, in Polish. */
  readonly title: string;
  readonly on: Target;
  readonly action: Action;
  /** Hides stdin and file content in the dry-run listing. */
  readonly sensitive?: boolean | undefined;
  /** Steps that revert this one, run in order when a later step fails. */
  readonly undo?: readonly Step[] | undefined;
}

/**
 * Steps run in order and roll back on failure. Cleanup runs only after every step succeeded: it
 * removes what the rollback would have needed, so it is never rolled back and its failures are
 * warnings (the commit point of an update).
 */
export interface Plan {
  readonly steps: readonly Step[];
  readonly cleanup?: readonly Step[] | undefined;
}

interface StepOptions {
  readonly sensitive?: boolean;
  readonly undo?: readonly Step[];
}

export function step(title: string, on: Target, action: Action, options: StepOptions = {}): Step {
  return { title, on, action, ...options };
}

interface RunActionOptions {
  readonly stdin?: string;
  readonly interactive?: boolean;
  readonly allowFailure?: boolean;
}

export function runAction(argv: readonly string[], options: RunActionOptions = {}): Action {
  return { kind: 'run', argv, ...options };
}

export function haltStep(message: string): Step {
  return step('Zatrzymanie kreatora', 'system', { kind: 'halt', message });
}

/** A plan that only stops with a message. */
export const haltPlan = (message: string): Plan => ({ steps: [haltStep(message)] });

/**
 * True when the step may write to the terminal while it runs: an interactive step, or sudo, which
 * asks for the password on the terminal once its timestamp expires during a long install.
 */
export function usesTerminal(current: Step): boolean {
  const action = current.action;
  return action.kind === 'run' && (action.interactive === true || action.argv[0] === 'sudo');
}

const TARGET_LABEL: Readonly<Record<Target, string>> = { system: 'system', engine: 'silnik' };
const quoteArg = (arg: string): string =>
  /^[\w@%+=:,./\\-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;

function describeAction(current: Step): string {
  const action = current.action;
  switch (action.kind) {
    case 'run': {
      const input =
        action.stdin === undefined
          ? ''
          : current.sensitive === true
            ? ' < (dane ukryte)'
            : ` < (${action.stdin.length} znaków)`;
      return `$ ${action.argv.map(quoteArg).join(' ')}${input}`;
    }
    case 'write':
      return `zapis ${action.path}${current.sensitive === true ? ' (treść ukryta)' : ` (${action.content.length} znaków)`}`;
    case 'copy':
      return `kopia ${action.from} -> ${action.to}`;
    case 'remove':
      return `usunięcie ${action.path}`;
    case 'rename':
      return `zmiana nazwy ${action.from} -> ${action.to}`;
    case 'halt':
      return `stop: ${action.message}`;
  }
}

const describeSteps = (steps: readonly Step[], first: number): string[] =>
  steps.map(
    (current, index) =>
      `${first + index}. [${TARGET_LABEL[current.on]}] ${current.title}\n   ${describeAction(current)}`,
  );

/** Numbered listing for --dry-run. Secrets in stdin and file content never appear. */
export function describePlan(plan: Plan): string {
  const cleanup = plan.cleanup ?? [];
  return [
    ...describeSteps(plan.steps, 1),
    ...(cleanup.length > 0
      ? [
          'Po udanym zakończeniu (błędy tylko ostrzegają):',
          ...describeSteps(cleanup, plan.steps.length + 1),
        ]
      : []),
  ].join('\n');
}
