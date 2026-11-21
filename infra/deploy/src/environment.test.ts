import { describe, expect, it } from 'vitest';
import { detectEnvironment, type RunResult } from './index.ts';
import { recordingHost, type Call } from './test-support/recording-host.ts';

const scripted =
  (answers: Readonly<Record<string, Partial<RunResult>>>) =>
  (argv: readonly string[]): Partial<RunResult> =>
    answers[argv.join(' ')] ?? { code: 127 };

describe('detectEnvironment', () => {
  it('Ubuntu desktop without Docker', async () => {
    const calls: Call[] = [];
    const system = recordingHost({
      name: 'system',
      calls,
      files: {
        '/etc/os-release': 'NAME="Ubuntu"\nID=ubuntu\nID_LIKE=debian\nVERSION_CODENAME=noble\n',
      },
      respond: scripted({
        'id -un': { stdout: 'jan\n' },
        'id -gn': { stdout: 'jan\n' },
        'id -u': { stdout: '1000\n' },
        'xdg-user-dir DESKTOP': { stdout: '/home/jan/Pulpit\n' },
        'test -d /home/jan/Pulpit': {},
        'docker info': { code: 1 },
        'systemctl is-active --quiet docker': { code: 3 },
        'sh -c command -v docker': { code: 1 },
      }),
    });
    const env = await detectEnvironment(system, {
      platform: 'linux',
      arch: 'x64',
      execPath: '/home/jan/sarmata/infra/deploy/dist/sarmata-linux-x64',
      userHome: '/home/jan',
      env: {},
    });
    expect(env).toMatchObject({
      os: 'linux',
      engineHost: 'local',
      home: '/opt/sarmata',
      releaseDir: '/home/jan/sarmata',
      desktopDir: '/home/jan/Pulpit',
      user: { name: 'jan', group: 'jan', isRoot: false },
      linuxDistro: { family: 'apt', id: 'ubuntu' },
      engine: { state: 'missing', wsl: null },
      installed: false,
    });
  });

  it('Rocky Linux server as root with Docker running', async () => {
    const calls: Call[] = [];
    const system = recordingHost({
      name: 'system',
      calls,
      files: {
        '/etc/os-release': 'ID="rocky"\nID_LIKE="rhel centos fedora"\n',
        '/opt/sarmata/sarmata.json': '{}',
      },
      respond: scripted({
        'id -un': { stdout: 'root' },
        'id -gn': { stdout: 'root' },
        'id -u': { stdout: '0' },
        'docker info': {},
      }),
    });
    const env = await detectEnvironment(system, {
      platform: 'linux',
      arch: 'arm64',
      execPath: '/usr/local/bin/sarmata',
      userHome: '/root',
      env: {},
    });
    expect(env).toMatchObject({
      linuxDistro: { family: 'dnf', id: 'rhel' },
      engine: { state: 'ready', dockerPrefix: [] },
      desktopDir: null,
      releaseDir: null,
      installed: true,
    });
  });

  it('Windows without WSL goes to a WSL engine host', async () => {
    const calls: Call[] = [];
    const system = recordingHost({
      name: 'system',
      calls,
      respond: (argv) =>
        argv.join(' ').includes("GetFolderPath('Desktop')")
          ? { stdout: 'C:\\Users\\jan\\Desktop\r\n' }
          : { code: 1 },
    });
    const env = await detectEnvironment(system, {
      platform: 'win32',
      arch: 'x64',
      execPath: 'C:\\Users\\jan\\Downloads\\sarmata\\infra\\deploy\\dist\\sarmata-windows-x64.exe',
      userHome: 'C:\\Users\\jan',
      env: {
        USERPROFILE: 'C:\\Users\\jan',
        LOCALAPPDATA: 'C:\\Users\\jan\\AppData\\Local',
        USERNAME: 'jan',
      },
    });
    expect(env).toMatchObject({
      os: 'windows',
      engineHost: 'wsl',
      home: '/opt/sarmata',
      binDir: 'C:\\Users\\jan\\AppData\\Local\\Programs\\Sarmata',
      desktopDir: 'C:\\Users\\jan\\Desktop',
      releaseDir: 'C:\\Users\\jan\\Downloads\\sarmata',
      engine: { state: 'missing', wsl: 'missing' },
      installed: false,
    });
  });
});
