import { spawn } from 'node:child_process';
import { arch, platform, totalmem } from 'node:os';

export type OperatingSystem = 'macos' | 'linux' | 'windows';
export type Architecture = 'arm64' | 'x64';

/** Output of a finished command. `exitCode` is null when the command could not start or was killed. */
export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  /** Kill the command after this time. Default: 10 minutes. Null: no limit (image builds, installs). */
  timeoutMs?: number | null | undefined;
  /** Text written to the command's standard input. */
  stdin?: string | undefined;
  /**
   * Inherit the terminal: sudo and UAC prompts, long installs with their own output. stdout and
   * stderr of the result stay empty.
   */
  interactive?: boolean | undefined;
}

/**
 * Runs short commands and collects their output. The installer's file adapter (Host in
 * @sarmata/deploy) extends it too, so one adapter serves both packages.
 */
export interface CommandRunner {
  run(command: string, args: readonly string[], options?: RunOptions): Promise<CommandResult>;
}

/**
 * Seam between the runtime logic and the computer: platform facts and short commands whose
 * output is collected. Long-running servers do not go through it (see process.ts).
 */
export interface Machine extends CommandRunner {
  readonly os: OperatingSystem;
  readonly arch: Architecture;
  readonly totalMemoryBytes: number;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_CHARS = 64 * 1024 * 1024;

/** Maps a Node platform name to ours. */
export function operatingSystemOf(value: string): OperatingSystem {
  if (value === 'darwin') return 'macos';
  if (value === 'win32') return 'windows';
  if (value === 'linux') return 'linux';
  throw new Error(`Unsupported platform: ${value}`);
}

/** Maps a Node architecture name to ours. */
export function architectureOf(value: string): Architecture {
  if (value === 'arm64' || value === 'x64') return value;
  throw new Error(`Unsupported architecture: ${value}`);
}

function runCommand(
  command: string,
  args: readonly string[],
  options: RunOptions,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const interactive = options.interactive === true;
    const child = spawn(command, [...args], {
      stdio: interactive ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      // wsl.exe prints UTF-16 unless told otherwise.
      env: { ...process.env, WSL_UTF8: '1' },
      windowsHide: !interactive,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const limit = options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs;
    if (limit !== null) {
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish({ exitCode: null, stdout, stderr: `${stderr}\ntimed out after ${limit} ms` });
      }, limit);
    }
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      if (stdout.length < MAX_OUTPUT_CHARS) stdout += chunk;
    });
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      if (stderr.length < MAX_OUTPUT_CHARS) stderr += chunk;
    });
    child.on('error', (error) => {
      finish({ exitCode: null, stdout, stderr: stderr || error.message });
    });
    child.on('close', (code) => {
      finish({ exitCode: code, stdout, stderr });
    });
    // A command that exits before reading its input closes the pipe early: not an error here.
    child.stdin?.on('error', () => undefined);
    child.stdin?.end(options.stdin ?? '');
  });
}

/** Real adapter: the computer this process runs on. */
export function localMachine(): Machine {
  return {
    os: operatingSystemOf(platform()),
    arch: architectureOf(arch()),
    totalMemoryBytes: totalmem(),
    run: (command, args, options = {}) => runCommand(command, args, options),
  };
}

/** A canned answer, or a function of the arguments for commands whose output depends on them. */
export type FakeCommand = CommandResult | ((args: readonly string[]) => CommandResult);

export interface FakeMachineSpec {
  os: OperatingSystem;
  arch: Architecture;
  totalMemoryGiB: number;
  /** Answers keyed by the command exactly as the code runs it. Other commands do not start. */
  commands?: Readonly<Record<string, FakeCommand>>;
}

export interface FakeMachine extends Machine {
  /** Commands run so far, in order. */
  readonly calls: readonly { command: string; args: readonly string[] }[];
}

/** Test adapter: a scripted computer that records every command. */
export function fakeMachine(spec: FakeMachineSpec): FakeMachine {
  const calls: { command: string; args: readonly string[] }[] = [];
  return {
    os: spec.os,
    arch: spec.arch,
    totalMemoryBytes: spec.totalMemoryGiB * 1024 ** 3,
    calls,
    run(command, args) {
      calls.push({ command, args: [...args] });
      const answer = spec.commands?.[command];
      if (answer === undefined) {
        return Promise.resolve({
          exitCode: null,
          stdout: '',
          stderr: `${command}: command not found`,
        });
      }
      return Promise.resolve(typeof answer === 'function' ? answer(args) : answer);
    },
  };
}
