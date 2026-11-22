import { renderBootstrapSql } from './bootstrap-sql.ts';
import { renderCaddyfile } from './caddy.ts';
import { APP_IMAGES, renderCompose, type AppImage } from './compose.ts';
import { AI_PORT, publicUrls, type InstallConfig } from './config.ts';
import {
  prepareEngine,
  startEngine,
  sudoPrefix,
  wslAutostart,
  wslRemovalSteps,
  wslSettingSteps,
} from './engine.ts';
import { layout, samePath, toEnginePath, type Environment, type Layout } from './environment.ts';
import { haltPlan, runAction, step, type Plan, type Step } from './plan.ts';
import { usesCaddy } from './profiles.ts';
import { renderEnv, type Secrets } from './secrets.ts';
import { desktopShortcut } from './shortcut.ts';

export interface InstallInput {
  readonly env: Environment;
  readonly config: InstallConfig;
  readonly secrets: Secrets;
  /** infra/deploy/supabase/docker-compose.yml of the release being installed. */
  readonly upstreamCompose: string;
  readonly adminPassword: string;
}

export interface UpdateInput {
  readonly env: Environment;
  readonly config: InstallConfig;
  /** From the existing .env, so passwords stay the same. */
  readonly secrets: Secrets;
  /** infra/deploy/supabase/docker-compose.yml of the staged new version. */
  readonly upstreamCompose: string;
  /** VERSION of the staged new version, null for a build from git. */
  readonly newVersion: string | null;
  /** Timestamp for the dump file name, e.g. 20261121-120000. */
  readonly stamp: string;
  /** New sarmata binary to install, system side, null to keep the current one. */
  readonly newLauncher: string | null;
}

export type UpdateSource =
  | { readonly kind: 'dir'; readonly path: string }
  | { readonly kind: 'zip'; readonly path: string }
  | { readonly kind: 'git'; readonly url: string; readonly ref: string };

export const NOT_INSTALLED = 'Nie znaleziono instalacji Sarmaty na tym komputerze.';
export const ENGINE_STOPPED = 'Silnik kontenerów nie działa, więc Sarmata jest zatrzymana.';
/** Free space an update needs: two candidate images and a snapshot of the database. */
export const UPDATE_FREE_GIB = 10;

const TOOLS = ['--profile', 'tools', 'run', '--rm', '--no-deps', '-T', 'tools'] as const;
const WAIT = ['--wait', '--wait-timeout', '600'] as const;
const CADDY_PKI = '/data/caddy/pki/authorities/local';
const PGSODIUM_KEY = '/etc/postgresql-custom/pgsodium_root.key';
// The release zip has one top directory (sarmata/), moved into place as source.next.
const UNZIP_SCRIPT =
  'set -eu; tmp="$2.unzip"; rm -rf "$tmp"; mkdir -p "$tmp"; unzip -q "$1" -d "$tmp"; ' +
  'top=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n 1); mv "$top" "$2"; rm -rf "$tmp"';
const FREE_SPACE_SCRIPT =
  'need=$1; shift; for dir in "$@"; do [ -e "$dir" ] || continue; ' +
  'free=$(df -Pk "$dir" | awk \'NR==2 {print $4}\'); ' +
  'if [ "$free" -lt "$need" ]; then echo "too little free space in $dir: $((free / 1048576)) GiB, need $((need / 1048576)) GiB" >&2; exit 1; fi; done';
const DUMP_NAME = /^[\w.-]+\.dump$/;

const engineRun = (title: string, argv: readonly string[], undo: readonly Step[] = []): Step =>
  step(title, 'engine', runAction(argv), undo.length > 0 ? { undo } : {});

interface Stack {
  readonly paths: Layout;
  readonly compose: readonly string[];
  readonly docker: readonly string[];
  readonly local: boolean;
  /** CA bundle of a TLS-inspecting proxy, as the engine host sees it, null when not set. */
  readonly buildCaFile: string | null;
}

