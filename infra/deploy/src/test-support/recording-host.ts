import type { CommandResult } from '@sarmata/ai-runtime';
import type { Host } from '../index.ts';

export interface Call {
  readonly host: string;
  readonly op: 'run' | 'write' | 'read' | 'copy' | 'remove' | 'rename';
  readonly args: readonly string[];
  readonly stdin?: string;
}

export interface RecordingHostOptions {
  readonly name: string;
  readonly calls: Call[];
  readonly respond?: (argv: readonly string[]) => Partial<CommandResult>;
  readonly files?: Readonly<Record<string, string>>;
}

/** Test adapter at the Host seam: records every operation and answers commands from a script. */
export function recordingHost({
  name,
  calls,
  respond = () => ({}),
  files = {},
}: RecordingHostOptions): Host {
  const stored = new Map(Object.entries(files));
  const record = (op: Call['op'], args: readonly string[], stdin?: string): void => {
    calls.push(stdin === undefined ? { host: name, op, args } : { host: name, op, args, stdin });
  };
  return {
    run: (command, args, options) => {
      const argv = [command, ...args];
      record('run', argv, options?.stdin);
      const result = respond(argv);
      return Promise.resolve({
        exitCode: result.exitCode === undefined ? 0 : result.exitCode,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      });
    },
    writeFile: (path, content) => {
      record('write', [path]);
      stored.set(path, content);
      return Promise.resolve();
    },
    readFile: (path) => {
      record('read', [path]);
      return Promise.resolve(stored.get(path) ?? null);
    },
    copy: (from, to) => {
      record('copy', [from, to]);
      return Promise.resolve();
    },
    remove: (path) => {
      record('remove', [path]);
      return Promise.resolve();
    },
    rename: (from, to) => {
      record('rename', [from, to]);
      return Promise.resolve();
    },
  };
}
