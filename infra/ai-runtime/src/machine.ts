import { execFile } from 'node:child_process';
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
  /** Kill the command after this time. Default: 10 minutes. */
  timeoutMs?: number;
}

/**
 * Seam between the runtime logic and the computer: platform facts and short commands whose
 * output is collected. Long-running servers do not go through it (see process.ts).
 */
export interface Machine {
  readonly os: OperatingSystem;
  readonly arch: Architecture;
  readonly totalMemoryBytes: number;
  run(command: string, args: readonly string[], options?: RunOptions): Promise<CommandResult>;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function currentOs(): OperatingSystem {
  const value = platform();
  if (value === 'darwin') return 'macos';
  if (value === 'win32') return 'windows';
  if (value === 'linux') return 'linux';
  throw new Error(`Unsupported platform: ${value}`);
}

function currentArch(): Architecture {
  const value = arch();
  if (value === 'arm64' || value === 'x64') return value;
  throw new Error(`Unsupported architecture: ${value}`);
}

/** Real adapter: the computer this process runs on. */
export function localMachine(): Machine {
  return {
    os: currentOs(),
    arch: currentArch(),
    totalMemoryBytes: totalmem(),
    run(command, args, options = {}) {
      return new Promise((resolve) => {
        execFile(
          command,
          [...args],
          {
            encoding: 'utf8',
            timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            maxBuffer: MAX_OUTPUT_BYTES,
            windowsHide: true,
          },
          (error, stdout, stderr) => {
            if (!error) {
              resolve({ exitCode: 0, stdout, stderr });
              return;
            }
            const code: unknown = (error as { code?: unknown }).code;
            resolve({
              exitCode: typeof code === 'number' ? code : null,
              stdout,
              stderr: stderr || error.message,
            });
          },
        );
      });
    },
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
