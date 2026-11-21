import { describe, expect, it } from 'vitest';
import type { CommandResult } from '@sarmata/ai-runtime';
import { detectEnvironment } from './index.ts';
import { recordingHost, type Call } from './test-support/recording-host.ts';

const scripted =
  (answers: Readonly<Record<string, Partial<CommandResult>>>) =>
  (argv: readonly string[]): Partial<CommandResult> =>
    answers[argv.join(' ')] ?? { exitCode: null };

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
        'docker info': { exitCode: 1 },
        'systemctl is-active --quiet docker': { exitCode: 3 },
        'sh -c command -v docker': { exitCode: 1 },
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
      conflictingPackages: [],
      engineTools: { unzip: false, git: false },
    });
  });

  it('RHEL without Docker: names the packages that block Docker Engine', async () => {
    const system = recordingHost({
      name: 'system',
      calls: [],
      files: { '/etc/os-release': 'ID="rhel"\n' },
      respond: scripted({
        'id -u': { stdout: '0' },
        'rpm -q podman': {},
        'rpm -q runc': { exitCode: 1 },
        'sh -c command -v unzip': {},
      }),
    });
    const env = await detectEnvironment(system, {
      platform: 'linux',
      arch: 'x64',
      execPath: '/root/sarmata/infra/deploy/dist/sarmata-linux-x64',
      userHome: '/root',
      env: {},
    });
    expect(env).toMatchObject({
      engine: { state: 'missing' },
      conflictingPackages: ['podman'],
      engineTools: { unzip: true, git: false },
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
        '/opt/sarmata/source/package.json': '{}',
        '/opt/sarmata/source/VERSION': '1.2.0\n',
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
      sourcePresent: true,
      installedVersion: '1.2.0',
    });
  });

  it('Windows without WSL goes to a WSL engine host', async () => {
    const calls: Call[] = [];
    const system = recordingHost({
      name: 'system',
      calls,
      respond: (argv) => {
        const line = argv.join(' ');
        if (line.includes("GetFolderPath('Desktop')"))
          return { stdout: 'C:\\Users\\jan\\Desktop\r\n' };
        if (line.includes('OSVersion.Version.Build')) return { stdout: '19045\r\n' };
        return { exitCode: 1 };
      },
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
      windowsBuild: 19045,
    });
  });

  it('Windows with Docker Desktop stopped still finds the installation', async () => {
    const system = recordingHost({
      name: 'system',
      calls: [],
      files: { 'C:\\ProgramData\\Sarmata\\sarmata.json': '{}' },
      respond: (argv) => (argv.join(' ').includes('Docker Desktop.exe') ? {} : { exitCode: 1 }),
    });
    const env = await detectEnvironment(system, {
      platform: 'win32',
      arch: 'x64',
      execPath: 'C:\\Users\\jan\\AppData\\Local\\Programs\\Sarmata\\sarmata.exe',
      userHome: 'C:\\Users\\jan',
      env: { ProgramData: 'C:\\ProgramData', USERNAME: 'jan' },
    });
    expect(env).toMatchObject({
      engineHost: 'local',
      home: 'C:\\ProgramData\\Sarmata',
      engine: { state: 'stopped', vendor: 'docker-desktop' },
      installed: true,
    });
  });

  it('macOS with Homebrew and no engine', async () => {
    const system = recordingHost({
      name: 'system',
      calls: [],
      files: { '/Users/jan/.docker/config.json': '{"auths":{}}' },
      respond: scripted({
        'brew --prefix': { stdout: '/opt/homebrew\n' },
        'id -un': { stdout: 'jan' },
      }),
    });
    const env = await detectEnvironment(system, {
      platform: 'darwin',
      arch: 'arm64',
      execPath: '/Users/jan/Downloads/sarmata/infra/deploy/dist/sarmata-macos-arm64',
      userHome: '/Users/jan',
      env: {},
    });
    expect(env).toMatchObject({
      os: 'macos',
      engine: { state: 'missing', wsl: null },
      brewPrefix: '/opt/homebrew',
      dockerCliConfig: '{"auths":{}}',
    });
  });

  it('rejects an unsupported platform', async () => {
    const system = recordingHost({ name: 'system', calls: [] });
    await expect(
      detectEnvironment(system, {
        platform: 'aix',
        arch: 'x64',
        execPath: '/x',
        userHome: '/',
        env: {},
      }),
    ).rejects.toThrow(/Unsupported platform/);
  });
});
