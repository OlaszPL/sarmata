/** Where a step runs: the user's computer, or the host of the container engine (same computer or WSL). */
export type Target = 'system' | 'engine';

export type Action =
  | {
      readonly kind: 'run';
      readonly argv: readonly string[];
      readonly stdin?: string | undefined;
      /** Inherit the terminal: sudo and UAC prompts, long installs with their own output. */
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
  | { readonly kind: 'copy'; readonly from: string; readonly to: string }
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

export interface Plan {
  readonly steps: readonly Step[];
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

/** Numbered listing for --dry-run. Secrets in stdin and file content never appear. */
export function describePlan(plan: Plan): string {
  return plan.steps
    .map(
      (current, index) =>
        `${index + 1}. [${TARGET_LABEL[current.on]}] ${current.title}\n   ${describeAction(current)}`,
    )
    .join('\n');
}
