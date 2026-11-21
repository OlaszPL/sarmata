import { describe, expect, it } from 'vitest';
import {
  compareVersions,
  describePlan,
  executePlan,
  planAiApply,
  planInstall,
  planRestore,
  planStageSource,
  planStart,
  planUninstall,
  planUpdate,
  type Environment,
  type InstallConfig,
  type Plan,
  type Step,
} from './index.ts';
import {
  config,
  INSTALLED,
  linuxEnvironment,
  macEnvironment,
  PROFILES,
  secrets,
  upstreamCompose,
  windowsEnvironment,
} from './test-support/fixtures.ts';
import { recordingHost, type Call } from './test-support/recording-host.ts';

const PASSWORD = 'Tajne-Haslo-2026';
const titles = (steps: readonly Step[]): string[] => steps.map((current) => current.title);
const argvOf = (current: Step | undefined): readonly string[] =>
  current?.action.kind === 'run' ? current.action.argv : [];
const byTitle = (plan: Plan, title: string): Step | undefined =>
  [...plan.steps, ...(plan.cleanup ?? [])].find((current) => current.title === title);
const haltMessage = (plan: Plan): string => {
  const last = plan.steps[plan.steps.length - 1];
  return last?.action.kind === 'halt' ? last.action.message : '';
};
const install = (env: Environment, settings: InstallConfig = config()): Plan =>
  planInstall({
    env,
    config: settings,
    secrets: secrets(),
    upstreamCompose: upstreamCompose(),
    adminPassword: PASSWORD,
  });
const update = (
  env: Environment,
  settings: InstallConfig = config(),
  newVersion: string | null = '1.1.0',
): Plan =>
  planUpdate({
    env,
    config: settings,
    secrets: secrets(),
    upstreamCompose: upstreamCompose(),
    newVersion,
    stamp: '20261121-120000',
    newLauncher: null,
  });
const installedMac = (overrides: Partial<Environment> = {}): Environment =>
  macEnvironment({ ...INSTALLED, ...overrides });

