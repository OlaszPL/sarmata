import { renderBootstrapSql } from './bootstrap-sql.ts';
import { renderCaddyfile } from './caddy.ts';
import { APP_IMAGES, renderCompose, type AppImage } from './compose.ts';
import { AI_PORT, publicUrls, type InstallConfig } from './config.ts';
import { prepareEngine, startEngine, sudoPrefix } from './engine.ts';
import { layout, samePath, toEnginePath, type Environment, type Layout } from './environment.ts';
import { haltStep, runAction, step, type Plan, type Step } from './plan.ts';
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
  /** Timestamp for the dump file name, e.g. 20261121-120000. */
  readonly stamp: string;
  /** New sarmata binary to install, system side, null to keep the current one. */
  readonly newLauncher: string | null;
}

export type UpdateSource =
  | { readonly kind: 'dir'; readonly path: string }
  | { readonly kind: 'zip'; readonly path: string }
  | { readonly kind: 'git'; readonly url: string; readonly ref: string };

const TOOLS = ['--profile', 'tools', 'run', '--rm', '--no-deps', '-T', 'tools'] as const;
const WAIT = ['--wait', '--wait-timeout', '600'] as const;
const NOT_INSTALLED = 'Nie znaleziono instalacji Sarmaty na tym komputerze.';
const CADDY_ROOT = '/data/caddy/pki/authorities/local/root.crt';
// The release zip has one top directory (sarmata/), moved into place as source.next.
const UNZIP_SCRIPT =
  'set -eu; tmp="$2.unzip"; rm -rf "$tmp"; mkdir -p "$tmp"; unzip -q "$1" -d "$tmp"; ' +
  'top=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n 1); mv "$top" "$2"; rm -rf "$tmp"';

const halt = (message: string): Plan => ({ steps: [haltStep(message)] });
const engineRun = (title: string, argv: readonly string[]): Step =>
  step(title, 'engine', runAction(argv));

interface Stack {
  readonly paths: Layout;
  readonly compose: readonly string[];
  readonly docker: readonly string[];
  readonly local: boolean;
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
  };
}

const upDatabase = (s: Stack): Step[] =>
  s.local ? [engineRun('Uruchamianie bazy danych', [...s.compose, 'up', '-d', ...WAIT, 'db'])] : [];
const migrate = (s: Stack): Step =>
  engineRun('Nakładanie migracji bazy', [...s.compose, ...TOOLS, 'migrate']);

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
    runAction([
      ...s.docker,
      'build',
      '--file',
      s.paths.join(context, 'infra', 'deploy', 'docker', 'app.Dockerfile'),
      '--target',
      image.target,
      '--tag',
      `${image.repository}:${tag}`,
      context,
    ]),
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

function stackFiles(
  input: Pick<InstallInput, 'env' | 'config' | 'secrets' | 'upstreamCompose'>,
  paths: Layout,
  withCerts: boolean,
): Step[] {
  const { env, config } = input;
  const steps: Step[] = [
    step(
      'Zapis sekretów i ustawień usług (.env)',
      'engine',
      {
        kind: 'write',
        path: paths.envFile,
        content: renderEnv(config, input.secrets),
        mode: 0o600,
      },
      { sensitive: true },
    ),
    step('Zapis definicji usług (compose.yaml)', 'engine', {
      kind: 'write',
      path: paths.composeFile,
      content: renderCompose(input.upstreamCompose, config, aiRelayPorts(env, config)),
    }),
    step('Zapis ustawień instalacji (sarmata.json)', 'engine', {
      kind: 'write',
      path: paths.configFile,
      content: `${JSON.stringify(config, null, 2)}\n`,
    }),
  ];
  if (config.profile === 'server') {
    steps.push(
      step('Zapis konfiguracji Caddy', 'engine', {
        kind: 'write',
        path: paths.caddyfile,
        content: renderCaddyfile(config),
      }),
    );
  }
  if (withCerts && config.tls.mode === 'files') {
    steps.push(
      step('Kopiowanie certyfikatu urzędu', 'engine', {
        kind: 'copy',
        from: toEnginePath(env, config.tls.certPath),
        to: paths.certFile,
      }),
      step(
        'Kopiowanie klucza certyfikatu urzędu',
        'engine',
        { kind: 'copy', from: toEnginePath(env, config.tls.keyPath), to: paths.keyFile },
        { sensitive: true },
      ),
    );
  }
  return steps;
}

