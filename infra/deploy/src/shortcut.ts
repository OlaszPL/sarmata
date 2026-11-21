import { posix, win32 } from 'node:path';
import { layout, type Environment } from './environment.ts';
import { runAction, step, type Step } from './plan.ts';

/** Files a shortcut creates (uninstall removes them) and the steps that create it. */
export interface Shortcut {
  readonly files: readonly string[];
  readonly steps: readonly Step[];
}

export const psQuote = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** cmd.exe /c strips the outer quotes, so the launcher path keeps its own (spaces in user names). */
export const windowsShortcutArguments = (launcher: string): string =>
  `/c ""${launcher}" start --open || pause"`;

/** A desktop shortcut that runs "sarmata start --open": starts the stack and opens the browser. */
export function desktopShortcut(env: Environment): Shortcut | null {
  if (env.desktopDir === null) return null;
  const launcher = layout(env).launcher;
  switch (env.os) {
    case 'windows': {
      const file = win32.join(env.desktopDir, 'Sarmata.lnk');
      // Through cmd.exe, so the window stays open with the message when start fails.
      const script = [
        `$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut(${psQuote(file)})`,
        '$shortcut.TargetPath = $env:ComSpec',
        `$shortcut.Arguments = ${psQuote(windowsShortcutArguments(launcher))}`,
        `$shortcut.WorkingDirectory = ${psQuote(env.binDir)}`,
        "$shortcut.Description = 'Sarmata: oceny okresowe'",
        '$shortcut.Save()',
      ].join('; ');
      return {
        files: [file],
        steps: [
          step(
            'Skrót na pulpicie',
            'system',
            runAction(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script]),
          ),
        ],
      };
    }
    case 'linux': {
      const entry = [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Sarmata',
        'Comment=Oceny okresowe w służbie cywilnej',
        `Exec="${launcher}" start --open`,
        'Terminal=true',
        'Icon=x-office-document',
        'Categories=Office;',
        '',
      ].join('\n');
      const desktopFile = posix.join(env.desktopDir, 'sarmata.desktop');
      const menuFile = posix.join(
        env.userHome,
        '.local',
        'share',
        'applications',
        'sarmata.desktop',
      );
      return {
        files: [desktopFile, menuFile],
        steps: [
          step('Skrót na pulpicie', 'system', {
            kind: 'write',
            path: desktopFile,
            content: entry,
            mode: 0o755,
          }),
          step('Skrót w menu aplikacji', 'system', {
            kind: 'write',
            path: menuFile,
            content: entry,
            mode: 0o644,
          }),
          // GNOME runs a .desktop file from the desktop only when it is marked as trusted.
          step(
            'Oznaczenie skrótu jako zaufanego',
            'system',
            runAction(['gio', 'set', desktopFile, 'metadata::trusted', 'true'], {
              allowFailure: true,
            }),
          ),
        ],
      };
    }
    case 'macos': {
      const file = posix.join(env.desktopDir, 'Sarmata.command');
      return {
        files: [file],
        steps: [
          step('Skrót na pulpicie', 'system', {
            kind: 'write',
            path: file,
            content: `#!/bin/sh\nexec "${launcher}" start --open\n`,
            mode: 0o755,
          }),
        ],
      };
    }
  }
}