describe('planInstall', () => {
  it('macOS with a running engine: home, copy, files, build, database, admin, start, command, shortcut, sarmata.json last', () => {
    expect(titles(install(macEnvironment()).steps)).toEqual([
      'Przygotowanie katalogu /Users/jan/Sarmata (dostęp tylko dla właściciela)',
      'Kopiowanie plików aplikacji',
      'Zapis sekretów i ustawień usług (.env)',
      'Zapis definicji usług (compose.yaml)',
      'Budowanie obrazu sarmata/web:current ze źródeł (kilka minut)',
      'Budowanie obrazu sarmata/worker:current ze źródeł (kilka minut)',
      'Uruchamianie bazy danych',
      'Nakładanie migracji bazy',
      'Uruchamianie usługi logowania',
      'Zakładanie urzędu i konta administratora',
      'Uruchamianie wszystkich usług',
      'Instalacja polecenia sarmata',
      'Skrót na pulpicie',
      'Zapis ustawień instalacji (sarmata.json)',
    ]);
    expect(argvOf(install(macEnvironment()).steps[0])).toEqual([
      'install',
      '-d',
      '-m',
      '0700',
      '/Users/jan/Sarmata',
    ]);
  });

  it('passes the admin password only through stdin and hides it in the dry-run listing', () => {
    const plan = install(macEnvironment());
    const bootstrap = byTitle(plan, 'Zakładanie urzędu i konta administratora');
    expect(bootstrap?.sensitive).toBe(true);
    expect(bootstrap?.action.kind === 'run' ? bootstrap.action.stdin : '').toContain(PASSWORD);
    expect(argvOf(bootstrap).join(' ')).not.toContain(PASSWORD);
    expect(describePlan(plan)).not.toContain(PASSWORD);
  });

  it('builds interactively, so the build output and sudo prompts reach the terminal', () => {
    const build = byTitle(
      install(macEnvironment()),
      'Budowanie obrazu sarmata/web:current ze źródeł (kilka minut)',
    );
    expect(build?.action).toMatchObject({ kind: 'run', interactive: true });
  });

  it('writes AI as off: the native runtime is set up after the stack, then enabled', () => {
    const plan = install(macEnvironment(), PROFILES.withAi);
    const envFile = byTitle(plan, 'Zapis sekretów i ustawień usług (.env)');
    expect(envFile?.action.kind === 'write' ? envFile.action.content : '').toContain(
      "SARMATA_AI_ENABLED='false'",
    );
    const settings = byTitle(plan, 'Zapis ustawień instalacji (sarmata.json)');
    expect(settings?.action.kind === 'write' ? settings.action.content : '').toContain(
      '"enabled": false',
    );
  });

  it('Ubuntu without Docker: installs Docker Engine, adds the account to the docker group, owner-only home', () => {
    const plan = install(linuxEnvironment({ engine: { state: 'missing', wsl: null } }));
    const [docker, group, home] = plan.steps;
    expect(argvOf(docker).slice(0, 3)).toEqual(['sudo', 'sh', '-c']);
    expect(argvOf(docker)[3]).toContain('https://download.docker.com/linux/ubuntu');
    expect(argvOf(group)).toEqual(['sudo', 'usermod', '-aG', 'docker', 'jan']);
    expect(argvOf(home)).toEqual([
      'sudo',
      'install',
      '-d',
      '-m',
      '0750',
      '-o',
      'jan',
      '-g',
      'jan',
      '/opt/sarmata',
    ]);
    expect(argvOf(byTitle(plan, 'Nakładanie migracji bazy'))).toEqual([
      'sudo',
      'docker',
      'compose',
      '--project-directory',
      '/opt/sarmata',
      '-f',
      '/opt/sarmata/compose.yaml',
      '--profile',
      'tools',
      'run',
      '--rm',
      '--no-deps',
      '-T',
      'tools',
      'migrate',
    ]);
  });

  it('RHEL with podman: stops before Docker Engine with the packages to remove', () => {
    const plan = install(
      linuxEnvironment({
        linuxDistro: { family: 'dnf', id: 'rhel' },
        engine: { state: 'missing', wsl: null },
        conflictingPackages: ['podman', 'runc'],
      }),
    );
    expect(plan.steps).toHaveLength(1);
    expect(haltMessage(plan)).toContain('sudo dnf remove podman runc');
  });

  it('copies the office certificate key readable by the owner only', () => {
    const plan = install(
      linuxEnvironment(),
      config({
        ...PROFILES.server,
        tls: { mode: 'files', certPath: '/etc/ssl/oceny.pem', keyPath: '/etc/ssl/oceny.key' },
      }),
    );
    expect(byTitle(plan, 'Kopiowanie klucza certyfikatu urzędu')?.action).toEqual({
      kind: 'copy',
      from: '/etc/ssl/oceny.key',
      to: '/opt/sarmata/certs/key.pem',
      mode: 0o600,
    });
  });

  it('Windows with Docker Desktop: the ProgramData directory gets an owner-only ACL', () => {
    const env = windowsEnvironment({
      engineHost: 'local',
      home: 'C:\\ProgramData\\Sarmata',
      linuxDistro: null,
    });
    const script = argvOf(install(env).steps[0]).join(' ');
    expect(script).toContain("icacls 'C:\\ProgramData\\Sarmata' /inheritance:r");
    expect(script).toContain("'*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F'");
  });

  it('Windows without WSL: installs WSL2 and stops for a restart', () => {
    const plan = install(windowsEnvironment({ engine: { state: 'missing', wsl: 'missing' } }));
    expect(argvOf(plan.steps[0])).toEqual(['wsl.exe', '--install', '--no-distribution']);
    expect(haltMessage(plan)).toContain('Uruchom ponownie komputer');
    expect(plan.steps).toHaveLength(2);
  });

  it('Windows without the distro: WSL distro with Docker Engine, LAN settings, HTTPS ports, logon task', () => {
    const env = windowsEnvironment({
      engine: { state: 'missing', wsl: 'no-distro' },
      wslConfig: '[wsl2]\nmemory=8GB\n',
    });
    const plan = install(env, PROFILES.standard);
    expect(plan.steps[0]).toMatchObject({ on: 'system' });
    expect(argvOf(plan.steps[0])).toEqual([
      'wsl.exe',
      '--install',
      'Ubuntu-24.04',
      '--name',
      'sarmata',
      '--no-launch',
      '--web-download',
    ]);
    expect(byTitle(plan, 'Włączenie systemd w dystrybucji')).toMatchObject({
      on: 'engine',
      action: { kind: 'write', path: '/etc/wsl.conf' },
    });
    expect(byTitle(plan, 'Ustawienia WSL (praca w tle, sieć)')?.action).toEqual({
      kind: 'write',
      path: 'C:\\Users\\jan\\.wslconfig',
      content: '[wsl2]\nmemory=8GB\nnetworkingMode=mirrored\n\n[general]\ninstanceIdleTimeout=-1\n',
    });
    expect(argvOf(byTitle(plan, 'Ponowne uruchomienie WSL z nowymi ustawieniami'))).toEqual([
      'wsl.exe',
      '--shutdown',
    ]);
    const docker = byTitle(plan, 'Instalacja Docker Engine z oficjalnego repozytorium Dockera');
    expect(docker?.on).toBe('engine');
    expect(argvOf(docker).slice(0, 2)).toEqual(['sh', '-c']);
    const firewall = byTitle(plan, 'Reguła zapory Hyper-V dla dostępu z sieci urzędu');
    expect(firewall?.on).toBe('system');
    const encoded = /'-EncodedCommand','([^']+)'/.exec(argvOf(firewall).join(' '))?.[1] ?? '';
    expect(Buffer.from(encoded, 'base64').toString('utf16le')).toContain('-LocalPorts 80,443');
    expect(argvOf(byTitle(plan, 'Uruchamianie WSL po zalogowaniu')).join(' ')).toContain('wsl.exe');
    expect(byTitle(plan, 'Kopiowanie plików aplikacji')?.action).toEqual({
      kind: 'copy',
      from: '/mnt/c/Users/jan/Downloads/sarmata',
      to: '/opt/sarmata/source',
    });
    expect(byTitle(plan, 'Instalacja polecenia sarmata')?.action).toMatchObject({
      kind: 'copy',
      from: env.execPath,
      to: 'C:\\Users\\jan\\AppData\\Local\\Programs\\Sarmata\\sarmata.exe',
    });
  });

  it('Windows 10 with WSL: stops before LAN access, which needs mirrored networking', () => {
    const plan = install(windowsEnvironment({ windowsBuild: 19045 }), PROFILES.standard);
    expect(plan.steps).toHaveLength(1);
    expect(haltMessage(plan)).toContain('Windows 11 22H2');
    expect(install(windowsEnvironment({ windowsBuild: 19045 })).steps.length).toBeGreaterThan(1);
  });

  it('Windows with a ready WSL engine waits for Docker after restarting WSL', () => {
    const plan = install(windowsEnvironment({ wslConfig: null }));
    expect(titles(plan.steps).slice(0, 3)).toEqual([
      'Ustawienia WSL (praca w tle, sieć)',
      'Ponowne uruchomienie WSL z nowymi ustawieniami',
      'Oczekiwanie na Docker Engine w WSL',
    ]);
  });

  it('macOS without an engine: Colima from Homebrew with compose and buildx, sized by the profile', () => {
    const plan = install(
      macEnvironment({ engine: { state: 'missing', wsl: null }, dockerCliConfig: '{"auths":{}}' }),
    );
    expect(argvOf(plan.steps[0])).toEqual([
      'brew',
      'install',
      'colima',
      'docker',
      'docker-compose',
      'docker-buildx',
    ]);
    expect(plan.steps[1]?.action).toEqual({
      kind: 'write',
      path: '/Users/jan/.docker/config.json',
      content: `${JSON.stringify(
        { auths: {}, cliPluginsExtraDirs: ['/opt/homebrew/lib/docker/cli-plugins'] },
        null,
        2,
      )}\n`,
    });
    expect(argvOf(plan.steps[2])).toEqual(['colima', 'start', '--cpu', '2', '--memory', '4']);
  });

  it('macOS without an engine and without Homebrew: stops with instructions', () => {
    const plan = install(
      macEnvironment({ engine: { state: 'missing', wsl: null }, brewPrefix: null }),
    );
    expect(plan.steps).toHaveLength(1);
    expect(haltMessage(plan)).toContain('Homebrew');
  });

  it('server with an external Supabase: no local database, Caddy with its root certificate', () => {
    const external = config({
      ...PROFILES.server,
      supabase: { mode: 'external', url: 'https://abc.supabase.co' },
      shortcut: false,
    });
    const steps = titles(install(linuxEnvironment(), external).steps);
    expect(steps).not.toContain('Uruchamianie bazy danych');
    expect(steps).not.toContain('Uruchamianie usługi logowania');
    expect(steps).toContain('Zapis konfiguracji Caddy');
    expect(steps).toContain('Oczekiwanie na certyfikat Caddy');
  });

  it('stops when Sarmata is already installed', () => {
    expect(install(installedMac()).steps[0]?.action.kind).toBe('halt');
  });
});