function prepareHome(env: Environment): Step[] {
  if (sudoPrefix(env).length === 0) return [];
  return [
    engineRun(`Przygotowanie katalogu ${env.home}`, [
      'sudo',
      'install',
      '-d',
      '-o',
      env.user.name,
      '-g',
      env.user.group,
      env.home,
    ]),
  ];
}

function installLauncher(env: Environment, from: string): Step[] {
  const target = layout(env).launcher;
  if (samePath(from, target)) return [];
  return [step('Instalacja polecenia sarmata', 'system', { kind: 'copy', from, to: target })];
}

function caddyRootExport(config: InstallConfig, s: Stack): Step[] {
  if (config.profile !== 'server' || config.tls.mode !== 'internal') return [];
  return [
    engineRun('Oczekiwanie na certyfikat Caddy', [
      ...s.compose,
      'exec',
      '-T',
      'caddy',
      'sh',
      '-c',
      `for i in $(seq 60); do test -f ${CADDY_ROOT} && exit 0; sleep 1; done; exit 1`,
    ]),
    engineRun(
      'Zapis certyfikatu głównego Caddy (caddy-root.crt) do rozesłania na komputery urzędu',
      [...s.compose, 'cp', `caddy:${CADDY_ROOT}`, s.paths.join(s.paths.home, 'caddy-root.crt')],
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

/** Fresh installation from an unpacked release. */
export function planInstall(input: InstallInput): Plan {
  const { env, config } = input;
  if (env.installed) {
    return halt(
      'Sarmata jest już zainstalowana. Aby ją zaktualizować z tej paczki, uruchom: install.sh update (Windows: install.bat update).',
    );
  }
  if (env.releaseDir === null)
    return halt('Uruchom kreator z rozpakowanej paczki: install.sh albo install.bat.');
  const engine = prepareEngine(env, config);
  if (engine.halted) return { steps: engine.steps };
  const s = stack(env, config, engine.dockerPrefix);
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
      ...stackFiles(input, s.paths, true),
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
      engineRun('Uruchamianie wszystkich usług', [...s.compose, 'up', '-d', ...WAIT]),
      ...caddyRootExport(config, s),
      ...installLauncher(env, env.execPath),
      ...shortcut,
    ],
  };
}

/** Puts the new version next to the installation as source.next. The update plan reads it from there. */
export function planStageSource(env: Environment, source: UpdateSource): Plan {
  if (!env.installed) return halt(NOT_INSTALLED);
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
    return halt(
      'Z Docker Desktop na Windows rozpakuj nową paczkę i uruchom w niej: install.bat update.',
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
        source.url,
        paths.sourceNext,
      ]),
    ],
  };
}