function stack(env: Environment, config: InstallConfig, dockerPrefix: readonly string[]): Stack {
  const paths = layout(env);
  return {
    paths,
    compose: [
      ...dockerPrefix,
      'docker',
      'compose',
      '--project-directory',
      paths.home,
      '-f',
      paths.composeFile,
    ],
    docker: [...dockerPrefix, 'docker'],
    local: config.supabase.mode === 'local',
    buildCaFile: env.buildCaFile === null ? null : toEnginePath(env, env.buildCaFile),
  };
}

// auth (GoTrue) creates auth.jwt() with its own migrations on start, and our policies call it.
const upDatabase = (s: Stack): Step[] =>
  s.local
    ? [engineRun('Uruchamianie bazy danych', [...s.compose, 'up', '-d', ...WAIT, 'db', 'auth'])]
    : [];
const migrate = (s: Stack): Step =>
  engineRun('Nakładanie migracji bazy', [...s.compose, ...TOOLS, 'migrate']);
const dumpStep = (s: Stack, title: string, file: string, undo: readonly Step[] = []): Step =>
  engineRun(title, [...s.compose, ...TOOLS, 'dump', file], undo);
const upAll = (s: Stack, title: string): Step =>
  engineRun(title, [...s.compose, 'up', '-d', ...WAIT, '--remove-orphans']);

// Interactive: the build prints its own progress for 10 to 20 minutes, and sudo can ask again.
function buildImage(
  s: Stack,
  context: string,
  image: AppImage,
  tag: string,
  undo: readonly Step[] = [],
): Step {
  return step(
    `Budowanie obrazu ${image.repository}:${tag} ze źródeł (kilka minut)`,
    'engine',
    runAction(
      [
        ...s.docker,
        'build',
        '--file',
        s.paths.join(context, 'infra', 'deploy', 'docker', 'app.Dockerfile'),
        '--target',
        image.target,
        '--tag',
        `${image.repository}:${tag}`,
        ...(s.buildCaFile === null ? [] : ['--secret', `id=ca,src=${s.buildCaFile}`]),
        context,
      ],
      { interactive: true },
    ),
    undo.length > 0 ? { undo } : {},
  );
}

/**
 * Native AI ports the ai-relay container exposes to containers. Docker Desktop and Colima on macOS
 * (and Docker Desktop on Windows) reach the host loopback through host.docker.internal on their own.
 */
export function aiRelayPorts(env: Environment, config: InstallConfig): number[] {
  if (
    !config.ai.enabled ||
    env.os === 'macos' ||
    (env.os === 'windows' && env.engineHost === 'local')
  )
    return [];
  return config.ai.decisionPort === null ? [AI_PORT] : [AI_PORT, config.ai.decisionPort];
}

type StackInput = Pick<InstallInput, 'env' | 'config' | 'secrets' | 'upstreamCompose'>;

const envFileStep = (input: StackInput, paths: Layout, undo: readonly Step[] = []): Step =>
  step(
    'Zapis sekretów i ustawień usług (.env)',
    'engine',
    {
      kind: 'write',
      path: paths.envFile,
      content: renderEnv(input.config, input.secrets),
      mode: 0o600,
    },
    { sensitive: true, undo },
  );
const composeFileStep = (input: StackInput, paths: Layout, undo: readonly Step[] = []): Step =>
  step(
    'Zapis definicji usług (compose.yaml)',
    'engine',
    {
      kind: 'write',
      path: paths.composeFile,
      content: renderCompose(
        input.upstreamCompose,
        input.config,
        aiRelayPorts(input.env, input.config),
      ),
    },
    undo.length > 0 ? { undo } : {},
  );
/** sarmata.json marks a finished installation, so install writes it last. */
const configFileStep = (config: InstallConfig, paths: Layout, undo: readonly Step[] = []): Step =>
  step(
    'Zapis ustawień instalacji (sarmata.json)',
    'engine',
    { kind: 'write', path: paths.configFile, content: `${JSON.stringify(config, null, 2)}\n` },
    undo.length > 0 ? { undo } : {},
  );

