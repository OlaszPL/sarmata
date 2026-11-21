import { describe, expect, it } from 'vitest';
import { desktopShortcut, type Action } from './index.ts';
import { linuxEnvironment, macEnvironment, windowsEnvironment } from './test-support/fixtures.ts';

const lastArg = (action: Action | undefined): string =>
  action?.kind === 'run' ? (action.argv[action.argv.length - 1] ?? '') : '';

describe('desktopShortcut', () => {
  it('Windows: a .lnk made by PowerShell, apostrophes in paths doubled', () => {
    const shortcut = desktopShortcut(
      windowsEnvironment({
        desktopDir: "C:\\Users\\O'Brien\\Desktop",
        binDir: "C:\\Users\\O'Brien\\AppData\\Local\\Programs\\Sarmata",
      }),
    );
    expect(shortcut?.files).toEqual(["C:\\Users\\O'Brien\\Desktop\\Sarmata.lnk"]);
    const script = lastArg(shortcut?.steps[0]?.action);
    expect(script).toContain("CreateShortcut('C:\\Users\\O''Brien\\Desktop\\Sarmata.lnk')");
    // cmd.exe keeps the window open with the error when start fails.
    expect(script).toContain('$shortcut.TargetPath = $env:ComSpec');
    expect(script).toContain(
      '$shortcut.Arguments = \'/c ""C:\\Users\\O\'\'Brien\\AppData\\Local\\Programs\\Sarmata\\sarmata.exe" start --open || pause"\'',
    );
  });

  it('Linux: a .desktop file on the desktop and in the application menu', () => {
    const shortcut = desktopShortcut(linuxEnvironment());
    expect(shortcut?.files).toEqual([
      '/home/jan/Pulpit/sarmata.desktop',
      '/home/jan/.local/share/applications/sarmata.desktop',
    ]);
    const write = shortcut?.steps[0]?.action;
    expect(write).toMatchObject({ kind: 'write', mode: 0o755 });
    expect(write?.kind === 'write' ? write.content : '').toContain(
      'Exec="/opt/sarmata/bin/sarmata" start --open',
    );
  });

  it('macOS: an executable .command script on the desktop', () => {
    const shortcut = desktopShortcut(macEnvironment());
    expect(shortcut?.files).toEqual(['/Users/jan/Desktop/Sarmata.command']);
    expect(shortcut?.steps[0]?.action).toEqual({
      kind: 'write',
      path: '/Users/jan/Desktop/Sarmata.command',
      content: '#!/bin/sh\nexec "/Users/jan/Sarmata/bin/sarmata" start --open\n',
      mode: 0o755,
    });
  });

  it('gives no shortcut on a system without a desktop', () => {
    expect(desktopShortcut(linuxEnvironment({ desktopDir: null }))).toBeNull();
  });
});
