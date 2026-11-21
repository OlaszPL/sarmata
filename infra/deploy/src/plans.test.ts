import { describe, expect, it } from 'vitest';
import {
  describePlan,
  executePlan,
  planInstall,
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
  linuxEnvironment,
  macEnvironment,
  PROFILES,
  secrets,
  upstreamCompose,
  windowsEnvironment,
} from './test-support/fixtures.ts';
import { recordingHost, type Call } from './test-support/recording-host.ts';

const PASSWORD = 'Tajne-Haslo-2026';
const titles = (plan: Plan): string[] => plan.steps.map((current) => current.title);
const argvOf = (current: Step | undefined): readonly string[] =>
  current?.action.kind === 'run' ? current.action.argv : [];
const byTitle = (plan: Plan, title: string): Step | undefined =>
  plan.steps.find((current) => current.title === title);
const install = (env: Environment, settings: InstallConfig = config()): Plan =>
  planInstall({
    env,
    config: settings,
    secrets: secrets(),
    upstreamCompose: upstreamCompose(),
    adminPassword: PASSWORD,
  });
const update = (env: Environment): Plan =>
  planUpdate({
    env,
    config: config(),
    secrets: secrets(),
    upstreamCompose: upstreamCompose(),
    stamp: '20261121-120000',
    newLauncher: null,
  });

describe('planInstall', () => {
  it('macOS with a running engine: copy, files, build, database, migrations, admin, start, command, shortcut', () => {
    expect(titles(install(macEnvironment()))).toEqual([
      'Kopiowanie plików aplikacji',
      'Zapis sekretów i ustawień usług (.env)',
      'Zapis definicji usług (compose.yaml)',
      'Zapis ustawień instalacji (sarmata.json)',
      'Budowanie obrazu sarmata/web:current ze źródeł (kilka minut)',
      'Budowanie obrazu sarmata/worker:current ze źródeł (kilka minut)',
      'Uruchamianie bazy danych',
      'Nakładanie migracji bazy',
      'Uruchamianie usługi logowania',
      'Zakładanie urzędu i konta administratora',
      'Uruchamianie wszystkich usług',
      'Instalacja polecenia sarmata',
      'Skrót na pulpicie',
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

  it('Ubuntu without Docker: installs Docker Engine, adds the account to the docker group, uses sudo', () => {
    const plan = install(linuxEnvironment({ engine: { state: 'missing', wsl: null } }));
    const [docker, group, home] = plan.steps;
    expect(argvOf(docker).slice(0, 3)).toEqual(['sudo', 'sh', '-c']);
    expect(argvOf(docker)[3]).toContain('https://download.docker.com/linux/ubuntu');
    expect(argvOf(group)).toEqual(['sudo', 'usermod', '-aG', 'docker', 'jan']);
    expect(argvOf(home)).toEqual([
      'sudo',
      'install',
      '-d',
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

  it('Windows without WSL: installs WSL2 and stops for a restart', () => {
    const plan = install(windowsEnvironment({ engine: { state: 'missing', wsl: 'missing' } }));
    expect(argvOf(plan.steps[0])).toEqual(['wsl.exe', '--install', '--no-distribution']);
    expect(plan.steps[1]?.action).toMatchObject({
      kind: 'halt',
      message: expect.stringContaining('Uruchom ponownie komputer') as unknown,
    });
    expect(plan.steps).toHaveLength(2);
  });

  it('Windows without the distro: WSL distro with Docker Engine, LAN settings, release copied into WSL', () => {
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
    expect(byTitle(plan, 'Reguła zapory Hyper-V dla dostępu z sieci urzędu')?.on).toBe('system');
    expect(byTitle(plan, 'Kopiowanie plików aplikacji')?.action).toEqual({
      kind: 'copy',
      from: '/mnt/c/Users/jan/Downloads/sarmata',
      to: '/opt/sarmata/source',
    });
    expect(byTitle(plan, 'Instalacja polecenia sarmata')?.action).toEqual({
      kind: 'copy',
      from: env.execPath,
      to: 'C:\\Users\\jan\\AppData\\Local\\Programs\\Sarmata\\sarmata.exe',
    });
  });

  it('macOS without an engine: stops with instructions for Docker Desktop or Colima', () => {
    const plan = install(macEnvironment({ engine: { state: 'missing', wsl: null } }));
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.action).toMatchObject({
      kind: 'halt',
      message: expect.stringContaining('Colima') as unknown,
    });
  });

  it('server with an external Supabase: no local database, Caddy with its root certificate', () => {
    const external = config({
      ...PROFILES.server,
      supabase: { mode: 'external', url: 'https://abc.supabase.co' },
      shortcut: false,
    });
    const steps = titles(install(macEnvironment(), external));
    expect(steps).not.toContain('Uruchamianie bazy danych');
    expect(steps).not.toContain('Uruchamianie usługi logowania');
    expect(steps).toContain('Zapis konfiguracji Caddy');
    expect(steps).toContain('Oczekiwanie na certyfikat Caddy');
  });

  it('stops when Sarmata is already installed', () => {
    expect(install(macEnvironment({ installed: true })).steps[0]?.action.kind).toBe('halt');
  });
});

describe('planUpdate', () => {
  it('builds next to the running version, dumps, snapshots, swaps and cleans up', () => {
    expect(titles(update(macEnvironment({ installed: true })))).toEqual([
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
      'Usuwanie poprzedniej wersji plików',
      'Usuwanie poprzedniego compose.yaml',
      'Usuwanie poprzedniego .env',
      'Usuwanie tagu sarmata/web:candidate',
      'Usuwanie tagu sarmata/worker:candidate',
      'Czyszczenie migawki danych bazy',
      'Porządkowanie starych kopii bazy',
    ]);
  });

  it('rolls back images, files and database when the new version does not start', async () => {
    const calls: Call[] = [];
    const host = recordingHost({
      name: 'mac',
      calls,
      respond: (argv) =>
        argv.includes('--remove-orphans') ? { code: 1, stderr: 'web is unhealthy' } : {},
    });
    const undone: string[] = [];
    const result = await executePlan(
      update(macEnvironment({ installed: true })),
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
  });
});

describe('planStart and planUninstall', () => {
  it('start --open on Windows: compose in WSL, browser on Windows', () => {
    const plan = planStart(windowsEnvironment({ installed: true }), config(), { open: true });
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

  it('uninstall keeps a final dump unless purged', () => {
    const env = macEnvironment({ installed: true });
    const keep = titles(planUninstall(env, config(), { purge: false, stamp: '20261121-120000' }));
    expect(keep).toContain('Końcowa kopia bazy (pg_dump)');
    expect(keep).not.toContain('Usunięcie katalogu instalacji');
    const purge = titles(planUninstall(env, config(), { purge: true, stamp: '20261121-120000' }));
    expect(purge).toContain('Usunięcie katalogu instalacji');
    expect(purge).not.toContain('Końcowa kopia bazy (pg_dump)');
  });
});