function caddyFiles(input: StackInput, paths: Layout, withCerts: boolean): Step[] {
  const { env, config } = input;
  if (!usesCaddy(config)) return [];
  const steps: Step[] = [
    step('Zapis konfiguracji Caddy', 'engine', {
      kind: 'write',
      path: paths.caddyfile,
      content: renderCaddyfile(config),
    }),
  ];
  if (withCerts && config.tls.mode === 'files') {
    steps.push(
      step('Kopiowanie certyfikatu urzędu', 'engine', {
        kind: 'copy',
        from: toEnginePath(env, config.tls.certPath),
        to: paths.certFile,
        mode: 0o644,
      }),
      step(
        'Kopiowanie klucza certyfikatu urzędu',
        'engine',
        {
          kind: 'copy',
          from: toEnginePath(env, config.tls.keyPath),
          to: paths.keyFile,
          mode: 0o600,
        },
        { sensitive: true },
      ),
    );
  }
  return steps;
}

/**
 * The installation directory, readable only by its owner: .env holds every secret and backups/
 * full database dumps. Windows gets an explicit ACL (well-known SIDs, so a Polish Windows with
 * "Administratorzy" works too).
 */
function prepareHome(env: Environment): Step[] {
  const title = `Przygotowanie katalogu ${env.home} (dostęp tylko dla właściciela)`;
  if (env.os === 'windows' && env.engineHost === 'local') {
    const script = [
      `New-Item -ItemType Directory -Force -Path '${env.home.replaceAll("'", "''")}' | Out-Null`,
      `icacls '${env.home.replaceAll("'", "''")}' /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null`,
    ].join('; ');
    return [
      step(
        title,
        'system',
        runAction(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script]),
      ),
    ];
  }
  const sudo = sudoPrefix(env);
  if (sudo.length > 0)
    return [
      engineRun(title, [
        ...sudo,
        'install',
        '-d',
        '-m',
        '0750',
        '-o',
        env.user.name,
        '-g',
        env.user.group,
        env.home,
      ]),
    ];
  return [
    engineRun(title, ['install', '-d', '-m', env.os === 'macos' ? '0700' : '0750', env.home]),
  ];
}

/**
 * Copies the sarmata command into place. Windows keeps a running .exe locked but lets it be
 * renamed, so an update first moves the running launcher aside.
 */
function installLauncher(env: Environment, from: string, replacing: boolean): Step[] {
  const target = layout(env).launcher;
  if (samePath(from, target)) return [];
  const aside = `${target}.old`;
  return [
    ...(replacing && env.os === 'windows'
      ? [
          step('Usunięcie starego polecenia sarmata', 'system', { kind: 'remove', path: aside }),
          step('Odsunięcie działającego polecenia sarmata', 'system', {
            kind: 'rename',
            from: target,
            to: aside,
          }),
        ]
      : []),
    step('Instalacja polecenia sarmata', 'system', { kind: 'copy', from, to: target, mode: 0o755 }),
  ];
}

function caddyRootExport(config: InstallConfig, s: Stack): Step[] {
  if (!usesCaddy(config) || config.tls.mode !== 'internal') return [];
  const root = `${CADDY_PKI}/root.crt`;
  return [
    engineRun('Oczekiwanie na certyfikat Caddy', [
      ...s.compose,
      'exec',
      '-T',
      'caddy',
      'sh',
      '-c',
      `for i in $(seq 60); do test -f ${root} && exit 0; sleep 1; done; exit 1`,
    ]),
    engineRun(
      'Zapis certyfikatu głównego Caddy (caddy-root.crt) do rozesłania na komputery urzędu',
      [...s.compose, 'cp', `caddy:${root}`, s.paths.join(s.paths.home, 'caddy-root.crt')],
    ),
  ];
}

function openBrowser(env: Environment, url: string): Step {
  const argv =
    env.os === 'windows'
      ? ['rundll32.exe', 'url.dll,FileProtocolHandler', url]
      : env.os === 'macos'
        ? ['open', url]
        : ['xdg-open', url];
  return step('Otwieranie przeglądarki', 'system', runAction(argv, { allowFailure: true }));
}

