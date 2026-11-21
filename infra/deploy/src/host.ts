import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { dirname } from 'node:path';

export interface RunOptions {
  readonly stdin?: string | undefined;
  readonly interactive?: boolean | undefined;
}

export interface RunResult {
  /** 127 when the command does not exist. */
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Where plan steps run. Adapters: localHost (this computer), wslHost (a WSL distro on Windows)
 * and recordingHost in tests.
 */
export interface Host {
  run(argv: readonly string[], options?: RunOptions): Promise<RunResult>;
  /** Creates missing parent directories. */
  writeFile(path: string, content: string, mode?: number): Promise<void>;
  /** Null when the file does not exist. */
  readFile(path: string): Promise<string | null>;
  /** File or directory, replacing the target. */
  copy(from: string, to: string): Promise<void>;
  /** Recursive, no error when missing. */
  remove(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}

const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

function runLocal(argv: readonly string[], options: RunOptions): Promise<RunResult> {
  const [command, ...args] = argv;
  if (command === undefined) return Promise.reject(new Error('empty command'));
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: options.interactive === true ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      // wsl.exe prints UTF-16 unless told otherwise.
      env: { ...process.env, WSL_UTF8: '1' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      resolve({ code: 127, stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.stdin?.end(options.stdin ?? '');
  });
}

/** This computer, through Node APIs. */
export function localHost(): Host {
  return {
    run: (argv, options = {}) => runLocal(argv, options),
    writeFile: async (path, content, mode) => {
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.writeFile(path, content, mode === undefined ? {} : { mode });
      if (mode !== undefined && process.platform !== 'win32') await fs.chmod(path, mode);
    },
    readFile: async (path) => {
      try {
        return await fs.readFile(path, 'utf8');
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    copy: async (from, to) => {
      await fs.rm(to, { recursive: true, force: true });
      await fs.mkdir(dirname(to), { recursive: true });
      await fs.cp(from, to, { recursive: true });
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
export function wslHost(distro: string, system: Host): Host {
  const must = async (argv: readonly string[], options: RunOptions = {}): Promise<void> => {
    const result = await system.run(wslCommand(distro, argv), options);
    if (result.code !== 0)
      throw new Error(`${argv.join(' ')} failed in WSL: ${result.stderr.trim()}`);
  };
  return {
    run: (argv, options) => system.run(wslCommand(distro, argv), options),
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
        {
          stdin: content,
        },
      ),
    readFile: async (path) => {
      const result = await system.run(wslCommand(distro, ['cat', path]));
      return result.code === 0 ? result.stdout : null;
    },
    copy: (from, to) =>
      must([
        'sh',
        '-c',
        'rm -rf "$2" && mkdir -p "$(dirname "$2")" && cp -a "$1" "$2"',
        'sh',
        from,
        to,
      ]),
    remove: (path) => must(['rm', '-rf', path]),
    rename: (from, to) => must(['mv', '-T', from, to]),
  };
}