describe('planStageSource', () => {
  it('clones a tag with -- before the URL', () => {
    const plan = planStageSource(installedMac(), {
      kind: 'git',
      url: 'https://example.test/sarmata.git',
      ref: 'v1.1.0',
    });
    expect(argvOf(plan.steps[1])).toEqual([
      'git',
      'clone',
      '--depth',
      '1',
      '--branch',
      'v1.1.0',
      '--',
      'https://example.test/sarmata.git',
      '/Users/jan/Sarmata/source.next',
    ]);
  });

  it('stops with the install command when unzip is missing', () => {
    const plan = planStageSource(
      linuxEnvironment({ ...INSTALLED, engineTools: { unzip: false, git: true } }),
      { kind: 'zip', path: '/home/jan/sarmata-1.1.0.zip' },
    );
    expect(haltMessage(plan)).toContain('sudo apt install unzip');
  });
});

describe('planUpdate', () => {
  it('builds next to the running version, dumps, snapshots, swaps, and cleans up after the commit', () => {
    const plan = update(installedMac());
    expect(titles(plan.steps)).toEqual([
      'Sprawdzenie wolnego miejsca (co najmniej 10 GB)',
      'Usunięcie pozostałości poprzedniej aktualizacji',
      'Budowanie obrazu sarmata/web:candidate ze źródeł (kilka minut)',
      'Budowanie obrazu sarmata/worker:candidate ze źródeł (kilka minut)',
      'Uruchamianie bazy danych',
      'Kopia bazy przed aktualizacją (pg_dump)',
      'Zatrzymanie usług',
      'Migawka danych bazy do wycofania',
      'Odłożenie bieżącej wersji plików',
      'Włączenie nowej wersji plików',
      'Odłożenie bieżącego compose.yaml',
      'Odłożenie bieżącego .env',
      'Zapis sekretów i ustawień usług (.env)',
      'Zapis definicji usług (compose.yaml)',
      'Zapis ustawień instalacji (sarmata.json)',
      'Oznaczenie obrazu sarmata/web:current jako previous',
      'Przełączenie obrazu sarmata/web na nową wersję',
      'Oznaczenie obrazu sarmata/worker:current jako previous',
      'Przełączenie obrazu sarmata/worker na nową wersję',
      'Uruchamianie bazy danych',
      'Nakładanie migracji bazy',
      'Uruchamianie nowej wersji',
    ]);
    expect(titles(plan.cleanup ?? [])).toEqual([
      'Usuwanie poprzedniej wersji plików',
      'Usuwanie poprzedniego compose.yaml',
      'Usuwanie poprzedniego .env',
      'Usuwanie tagu sarmata/web:candidate',
      'Usuwanie tagu sarmata/worker:candidate',
      'Czyszczenie migawki danych bazy',
      'Porządkowanie starych kopii bazy',
    ]);
  });

  it('checks free space in the installation and in the Docker data root', () => {
    const check = update(linuxEnvironment(INSTALLED)).steps.find((current) =>
      current.title.startsWith('Sprawdzenie wolnego miejsca'),
    );
    expect(argvOf(check).slice(-3)).toEqual([
      String(10 * 1024 * 1024),
      '/opt/sarmata',
      '/var/lib/docker',
    ]);
  });

  it('rolls back images, files and database when the new version does not start', async () => {
    const calls: Call[] = [];
    const host = recordingHost({
      name: 'mac',
      calls,
      respond: (argv) =>
        argv.includes('--remove-orphans') ? { exitCode: 1, stderr: 'web is unhealthy' } : {},
    });
    const undone: string[] = [];
    const result = await executePlan(
      update(installedMac()),
      { system: host, engine: host },
      (event) => {
        if (event.type === 'rollback') undone.push(event.step.title);
      },
    );
    expect(result).toMatchObject({
      status: 'failed',
      step: 'Uruchamianie nowej wersji',
      rollbackErrors: [],
    });
    expect(undone).toEqual([
      'Przywrócenie poprzedniego obrazu sarmata/worker',
      'Przywrócenie poprzedniego obrazu sarmata/web',
      'Przywrócenie .env',
      'Przywrócenie compose.yaml',
      'Odsunięcie nieudanej wersji plików',
      'Przywrócenie poprzedniej wersji plików',
      'Zatrzymanie usług przed odtworzeniem bazy',
      'Odtworzenie danych bazy z migawki',
      'Ponowne uruchomienie poprzedniej wersji',
      'Usuwanie obrazu sarmata/worker:candidate',
      'Usuwanie obrazu sarmata/web:candidate',
    ]);
    expect(calls.some((call) => call.args.includes('prune-dumps'))).toBe(false);
  });

  it('a cleanup failure after the new version runs is a warning, never a rollback', async () => {
    const calls: Call[] = [];
    const host = recordingHost({
      name: 'mac',
      calls,
      respond: (argv) => (argv.includes('prune-dumps') ? { exitCode: 1, stderr: 'disk full' } : {}),
    });
    const events: string[] = [];
    const result = await executePlan(
      update(installedMac()),
      { system: host, engine: host },
      (event) => {
        events.push(event.type);
      },
    );
    expect(result).toEqual({
      status: 'ok',
      warnings: ['Porządkowanie starych kopii bazy: exit code 1: disk full'],
    });
    expect(events).not.toContain('rollback');
  });

  it('external Supabase: dumps after stopping the app and restores the dump when the update fails', async () => {
    const external = config({ supabase: { mode: 'external', url: 'https://abc.supabase.co' } });
    const plan = update(installedMac(), external);
    expect(titles(plan.steps).slice(4, 6)).toEqual([
      'Zatrzymanie usług',
      'Kopia bazy przed aktualizacją (pg_dump)',
    ]);
    const calls: Call[] = [];
    const host = recordingHost({
      name: 'mac',
      calls,
      respond: (argv) =>
        argv.includes('migrate') ? { exitCode: 1, stderr: 'migration failed' } : {},
    });
    const undone: string[] = [];
    await executePlan(plan, { system: host, engine: host }, (event) => {
      if (event.type === 'rollback') undone.push(event.step.title);
    });
    expect(undone.slice(-4)).toEqual([
      'Odtworzenie bazy z kopii sprzed aktualizacji',
      'Ponowne uruchomienie poprzedniej wersji',
      'Usuwanie obrazu sarmata/worker:candidate',
      'Usuwanie obrazu sarmata/web:candidate',
    ]);
    expect(calls.map((call) => call.args.join(' '))).toContain(
      'docker compose --project-directory /Users/jan/Sarmata -f /Users/jan/Sarmata/compose.yaml --profile tools run --rm --no-deps -T tools restore pre-update-20261121-120000.dump',
    );
  });

  it('stops when the source directory is missing after an interrupted rollback', () => {
    const plan = update(installedMac({ sourcePresent: false }));
    expect(plan.steps).toHaveLength(1);
    expect(haltMessage(plan)).toContain('source.previous');
  });

  it('refuses to go back to an older version', () => {
    expect(
      haltMessage(update(installedMac({ installedVersion: '1.2.0' }), config(), '1.1.0')),
    ).toContain('nowsza niż 1.1.0');
    expect(
      update(installedMac({ installedVersion: '1.2.0' }), config(), null).steps.length,
    ).toBeGreaterThan(1);
  });

  it('on Windows renames the running launcher before copying the new one', () => {
    const plan = planUpdate({
      env: windowsEnvironment(INSTALLED),
      config: config(),
      secrets: secrets(),
      upstreamCompose: upstreamCompose(),
      newVersion: '1.1.0',
      stamp: '20261121-120000',
      newLauncher: 'C:\\Users\\jan\\AppData\\Local\\Programs\\Sarmata\\sarmata-next.exe',
    });
    expect(titles(plan.cleanup ?? []).slice(-3)).toEqual([
      'Usunięcie starego polecenia sarmata',
      'Odsunięcie działającego polecenia sarmata',
      'Instalacja polecenia sarmata',
    ]);
  });
});