/** AI settings stay off until the native runtime answers (ai-setup.ts, then planAiApply). */
export const withoutAi = (config: InstallConfig): InstallConfig => ({
  ...config,
  ai: { enabled: false },
});

/**
 * Fresh installation from an unpacked release. Every step can run again, so after a failure the
 * wizard simply runs once more with the same .env. sarmata.json comes last and marks the
 * installation as finished. AI comes after this plan (setUpAi), so the files say AI is off here.
 */
export function planInstall(input: InstallInput): Plan {
  const { env, config } = input;
  if (env.installed) {
    return haltPlan(
      'Sarmata jest już zainstalowana. Aby ją zaktualizować z tej paczki, uruchom: install.sh update (Windows: install.bat update).',
    );
  }
  if (env.releaseDir === null)
    return haltPlan('Uruchom kreator z rozpakowanej paczki: install.sh albo install.bat.');
  const engine = prepareEngine(env, config);
  if (engine.halted) return { steps: engine.steps };
  const s = stack(env, config, engine.dockerPrefix);
  const files: StackInput = { ...input, config: withoutAi(config) };
  const shortcut = config.shortcut ? (desktopShortcut(env)?.steps ?? []) : [];
  return {
    steps: [
      ...engine.steps,
      ...prepareHome(env),
      step('Kopiowanie plików aplikacji', 'engine', {
        kind: 'copy',
        from: toEnginePath(env, env.releaseDir),
        to: s.paths.source,
      }),
      envFileStep(files, s.paths),
      composeFileStep(files, s.paths),
      ...caddyFiles(files, s.paths, true),
      ...APP_IMAGES.map((image) => buildImage(s, s.paths.source, image, 'current')),
      ...upDatabase(s),
      migrate(s),
      ...(s.local
        ? [engineRun('Uruchamianie usługi logowania', [...s.compose, 'up', '-d', ...WAIT, 'auth'])]
        : []),
      step(
        'Zakładanie urzędu i konta administratora',
        'engine',
        runAction([...s.compose, ...TOOLS, 'sql'], {
          stdin: renderBootstrapSql({
            officeName: config.office.name,
            email: config.admin.email,
            password: input.adminPassword,
            firstName: config.admin.firstName,
            lastName: config.admin.lastName,
          }),
        }),
        { sensitive: true },
      ),
      upAll(s, 'Uruchamianie wszystkich usług'),
      ...caddyRootExport(config, s),
      ...wslAutostart(env),
      ...installLauncher(env, env.execPath, false),
      ...shortcut,
      configFileStep(files.config, s.paths),
    ],
  };
}

/** Puts the new version next to the installation as source.next. The update plan reads it from there. */
export function planStageSource(env: Environment, source: UpdateSource): Plan {
  if (!env.installed) return haltPlan(NOT_INSTALLED);
  const paths = layout(env);
  const clear = step('Czyszczenie poprzedniej próby aktualizacji', 'engine', {
    kind: 'remove',
    path: paths.sourceNext,
  });
  if (source.kind === 'dir') {
    return {
      steps: [
        clear,
        step('Kopiowanie nowej wersji', 'engine', {
          kind: 'copy',
          from: toEnginePath(env, source.path),
          to: paths.sourceNext,
        }),
      ],
    };
  }
  if (env.os === 'windows' && env.engineHost === 'local') {
    return haltPlan(
      'Z Docker Desktop na Windows rozpakuj nową paczkę i uruchom w niej: install.bat update.',
    );
  }
  const tool = source.kind === 'zip' ? 'unzip' : 'git';
  if (!env.engineTools[tool]) {
    const install =
      env.engineHost === 'wsl' || env.linuxDistro?.family === 'apt'
        ? `sudo apt install ${tool}`
        : env.linuxDistro?.family === 'dnf'
          ? `sudo dnf install ${tool}`
          : `brew install ${tool}`;
    return haltPlan(
      `Brakuje polecenia ${tool}${env.engineHost === 'wsl' ? ' w dystrybucji WSL sarmata' : ''}. Zainstaluj je (${install}) i uruchom aktualizację ponownie.`,
    );
  }
  if (source.kind === 'zip') {
    return {
      steps: [
        clear,
        engineRun('Rozpakowanie nowej wersji', [
          'sh',
          '-c',
          UNZIP_SCRIPT,
          'sh',
          toEnginePath(env, source.path),
          paths.sourceNext,
        ]),
      ],
    };
  }
  return {
    steps: [
      clear,
      engineRun('Pobranie nowej wersji z repozytorium', [
        'git',
        'clone',
        '--depth',
        '1',
        '--branch',
        source.ref,
        '--',
        source.url,
        paths.sourceNext,
      ]),
    ],
  };
}

