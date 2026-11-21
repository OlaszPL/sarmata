import { describe, expect, it } from 'vitest';
import {
  applyStagedUpdate,
  handoverPlan,
  launcherAfterUpdate,
  stageUpdate,
  type Environment,
  type Hosts,
} from './index.ts';
import {
  config,
  INSTALLED,
  linuxEnvironment,
  macEnvironment,
  secrets,
  upstreamCompose,
  windowsEnvironment,
} from './test-support/fixtures.ts';
import { recordingHost, type Call } from './test-support/recording-host.ts';

function hostsWith(
  calls: Call[],
  options: { binaryPresent?: boolean; files?: Readonly<Record<string, string>> } = {},
): Hosts {
  const host = recordingHost({
    name: 'host',
    calls,
    files: options.files ?? {},
    respond: (argv) =>
      argv[0] === 'test' && options.binaryPresent === false ? { exitCode: 1 } : {},
  });
  return { system: host, engine: host };
}

const linux = linuxEnvironment({
  ...INSTALLED,
  execPath: '/opt/sarmata/bin/sarmata',
  releaseDir: null,
});

describe('stageUpdate', () => {
  it('continues in this binary when it is the new version (install.sh update from the new package)', async () => {
    const env = linuxEnvironment(INSTALLED);
    const calls: Call[] = [];
    const outcome = await stageUpdate(
      { env, hosts: hostsWith(calls) },
      { kind: 'dir', path: '/home/jan/sarmata' },
    );
    expect(outcome).toEqual({ kind: 'continue', warning: null });
  });

  it('hands a zip update over to the staged binary of the new version', async () => {
    const calls: Call[] = [];
    const outcome = await stageUpdate(
      { env: linux, hosts: hostsWith(calls) },
      { kind: 'zip', path: '/home/jan/sarmata-1.1.0.zip' },
    );
    expect(outcome).toEqual({
      kind: 'handover',
      launcher: '/opt/sarmata/source.next/infra/deploy/dist/sarmata-linux-x64',
    });
    expect(calls.map((call) => call.args.join(' '))).toContain(
      'chmod +x /opt/sarmata/source.next/infra/deploy/dist/sarmata-linux-x64',
    );
  });

  it('continues with a warning when a git checkout has no compiled installer', async () => {
    const outcome = await stageUpdate(
      { env: linux, hosts: hostsWith([], { binaryPresent: false }) },
      { kind: 'git', url: 'https://example.test/sarmata.git', ref: 'v1.1.0' },
    );
    expect(outcome).toMatchObject({
      kind: 'continue',
      warning: expect.stringContaining('dist') as unknown,
    });
  });

  it('stops when staging fails', async () => {
    const outcome = await stageUpdate(
      { env: { ...linux, engineTools: { unzip: false, git: true } }, hosts: hostsWith([]) },
      { kind: 'zip', path: '/home/jan/sarmata-1.1.0.zip' },
    );
    expect(outcome).toMatchObject({ kind: 'failed', result: { status: 'halted' } });
  });
});

describe('handoverPlan', () => {
  it('Windows with WSL: copies the new .exe next to the installed command', () => {
    const { plan, launcher } = handoverPlan(windowsEnvironment(INSTALLED));
    expect(launcher).toBe('C:\\Users\\jan\\AppData\\Local\\Programs\\Sarmata\\sarmata-next.exe');
    expect(plan.steps[0]).toMatchObject({
      on: 'engine',
      action: {
        kind: 'run',
        argv: [
          'cp',
          '--',
          '/opt/sarmata/source.next/infra/deploy/dist/sarmata-windows-x64.exe',
          '/mnt/c/Users/jan/AppData/Local/Programs/Sarmata/sarmata-next.exe',
        ],
      },
    });
  });

  it('macOS: signs the staged binary like install.sh does', () => {
    const { plan } = handoverPlan(macEnvironment(INSTALLED));
    const sign = plan.steps[1]?.action;
    expect(sign?.kind === 'run' ? sign.argv[2] : '').toContain('codesign --force --sign -');
  });
});

describe('launcherAfterUpdate', () => {
  it('finds a binary from source.next under source after the swap', () => {
    const env: Environment = {
      ...linux,
      execPath: '/opt/sarmata/source.next/infra/deploy/dist/sarmata-linux-x64',
    };
    expect(launcherAfterUpdate(env, true)).toBe(
      '/opt/sarmata/source/infra/deploy/dist/sarmata-linux-x64',
    );
    expect(launcherAfterUpdate(env, false)).toBeNull();
    expect(launcherAfterUpdate(linuxEnvironment(INSTALLED), true)).toBe(
      '/home/jan/sarmata/infra/deploy/dist/sarmata-linux-x64',
    );
  });
});

describe('applyStagedUpdate', () => {
  it('plans with the staged compose file and version and runs the update', async () => {
    const calls: Call[] = [];
    const hosts = hostsWith(calls, {
      files: {
        '/opt/sarmata/source.next/infra/deploy/supabase/docker-compose.yml': upstreamCompose(),
        '/opt/sarmata/source.next/VERSION': '1.1.0\n',
      },
    });
    const outcome = await applyStagedUpdate(
      { env: linux, hosts },
      { config: config(), secrets: secrets(), stamp: '20261121-120000', runningIsNew: true },
    );
    expect(outcome).toMatchObject({ kind: 'executed', result: { status: 'ok' } });
    expect(calls.map((call) => call.args.join(' '))).toContain(
      'docker compose --project-directory /opt/sarmata -f /opt/sarmata/compose.yaml up -d --wait --wait-timeout 600 --remove-orphans',
    );
  });

  it('refuses a downgrade read from the staged VERSION', async () => {
    const hosts = hostsWith([], {
      files: {
        '/opt/sarmata/source.next/infra/deploy/supabase/docker-compose.yml': upstreamCompose(),
        '/opt/sarmata/source.next/VERSION': '0.9.0',
      },
    });
    const outcome = await applyStagedUpdate(
      { env: linux, hosts },
      { config: config(), secrets: secrets(), stamp: 'x', runningIsNew: true },
    );
    expect(outcome).toMatchObject({ kind: 'executed', result: { status: 'halted' } });
  });

  it('reports a staged version without the Supabase compose file', async () => {
    const outcome = await applyStagedUpdate(
      { env: linux, hosts: hostsWith([]) },
      { config: config(), secrets: secrets(), stamp: 'x', runningIsNew: true },
    );
    expect(outcome).toEqual({ kind: 'missing-compose' });
  });
});
