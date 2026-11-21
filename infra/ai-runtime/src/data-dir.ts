import { posix, win32 } from 'node:path';
import type { OperatingSystem } from './machine.ts';

// An empty variable counts as unset, like in the XDG spec.
const nonEmpty = (value: string | undefined): string | undefined =>
  value === '' ? undefined : value;

/** Per-user application data directory for the AI runtime: binaries, models, logs, config. */
export function defaultDataDir(
  os: OperatingSystem,
  env: Readonly<Record<string, string | undefined>>,
  home: string,
): string {
  if (os === 'windows') {
    return win32.join(
      nonEmpty(env.LOCALAPPDATA) ?? win32.join(home, 'AppData', 'Local'),
      'sarmata',
      'ai',
    );
  }
  if (os === 'macos') return posix.join(home, 'Library', 'Application Support', 'sarmata', 'ai');
  return posix.join(
    nonEmpty(env.XDG_DATA_HOME) ?? posix.join(home, '.local', 'share'),
    'sarmata',
    'ai',
  );
}