/** Compares release versions like 1.2.10 and 1.10.0 part by part. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(/[.-]/);
  const right = b.split(/[.-]/);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const x = left[index] ?? '0';
    const y = right[index] ?? '0';
    const difference =
      /^\d+$/.test(x) && /^\d+$/.test(y) ? Number(x) - Number(y) : x.localeCompare(y);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function freeSpaceCheck(env: Environment): Step[] {
  // Docker Desktop on Windows keeps its images in its own VM disk, nothing to check from here.
  if (env.os === 'windows' && env.engineHost === 'local') return [];
  const dirs = env.os === 'macos' ? [env.home] : [env.home, '/var/lib/docker'];
  return [
    engineRun(`Sprawdzenie wolnego miejsca (co najmniej ${UPDATE_FREE_GIB} GB)`, [
      'sh',
      '-c',
      FREE_SPACE_SCRIPT,
      'sh',
      String(UPDATE_FREE_GIB * 1024 * 1024),
      ...dirs,
    ]),
  ];
}

/**
 * Update with a database dump and a full rollback when anything fails up to the start of the new
 * version: images, files, and the data (a snapshot of the local volume, or the dump restored into
 * an external Supabase). After the start the update is committed and the cleanup removes the old
 * copies, its failures are only warnings.
 */
