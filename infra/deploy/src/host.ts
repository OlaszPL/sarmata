import * as fs from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  localMachine,
  type CommandResult,
  type CommandRunner,
  type RunOptions,
} from '@sarmata/ai-runtime';

/**
 * Where plan steps run. It extends the command runner of @sarmata/ai-runtime, so the installer
 * builds one adapter and hands it to both packages. Adapters: localHost (this computer), wslHost
 * (a WSL distro on Windows) and recordingHost in tests.
 */
export interface Host extends CommandRunner {
  /** Creates missing parent directories. */
  writeFile(path: string, content: string, mode?: number): Promise<void>;
  /** Null when the file does not exist. */
  readFile(path: string): Promise<string | null>;
  /** File or directory, replacing the target. A mode applies to a copied file. */
  copy(from: string, to: string, mode?: number): Promise<void>;
  /** Recursive, no error when missing. */
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}

const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/** This computer: commands through the given runner (localMachine by default), files through Node. */
export function localHost(runner: CommandRunner = localMachine()): Host {
  const chmod = async (path: string, mode: number | undefined): Promise<void> => {
    // Windows has no POSIX modes. The installation directory gets an ACL instead (plans.ts).
    if (mode !== undefined && process.platform !== 'win32') await fs.chmod(path, mode);
  };
  return {
    run: (command, args, options) => runner.run(command, args, options),
    writeFile: async (path, content, mode) => {
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, content, mode === undefined ? {} : { mode });
      await chmod(path, mode);
    },
    readFile: async (path) => {
      try {
        return await fs.readFile(path, 'utf8');
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    copy: async (from, to, mode) => {
      await fs.rm(to, { recursive: true, force: true });
      await fs.mkdir(dirname(to), { recursive: true });
      await fs.cp(from, to, { recursive: true });
      await chmod(to, mode);
    },
    remove: (path) => fs.rm(path, { recursive: true, force: true }),
    rename: (from, to) => fs.rename(from, to),
  };
}

/** A command run as root inside a WSL distro, without a Windows or Linux shell in between. */
export function wslCommand(distro: string, argv: readonly string[]): string[] {
  return ['wsl.exe', '-d', distro, '-u', 'root', '--exec', ...argv];
}

/** The WSL distro with Docker Engine, reached from Windows through wsl.exe. */
export function wslHost(distro: string, system: CommandRunner): Host {
  const inDistro = (argv: readonly string[], options?: RunOptions): Promise<CommandResult> => {
    const [command, ...args] = wslCommand(distro, argv);
    return system.run(command ?? 'wsl.exe', args, options);
  };
  const must = async (argv: readonly string[], options: RunOptions = {}): Promise<void> => {
    const result = await inDistro(argv, options);
    if (result.exitCode !== 0)
      throw new Error(`${argv.join(' ')} failed in WSL: ${result.stderr.trim()}`);
  };
  return {
    run: (command, args, options) => inDistro([command, ...args], options),
    writeFile: (path, content, mode = 0o644) =>
      must(
        [
          'sh',
          '-c',
          'mkdir -p "$(dirname "$1")" && cat > "$1" && chmod "$2" "$1"',
          'sh',
          path,
          mode.toString(8),
        ],
        { stdin: content },
      ),
    readFile: async (path) => {
      const result = await inDistro(['cat', path]);
      return result.exitCode === 0 ? result.stdout : null;
    },
    copy: (from, to, mode) =>
      must([
        'sh',
        '-c',
        'rm -rf "$2" && mkdir -p "$(dirname "$2")" && cp -a "$1" "$2" && { [ -z "$3" ] || chmod "$3" "$2"; }',
        'sh',
        from,
        to,
        mode === undefined ? '' : mode.toString(8),
      ]),
    remove: (path) => must(['rm', '-rf', path]),
    rename: (from, to) => must(['mv', '-T', from, to]),
  };
}