describe('compareVersions', () => {
  it.each([
    ['1.10.0', '1.2.0', 1],
    ['1.2.0', '1.2.0', 0],
    ['1.2', '1.2.1', -1],
    ['2026.11.1', '2026.2.9', 1],
  ] as const)('%s against %s', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });
});

describe('planAiApply', () => {
  it('writes the AI settings, restarts the app and restores the old files when it does not start', async () => {
    const plan = planAiApply({
      env: linuxEnvironment(INSTALLED),
      config: PROFILES.withAi,
      previous: { ...PROFILES.withAi, ai: { enabled: false } },
      secrets: secrets(),
      upstreamCompose: upstreamCompose(),
    });
    const envFile = byTitle(plan, 'Zapis sekretów i ustawień usług (.env)');
    expect(envFile?.action.kind === 'write' ? envFile.action.content : '').toContain(
      "SARMATA_AI_ENABLED='true'",
    );
    const compose = byTitle(plan, 'Zapis definicji usług (compose.yaml)');
    expect(compose?.action.kind === 'write' ? compose.action.content : '').toContain('ai-relay');
    let starts = 0;
    const host = recordingHost({
      name: 'linux',
      calls: [],
      // The new settings do not start, the old ones do.
      respond: (argv) =>
        argv.includes('--remove-orphans') && starts++ === 0 ? { exitCode: 1 } : {},
    });
    const undone: string[] = [];
    await executePlan(plan, { system: host, engine: host }, (event) => {
      if (event.type === 'rollback') undone.push(event.step.title);
    });
    expect(undone).toEqual([
      'Przywrócenie sarmata.json',
      'Przywrócenie compose.yaml',
      'Przywrócenie .env',
      'Ponowne uruchomienie z poprzednimi ustawieniami',
    ]);
  });
});