export function planUpdate(input: UpdateInput): Plan {
  const { env, config } = input;
  if (!env.installed) return haltPlan(NOT_INSTALLED);
  if (!env.sourcePresent) {
    return haltPlan(
      `Brakuje katalogu ${layout(env).source}: poprzednia aktualizacja nie została wycofana do końca. Przenieś ${layout(env).sourcePrevious} z powrotem na ${layout(env).source} i uruchom aktualizację ponownie.`,
    );
  }
  if (
    env.installedVersion !== null &&
    input.newVersion !== null &&
    compareVersions(input.newVersion, env.installedVersion) < 0
  ) {
    return haltPlan(
      `Zainstalowana jest wersja ${env.installedVersion}, nowsza niż ${input.newVersion}. Powrót do starszej wersji to odtworzenie kopii bazy (sarmata restore) na świeżej instalacji.`,
    );
  }
  const engine = startEngine(env);
  if (engine.halted) return { steps: engine.steps };
  const s = stack(env, config, engine.dockerPrefix);
  const p = s.paths;
  const dumpFile = `pre-update-${input.stamp}.dump`;
  const swap = (title: string, from: string, to: string, undoTitle: string): Step =>
    step(
      title,
      'engine',
      { kind: 'rename', from, to },
      { undo: [step(undoTitle, 'engine', { kind: 'rename', from: to, to: from })] },
    );
  const stop = step('Zatrzymanie usług', 'engine', runAction([...s.compose, 'stop']), {
    undo: [
      engineRun('Ponowne uruchomienie poprzedniej wersji', [...s.compose, 'up', '-d', ...WAIT]),
    ],
  });
  // Local Supabase: dump while the database runs, then snapshot its volume while it is stopped.
  // External Supabase: dump after stopping the app, and restore the dump when the update fails
  // (each migration commits on its own, so a failed update may leave some of them applied).
  const backup = s.local
    ? [
        ...upDatabase(s),
        dumpStep(s, 'Kopia bazy przed aktualizacją (pg_dump)', dumpFile),
        stop,
        step(
          'Migawka danych bazy do wycofania',
          'engine',
          runAction([...s.compose, ...TOOLS, 'snapshot']),
          {
            undo: [
              engineRun('Zatrzymanie usług przed odtworzeniem bazy', [...s.compose, 'stop']),
              engineRun('Odtworzenie danych bazy z migawki', [
                ...s.compose,
                ...TOOLS,
                'restore-snapshot',
              ]),
            ],
          },
        ),
      ]
    : [
        stop,
        dumpStep(s, 'Kopia bazy przed aktualizacją (pg_dump)', dumpFile, [
          engineRun('Odtworzenie bazy z kopii sprzed aktualizacji', [
            ...s.compose,
            ...TOOLS,
            'restore',
            dumpFile,
          ]),
        ]),
      ];
  return {
    steps: [
      ...engine.steps,
      ...freeSpaceCheck(env),
      // Left behind by an update whose cleanup failed. The source directory exists (checked above).
      step('Usunięcie pozostałości poprzedniej aktualizacji', 'engine', {
        kind: 'remove',
        path: p.sourcePrevious,
      }),
      ...APP_IMAGES.map((image) =>
        buildImage(s, p.sourceNext, image, 'candidate', [
          engineRun(`Usuwanie obrazu ${image.repository}:candidate`, [
            ...s.docker,
            'image',
            'rm',
            `${image.repository}:candidate`,
          ]),
        ]),
      ),
      ...backup,
      swap(
        'Odłożenie bieżącej wersji plików',
        p.source,
        p.sourcePrevious,
        'Przywrócenie poprzedniej wersji plików',
      ),
      swap(
        'Włączenie nowej wersji plików',
        p.sourceNext,
        p.source,
        'Odsunięcie nieudanej wersji plików',
      ),
      swap(
        'Odłożenie bieżącego compose.yaml',
        p.composeFile,
        p.composePrevious,
        'Przywrócenie compose.yaml',
      ),
      swap('Odłożenie bieżącego .env', p.envFile, p.envPrevious, 'Przywrócenie .env'),
      envFileStep(input, p),
      composeFileStep(input, p),
      ...caddyFiles(input, p, false),
      configFileStep(config, p),
      ...APP_IMAGES.flatMap((image) => [
        engineRun(`Oznaczenie obrazu ${image.repository}:current jako previous`, [
          ...s.docker,
          'tag',
          `${image.repository}:current`,
          `${image.repository}:previous`,
        ]),
        engineRun(
          `Przełączenie obrazu ${image.repository} na nową wersję`,
          [...s.docker, 'tag', `${image.repository}:candidate`, `${image.repository}:current`],
          [
            engineRun(`Przywrócenie poprzedniego obrazu ${image.repository}`, [
              ...s.docker,
              'tag',
              `${image.repository}:previous`,
              `${image.repository}:current`,
            ]),
          ],
        ),
      ]),
      ...upDatabase(s),
      migrate(s),
      upAll(s, 'Uruchamianie nowej wersji'),
    ],
    cleanup: [
      step('Usuwanie poprzedniej wersji plików', 'engine', {
        kind: 'remove',
        path: p.sourcePrevious,
      }),
      step('Usuwanie poprzedniego compose.yaml', 'engine', {
        kind: 'remove',
        path: p.composePrevious,
      }),
      step('Usuwanie poprzedniego .env', 'engine', { kind: 'remove', path: p.envPrevious }),
      ...APP_IMAGES.map((image) =>
        engineRun(`Usuwanie tagu ${image.repository}:candidate`, [
          ...s.docker,
          'image',
          'rm',
          `${image.repository}:candidate`,
        ]),
      ),
      ...(s.local
        ? [engineRun('Czyszczenie migawki danych bazy', [...s.compose, ...TOOLS, 'clear-snapshot'])]
        : []),
      engineRun('Porządkowanie starych kopii bazy', [...s.compose, ...TOOLS, 'prune-dumps', '5']),
      ...(input.newLauncher === null ? [] : installLauncher(env, input.newLauncher, true)),
    ],
  };
}