/** Update with a database dump, a data snapshot and a full rollback when anything fails. */
export function planUpdate(input: UpdateInput): Plan {
  const { env, config } = input;
  if (!env.installed) return halt(NOT_INSTALLED);
  const engine = startEngine(env);
  if (engine.halted) return { steps: engine.steps };
  const s = stack(env, config, engine.dockerPrefix);
  const p = s.paths;
  const images = APP_IMAGES;
  const swap = (title: string, from: string, to: string, undoTitle: string): Step =>
    step(
      title,
      'engine',
      { kind: 'rename', from, to },
      { undo: [step(undoTitle, 'engine', { kind: 'rename', from: to, to: from })] },
    );
  return {
    steps: [
      ...engine.steps,
      ...images.map((image) =>
        buildImage(s, p.sourceNext, image, 'candidate', [
          engineRun(`Usuwanie obrazu ${image.repository}:candidate`, [
            ...s.docker,
            'image',
            'rm',
            `${image.repository}:candidate`,
          ]),
        ]),
      ),
      ...upDatabase(s),
      engineRun('Kopia bazy przed aktualizacją (pg_dump)', [
        ...s.compose,
        ...TOOLS,
        'dump',
        `pre-update-${input.stamp}.dump`,
      ]),
      step('Zatrzymanie usług', 'engine', runAction([...s.compose, 'stop']), {
        undo: [
          engineRun('Ponowne uruchomienie poprzedniej wersji', [...s.compose, 'up', '-d', ...WAIT]),
        ],
      }),
      ...(s.local
        ? [
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
        : []),
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
      ...stackFiles(input, p, false),
      ...images.flatMap((image) => [
        engineRun(`Oznaczenie obrazu ${image.repository}:current jako previous`, [
          ...s.docker,
          'tag',
          `${image.repository}:current`,
          `${image.repository}:previous`,
        ]),
        step(
          `Przełączenie obrazu ${image.repository} na nową wersję`,
          'engine',
          runAction([
            ...s.docker,
            'tag',
            `${image.repository}:candidate`,
            `${image.repository}:current`,
          ]),
          {
            undo: [
              engineRun(`Przywrócenie poprzedniego obrazu ${image.repository}`, [
                ...s.docker,
                'tag',
                `${image.repository}:previous`,
                `${image.repository}:current`,
              ]),
            ],
          },
        ),
      ]),
      ...upDatabase(s),
      migrate(s),
      engineRun('Uruchamianie nowej wersji', [
        ...s.compose,
        'up',
        '-d',
        ...WAIT,
        '--remove-orphans',
      ]),
      step('Usuwanie poprzedniej wersji plików', 'engine', {
        kind: 'remove',
        path: p.sourcePrevious,
      }),
      step('Usuwanie poprzedniego compose.yaml', 'engine', {
        kind: 'remove',
        path: p.composePrevious,
      }),
      step('Usuwanie poprzedniego .env', 'engine', { kind: 'remove', path: p.envPrevious }),
      ...images.map((image) =>
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
      ...(input.newLauncher === null ? [] : installLauncher(env, input.newLauncher)),
    ],
  };
}

export function planStart(
  env: Environment,
  config: InstallConfig,
  options: { readonly open: boolean },
): Plan {
  if (!env.installed) return halt(NOT_INSTALLED);
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
  if (!env.installed) return halt(NOT_INSTALLED);
  if (env.engine.state !== 'ready')
    return halt('Silnik kontenerów nie działa, więc Sarmata jest zatrzymana.');
  const s = stack(env, config, env.engine.dockerPrefix);
  return { steps: [engineRun('Zatrzymywanie Sarmaty', [...s.compose, 'stop'])] };
}

export function planStatus(env: Environment, config: InstallConfig): Plan {
  if (!env.installed) return halt(NOT_INSTALLED);
  if (env.engine.state !== 'ready')
    return halt('Silnik kontenerów nie działa, więc Sarmata jest zatrzymana.');
  const s = stack(env, config, env.engine.dockerPrefix);
  return {
    steps: [
      step('Stan usług', 'engine', runAction([...s.compose, 'ps', '--all'], { interactive: true })),
    ],
  };
}

/**
 * Removes the installation. By default it first writes a final dump to backups/ and keeps that
 * directory. With purge it removes everything, backups included.
 */
export function planUninstall(
  env: Environment,
  config: InstallConfig,
  options: { readonly purge: boolean; readonly stamp: string },
): Plan {
  if (!env.installed) return halt(NOT_INSTALLED);
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
  return {
    steps: [
      ...engine.steps,
      ...(options.purge
        ? []
        : [
            ...upDatabase(s),
            engineRun('Końcowa kopia bazy (pg_dump)', [
              ...s.compose,
              ...TOOLS,
              'dump',
              `uninstall-${options.stamp}.dump`,
            ]),
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