describe('planStart, planRestore and planUninstall', () => {
  it('start --open on Windows: compose in WSL, browser on Windows', () => {
    const plan = planStart(windowsEnvironment(INSTALLED), config(), { open: true });
    expect(plan.steps.map((current) => [current.on, argvOf(current)[0]])).toEqual([
      ['engine', 'docker'],
      ['system', 'rundll32.exe'],
    ]);
    expect(argvOf(plan.steps[1])).toEqual([
      'rundll32.exe',
      'url.dll,FileProtocolHandler',
      'http://localhost:3000',
    ]);
  });

  it('restore: a safety dump, the app stopped, the restore, migrations and a start', () => {
    const plan = planRestore(installedMac(), config(), {
      file: 'nightly-20261120-020000.dump',
      stamp: '20261121-120000',
    });
    expect(titles(plan.steps)).toEqual([
      'Uruchamianie bazy danych',
      'Kopia bazy przed odtworzeniem (pg_dump)',
      'Zatrzymanie aplikacji',
      'Odtworzenie bazy z nightly-20261120-020000.dump',
      'Nakładanie migracji bazy',
      'Uruchamianie Sarmaty',
    ]);
    expect(argvOf(plan.steps[3]).slice(-2)).toEqual(['restore', 'nightly-20261120-020000.dump']);
  });

  it('restore takes only a file name from backups', () => {
    const plan = planRestore(installedMac(), config(), { file: '../.env', stamp: 'x' });
    expect(haltMessage(plan)).toContain('backups');
  });

  it('uninstall keeps a final dump and the keys a restore needs, unless purged', () => {
    const env = installedMac();
    const server = config({ ...PROFILES.server });
    const keep = planUninstall(env, server, { purge: false, stamp: '20261121-120000' });
    expect(titles(keep.steps)).toContain('Końcowa kopia bazy (pg_dump)');
    expect(argvOf(byTitle(keep, 'Kopia klucza pgsodium (Supabase Vault)')).slice(-2)).toEqual([
      'db:/etc/postgresql-custom/pgsodium_root.key',
      '/Users/jan/Sarmata/backups/pgsodium_root.key-20261121-120000',
    ]);
    expect(titles(keep.steps)).toContain('Kopia urzędu certyfikacji Caddy');
    expect(titles(keep.steps)).not.toContain('Usunięcie katalogu instalacji');
    const purge = titles(
      planUninstall(env, server, { purge: true, stamp: '20261121-120000' }).steps,
    );
    expect(purge).toContain('Usunięcie katalogu instalacji');
    expect(purge).not.toContain('Końcowa kopia bazy (pg_dump)');
  });

  it('uninstall on Windows with WSL removes the logon task and the firewall rule', () => {
    const steps = titles(
      planUninstall(windowsEnvironment(INSTALLED), config(), { purge: false, stamp: 'x' }).steps,
    );
    expect(steps).toContain('Usunięcie zadania uruchamiającego WSL');
    expect(steps).toContain('Usunięcie reguły zapory Hyper-V');
  });
});