export interface AiApplyInput {
  readonly env: Environment;
  /** The installation with its new AI settings. */
  readonly config: InstallConfig;
  /** The installation as it is now, restored when the new settings do not start. */
  readonly previous: InstallConfig;
  readonly secrets: Secrets;
  /** infra/deploy/supabase/docker-compose.yml of the installed version. */
  readonly upstreamCompose: string;
}

/** Writes new AI settings (.env, compose.yaml with ai-relay, sarmata.json) and restarts the app. */
export function planAiApply(input: AiApplyInput): Plan {
  const { env, config } = input;
  if (!env.installed) return haltPlan(NOT_INSTALLED);
  const engine = startEngine(env);
  if (engine.halted) return { steps: engine.steps };
  const s = stack(env, config, engine.dockerPrefix);
  const before: StackInput = { ...input, config: input.previous };
  return {
    steps: [
      ...engine.steps,
      ...wslSettingSteps(env, config, { dockerInstalled: true }),
      envFileStep(input, s.paths, [
        { ...envFileStep(before, s.paths), title: 'Przywrócenie .env' },
        engineRun('Ponowne uruchomienie z poprzednimi ustawieniami', [
          ...s.compose,
          'up',
          '-d',
          ...WAIT,
          '--remove-orphans',
        ]),
      ]),
      composeFileStep(input, s.paths, [
        { ...composeFileStep(before, s.paths), title: 'Przywrócenie compose.yaml' },
      ]),
      configFileStep(config, s.paths, [
        { ...configFileStep(input.previous, s.paths), title: 'Przywrócenie sarmata.json' },
      ]),
      upAll(s, 'Uruchamianie aplikacji z nowymi ustawieniami AI'),
    ],
  };
}

export function planStart(
  env: Environment,
  config: InstallConfig,
  options: { readonly open: boolean },
): Plan {
  if (!env.installed) return haltPlan(NOT_INSTALLED);
  const engine = startEngine(env);
  if (engine.halted) return { steps: engine.steps };
  const s = stack(env, config, engine.dockerPrefix);
  return {
    steps: [
      ...engine.steps,
      engineRun('Uruchamianie Sarmaty', [...s.compose, 'up', '-d', ...WAIT]),
      ...(options.open ? [openBrowser(env, publicUrls(config).appUrl)] : []),
    ],
  };
}

export function planStop(env: Environment, config: InstallConfig): Plan {
  if (!env.installed) return haltPlan(NOT_INSTALLED);
  if (env.engine.state !== 'ready') return haltPlan(ENGINE_STOPPED);
  const s = stack(env, config, env.engine.dockerPrefix);
  return { steps: [engineRun('Zatrzymywanie Sarmaty', [...s.compose, 'stop'])] };
}

export function planStatus(env: Environment, config: InstallConfig): Plan {
  if (!env.installed) return haltPlan(NOT_INSTALLED);
  if (env.engine.state !== 'ready') return haltPlan(ENGINE_STOPPED);
  const s = stack(env, config, env.engine.dockerPrefix);
  return {
    steps: [
      step('Stan usług', 'engine', runAction([...s.compose, 'ps', '--all'], { interactive: true })),
    ],
  };
}

/**
 * Restores a dump from backups/ into the installation: a safety dump first, then the restore with
 * the app stopped, migrations up to the installed version, and a start.
 */
export function planRestore(
  env: Environment,
  config: InstallConfig,
  options: { readonly file: string; readonly stamp: string },
): Plan {
  if (!env.installed) return haltPlan(NOT_INSTALLED);
  if (!DUMP_NAME.test(options.file))
    return haltPlan(
      'Podaj nazwę pliku kopii z katalogu backups, np. nightly-20261121-020000.dump.',
    );
  const engine = startEngine(env);
  if (engine.halted) return { steps: engine.steps };
  const s = stack(env, config, engine.dockerPrefix);
  return {
    steps: [
      ...engine.steps,
      ...upDatabase(s),
      dumpStep(s, 'Kopia bazy przed odtworzeniem (pg_dump)', `pre-restore-${options.stamp}.dump`),
      engineRun('Zatrzymanie aplikacji', [...s.compose, 'stop', 'web', 'worker']),
      engineRun(`Odtworzenie bazy z ${options.file}`, [
        ...s.compose,
        ...TOOLS,
        'restore',
        options.file,
      ]),
      migrate(s),
      upAll(s, 'Uruchamianie Sarmaty'),
    ],
  };
}

/**
 * Removes the installation. By default it first writes a final dump to backups/, together with
 * the keys a restore needs (pgsodium root key of Supabase Vault, Caddy's internal CA), and keeps
 * that directory. With purge it removes everything, backups included.
 */
export function planUninstall(
  env: Environment,
  config: InstallConfig,
  options: { readonly purge: boolean; readonly stamp: string },
): Plan {
  if (!env.installed) return haltPlan(NOT_INSTALLED);
  const engine = startEngine(env);
  if (engine.halted) return { steps: engine.steps };
  const s = stack(env, config, engine.dockerPrefix);
  const p = s.paths;
  const sudo = sudoPrefix(env);
  // On Linux the backups written by containers belong to root.
  const removeTree = (title: string, path: string): Step =>
    sudo.length > 0
      ? engineRun(title, [...sudo, 'rm', '-rf', path])
      : step(title, 'engine', { kind: 'remove', path });
  const images = APP_IMAGES.flatMap((image) => [
    `${image.repository}:current`,
    `${image.repository}:previous`,
  ]);
  const files: readonly (readonly [string, string])[] = [
    ['Usunięcie compose.yaml', p.composeFile],
    ['Usunięcie .env', p.envFile],
    ['Usunięcie sarmata.json', p.configFile],
    ['Usunięcie Caddyfile', p.caddyfile],
  ];
  const copyOut = (title: string, from: string, name: string): Step =>
    engineRun(title, [...s.compose, 'cp', from, p.join(p.backups, `${name}-${options.stamp}`)]);
  const keys = [
    ...(s.local
      ? [
          copyOut(
            'Kopia klucza pgsodium (Supabase Vault)',
            `db:${PGSODIUM_KEY}`,
            'pgsodium_root.key',
          ),
        ]
      : []),
    ...(usesCaddy(config) && config.tls.mode === 'internal'
      ? [copyOut('Kopia urzędu certyfikacji Caddy', `caddy:${CADDY_PKI}`, 'caddy-ca')]
      : []),
  ];
  return {
    steps: [
      ...engine.steps,
      ...(options.purge
        ? []
        : [
            ...upDatabase(s),
            dumpStep(s, 'Końcowa kopia bazy (pg_dump)', `uninstall-${options.stamp}.dump`),
            ...keys,
          ]),
      engineRun('Zatrzymanie i usunięcie kontenerów oraz danych', [
        ...s.compose,
        'down',
        '--remove-orphans',
        '--volumes',
      ]),
      step(
        'Usunięcie obrazów aplikacji',
        'engine',
        runAction([...s.docker, 'image', 'rm', '-f', ...images], { allowFailure: true }),
      ),
      ...(desktopShortcut(env)?.files ?? []).map((file) =>
        step('Usunięcie skrótu', 'system', { kind: 'remove', path: file }),
      ),
      ...wslRemovalSteps(env),
      ...(options.purge
        ? [removeTree('Usunięcie katalogu instalacji', p.home)]
        : [
            removeTree('Usunięcie plików aplikacji', p.source),
            ...files.map(([title, path]) => removeTree(title, path)),
          ]),
      ...(samePath(env.execPath, p.launcher)
        ? []
        : [step('Usunięcie polecenia sarmata', 'system', { kind: 'remove', path: p.launcher })]),
    ],
  };
}
