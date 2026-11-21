import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { posix, resolve, win32 } from 'node:path';
import { parseArgs } from 'node:util';
import { cancel, confirm, intro, isCancel, log, note, outro, spinner } from '@clack/prompts';
import {
  isBielikOneReady,
  isLlamaServerReady,
  localMachine,
  type Machine,
  type ProgressEvent,
  type RuntimeContext,
} from '@sarmata/ai-runtime';
import { pollUntil, setUpAi, type AiSetupDeps } from './ai-setup.ts';
import {
  aiDataDir,
  aiServiceRemovalPlan,
  installDecisionRuntime,
  installTextRuntime,
} from './ai.ts';
import {
  AI_PORT,
  answersSchema,
  installConfigSchema,
  NATIVE_AI_BIND,
  publicUrls,
  type AiSettings,
  type Answers,
  type InstallConfig,
} from './config.ts';
import { wslConfigNote } from './engine.ts';
import { detectEnvironment, layout, WSL_DISTRO, type Environment } from './environment.ts';
import {
  errorMessage,
  executePlan,
  type ExecutionEvent,
  type ExecutionResult,
  type Hosts,
} from './execute.ts';
import { localHost, wslHost } from './host.ts';
import { describePlan, usesTerminal, type Plan } from './plan.ts';
import {
  aiRelayPorts,
  NOT_INSTALLED,
  planAiApply,
  planInstall,
  planRestore,
  planStageSource,
  planStart,
  planStatus,
  planStop,
  planUninstall,
  withoutAi,
  type UpdateSource,
} from './plans.ts';
import { renderCaddyfile } from './caddy.ts';
import { renderCompose } from './compose.ts';
import { usesCaddy } from './profiles.ts';
import {
  generateSecrets,
  parseEnv,
  readSecrets,
  renderEnv,
  secretsFromAnswers,
  type Secrets,
} from './secrets.ts';
import {
  applyStagedUpdate,
  handOver,
  stageUpdate,
  UPSTREAM_COMPOSE,
  type StagedUpdateResult,
} from './update.ts';
import { askAi, askInstallAnswers, WizardCancelled } from './wizard.ts';

const USAGE = `Użycie: sarmata <polecenie> [opcje]

  install     kreator instalacji (opcje: --answers PLIK, --dry-run)
  start       uruchomienie (opcja: --open otwiera przeglądarkę)
  stop        zatrzymanie
  status      wersja i stan usług
  update      aktualizacja (opcje: --from KATALOG albo PLIK.zip, --git URL --ref TAG, --dry-run)
  ai          instalacja, zmiana albo naprawa modułu AI (opcja: --off wyłącza AI)
  restore     odtworzenie bazy z kopii: sarmata restore PLIK.dump (opcja: --dry-run)
  uninstall   usunięcie z końcową kopią bazy w backups/ (opcje: --purge, --dry-run)
  render      zapis compose.yaml i .env bez instalacji (opcje: --answers PLIK --out KATALOG)`;

const EXTERNAL_CHECKLIST =
  'W panelu projektu Supabase: włącz hook Custom Access Token z funkcją access.custom_access_token_hook, ' +
  'ustaw Site URL na adres aplikacji i skonfiguruj SMTP dla e-maili logowania.';
const RETRY_INSTALL =
  'Po usunięciu przyczyny uruchom kreator ponownie (install.sh albo install.bat): dokończy instalację z tymi samymi hasłami.';

interface Options {
  readonly dryRun: boolean;
  readonly answers: string | undefined;
  readonly open: boolean;
  readonly from: string | undefined;
  readonly git: string | undefined;
  readonly ref: string | undefined;
  readonly purge: boolean;
  readonly out: string | undefined;
  readonly staged: boolean;
  readonly off: boolean;
  readonly file: string | undefined;
}

interface Installation {
  readonly config: InstallConfig;
  readonly secrets: Secrets;
}

interface Context {
  readonly env: Environment;
  readonly hosts: Hosts;
  readonly machine: Machine;
  readonly options: Options;
}

const systemPath = (env: Environment): typeof posix => (env.os === 'windows' ? win32 : posix);
const timestamp = (date: Date): string =>
  date.toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '').replace('T', '-');
const freshSecrets = () => generateSecrets(randomBytes, new Date());

function progressText(event: ProgressEvent): string {
  if (event.kind === 'step') return event.message;
  const percent =
    event.totalBytes === 0 ? 100 : Math.floor((event.receivedBytes * 100) / event.totalBytes);
  return `${event.file}: ${percent}%`;
}

/** One spinner for plan steps and long phases. Steps that use the terminal get a log line instead. */
function progress(): {
  onEvent: (event: ExecutionEvent) => void;
  phase: (message: string) => void;
  update: (message: string) => void;
  settle: () => void;
} {
  const indicator = spinner();
  let spinning = false;
  const settle = (message?: string): void => {
    if (spinning) {
      indicator.stop(message);
      spinning = false;
    }
  };
  const begin = (message: string): void => {
    settle();
    indicator.start(message);
    spinning = true;
  };
  return {
    onEvent: (event) => {
      switch (event.type) {
        case 'start':
          if (usesTerminal(event.step)) {
            settle();
            log.step(event.step.title);
          } else begin(event.step.title);
          return;
        case 'done':
          settle(event.step.title);
          return;
        case 'fail':
          settle(event.step.title);
          log.error(`Błąd: ${event.message}`);
          return;
        case 'warning':
          settle(event.step.title);
          log.warn(`Nie udało się: ${event.step.title}: ${event.message}`);
          return;
        case 'rollback':
          settle();
          log.warn(`Wycofywanie: ${event.step.title}`);
          return;
        case 'rollback-fail':
          log.error(`Nie udało się wycofać: ${event.step.title}: ${event.message}`);
          return;
      }
    },
    phase: begin,
    update: (message) => {
      if (spinning) indicator.message(message);
    },
    settle: () => {
      settle();
    },
  };
}

function finish(result: ExecutionResult, success = 'Gotowe.'): number {
  switch (result.status) {
    case 'ok':
      if (result.warnings.length > 0)
        log.warn('Zakończono, ale porządkowanie nie powiodło się w całości. Można to zostawić.');
      outro(success);
      return 0;
    case 'halted':
      outro(result.message);
      return 3;
    case 'failed':
      if (result.rolledBack > 0 && result.rollbackErrors.length === 0)
        log.info('Zmiany wycofano, działa poprzednia wersja.');
      outro(`Nie udało się: ${result.step}.`);
      return 1;
  }
}

async function proceed(message: string, initialValue = true): Promise<boolean> {
  const value = await confirm({ message, initialValue });
  return !isCancel(value) && value;
}

function dryRun(plan: Plan, message = 'Tryb próbny: nic nie zmieniono.'): number {
  console.log(describePlan(plan));
  outro(message);
  return 0;
}

function summary(env: Environment, config: InstallConfig): string {
  const ai = config.ai;
  return [
    `Profil: ${config.profile}`,
    `Supabase: ${config.supabase.mode === 'local' ? 'na tym komputerze' : config.supabase.url}`,
    `Adres aplikacji: ${publicUrls(config).appUrl}`,
    `SMTP: ${config.smtp.enabled ? config.smtp.host : 'brak, powiadomienia tylko w aplikacji'}`,
    `AI: ${ai.enabled ? `${ai.alias}${ai.decisionPort === null ? '' : ' z Bielik-One'}, instalowane po uruchomieniu systemu` : 'wyłączone'}`,
    ...(usesCaddy(config) && config.tls.mode === 'internal'
      ? ['Certyfikat: wewnętrzne CA Caddy, plik caddy-root.crt trzeba rozesłać na komputery urzędu']
      : []),
    ...[wslConfigNote(env, config)].filter((line) => line !== null),
  ].join('\n');
}

async function readAnswers(hosts: Hosts, file: string): Promise<Answers> {
  const text = await hosts.system.readFile(resolve(file));
  if (text === null) throw new Error(`Nie można odczytać pliku ${file}`);
  return answersSchema.parse(JSON.parse(text));
}

async function readUpstream(env: Environment, hosts: Hosts): Promise<string | null> {
  if (env.releaseDir === null) {
    log.error('Uruchom kreator z rozpakowanej paczki: install.sh albo install.bat.');
    return null;
  }
  const text = await hosts.system.readFile(
    systemPath(env).join(env.releaseDir, ...UPSTREAM_COMPOSE),
  );
  if (text === null) log.error('W paczce brakuje infra/deploy/supabase/docker-compose.yml.');
  return text;
}

async function readInstallation(env: Environment, hosts: Hosts): Promise<Installation | null> {
  if (!env.installed) return null;
  const paths = layout(env);
  const configText = await hosts.engine.readFile(paths.configFile);
  const envText = await hosts.engine.readFile(paths.envFile);
  if (configText === null || envText === null) return null;
  return {
    config: installConfigSchema.parse(JSON.parse(configText)),
    secrets: readSecrets(parseEnv(envText), freshSecrets()),
  };
}

/** The common frame of commands on an existing installation. */
async function withInstallation(
  ctx: Context,
  title: string,
  run: (installation: Installation) => Promise<number>,
): Promise<number> {
  intro(title);
  const installation = await readInstallation(ctx.env, ctx.hosts);
  if (installation === null) {
    log.error(NOT_INSTALLED);
    return 1;
  }
  return run(installation);
}

/** Runs a plan with progress and reports the result. */
async function runPlan(ctx: Context, plan: Plan, success?: string): Promise<number> {
  return finish(await executePlan(plan, ctx.hosts, progress().onEvent), success);
}

function aiDeps(
  ctx: Context,
  profile: InstallConfig['profile'],
): AiSetupDeps & { settle: () => void } {
  const shown = progress();
  const dataDir = aiDataDir(ctx.env);
  const runtime: RuntimeContext = {
    machine: ctx.machine,
    dataDir,
    onProgress: (event) => {
      shown.update(progressText(event));
    },
  };
  return {
    env: ctx.env,
    hosts: ctx.hosts,
    dataDir,
    installer: {
      text: (ai) => installTextRuntime(runtime, profile, ai),
      decision: (ai, uv) => installDecisionRuntime(runtime, profile, ai, uv),
    },
    probes: {
      text: () => isLlamaServerReady(`http://${NATIVE_AI_BIND}:${String(AI_PORT)}/v1`),
      decision: (port) => isBielikOneReady(`http://${NATIVE_AI_BIND}:${String(port)}`),
    },
    waitFor: pollUntil,
    onEvent: shown.onEvent,
    onStep: shown.phase,
    settle: shown.settle,
  };
}

/**
 * Installs the native runtime for the wanted settings, then writes the settings that really work
 * into the installation and restarts the app. AI never fails the caller.
 */
async function applyAi(
  ctx: Context,
  installation: Installation,
  wanted: AiSettings,
  upstreamCompose: string,
): Promise<void> {
  const { env, hosts } = ctx;
  const previous = installation.config;
  let ai: AiSettings = { enabled: false };
  if (wanted.enabled) {
    const deps = aiDeps(ctx, previous.profile);
    const result = await setUpAi(deps, wanted);
    deps.settle();
    for (const warning of result.warnings) log.warn(warning);
    ai = result.ai;
  } else {
    await executePlan(aiServiceRemovalPlan(env), hosts, progress().onEvent);
  }
  if (JSON.stringify(ai) === JSON.stringify(previous.ai)) return;
  const applied = await executePlan(
    planAiApply({
      env,
      config: { ...previous, ai },
      previous,
      secrets: installation.secrets,
      upstreamCompose,
    }),
    hosts,
    progress().onEvent,
  );
  if (applied.status !== 'ok')
    log.warn('Nie udało się włączyć nowych ustawień AI, aplikacja działa z poprzednimi.');
}

async function install(ctx: Context): Promise<number> {
  const { env, hosts, options } = ctx;
  intro('Sarmata: instalacja');
  if (env.installed) {
    log.warn(
      'Sarmata jest już zainstalowana. Aby ją zaktualizować z tej paczki, uruchom: install.sh update (Windows: install.bat update).',
    );
    return 1;
  }
  const upstream = await readUpstream(env, hosts);
  if (upstream === null) return 1;
  const answers =
    options.answers === undefined
      ? await askInstallAnswers(env, ctx.machine)
      : await readAnswers(hosts, options.answers);
  // A repeated install after a failure keeps the passwords the database volume already has.
  const existing = options.dryRun ? null : await hosts.engine.readFile(layout(env).envFile);
  const generated = freshSecrets();
  const secrets = secretsFromAnswers(
    answers,
    existing === null ? generated : readSecrets(parseEnv(existing), generated),
  );
  const config = answers.config;
  const plan = planInstall({
    env,
    config,
    secrets,
    upstreamCompose: upstream,
    adminPassword: answers.adminPassword,
  });
  if (options.dryRun)
    return dryRun(
      plan,
      config.ai.enabled
        ? 'Tryb próbny: nic nie zmieniono. Moduł AI instaluje się po tych krokach.'
        : undefined,
    );
  note(summary(env, config), 'Podsumowanie');
  if (!(await proceed('Rozpocząć instalację?'))) return 130;
  const result = await executePlan(plan, hosts, progress().onEvent);
  if (result.status === 'failed') log.info(RETRY_INSTALL);
  if (result.status !== 'ok') return finish(result);
  await applyAi(ctx, { config: withoutAi(config), secrets }, config.ai, upstream);
  if (config.supabase.mode === 'external') note(EXTERNAL_CHECKLIST, 'Zewnętrzne Supabase');
  outro(`Gotowe. Otwórz ${publicUrls(config).appUrl} i zaloguj się jako ${config.admin.email}.`);
  return 0;
}

function updateSource(env: Environment, options: Options): UpdateSource | null {
  if (options.git !== undefined)
    return options.ref === undefined ? null : { kind: 'git', url: options.git, ref: options.ref };
  if (options.from !== undefined) {
    const path = resolve(options.from);
    return path.toLowerCase().endsWith('.zip') ? { kind: 'zip', path } : { kind: 'dir', path };
  }
  return env.releaseDir === null ? null : { kind: 'dir', path: env.releaseDir };
}

function updateFinished(outcome: StagedUpdateResult, config: InstallConfig): number {
  if (outcome.kind === 'missing-compose') {
    log.error('Nowa wersja nie zawiera infra/deploy/supabase/docker-compose.yml.');
    return 1;
  }
  return finish(outcome.result, `Zaktualizowano. Aplikacja: ${publicUrls(config).appUrl}`);
}

async function update(ctx: Context): Promise<number> {
  const { env, hosts, options } = ctx;
  return withInstallation(ctx, 'Sarmata: aktualizacja', async (installation) => {
    const run = (runningIsNew: boolean) =>
      applyStagedUpdate(
        { env, hosts, onEvent: progress().onEvent },
        { ...installation, stamp: timestamp(new Date()), runningIsNew },
      );
    // Phase two in the new version's binary, started by the installed one.
    if (options.staged) return updateFinished(await run(true), installation.config);
    const source = updateSource(env, options);
    if (source === null) {
      log.error(
        'Podaj źródło nowej wersji: --from KATALOG, --from PLIK.zip albo --git URL --ref TAG.',
      );
      return 2;
    }
    if (options.dryRun)
      return dryRun(
        planStageSource(env, source),
        'Tryb próbny: pokazano pobranie nowej wersji. Pozostałe kroki planuje nowa wersja.',
      );
    if (!(await proceed('Aktualizacja zatrzyma aplikację na kilka minut. Kontynuować?')))
      return 130;
    const staged = await stageUpdate({ env, hosts, onEvent: progress().onEvent }, source);
    switch (staged.kind) {
      case 'failed':
        return finish(staged.result);
      case 'handover':
        return handOver({ env, hosts }, staged.launcher);
      case 'continue':
        if (staged.warning !== null) log.warn(staged.warning);
        return updateFinished(await run(staged.warning === null), installation.config);
    }
  });
}

async function ai(ctx: Context): Promise<number> {
  const { env, hosts, machine, options } = ctx;
  return withInstallation(ctx, 'Sarmata: moduł AI', async (installation) => {
    const paths = layout(env);
    const upstream = await hosts.engine.readFile(paths.join(paths.source, ...UPSTREAM_COMPOSE));
    if (upstream === null) {
      log.error('W instalacji brakuje infra/deploy/supabase/docker-compose.yml.');
      return 1;
    }
    const current = installation.config.ai;
    const wanted: AiSettings = options.off
      ? { enabled: false }
      : await askAi(env, machine, installation.config.profile, current);
    await applyAi(ctx, installation, wanted, upstream);
    outro('Gotowe.');
    return 0;
  });
}

async function start(ctx: Context): Promise<number> {
  return withInstallation(ctx, 'Sarmata: uruchamianie', ({ config }) =>
    // Native AI runs as system services that start with the system, nothing to do here.
    runPlan(
      ctx,
      planStart(ctx.env, config, { open: ctx.options.open }),
      `Sarmata działa: ${publicUrls(config).appUrl}`,
    ),
  );
}

async function status(ctx: Context): Promise<number> {
  return withInstallation(ctx, 'Sarmata: stan usług', ({ config }) => {
    log.info(`Wersja: ${ctx.env.installedVersion ?? 'nieznana (instalacja z repozytorium)'}`);
    return runPlan(ctx, planStatus(ctx.env, config));
  });
}

async function restore(ctx: Context): Promise<number> {
  const { env, options } = ctx;
  return withInstallation(ctx, 'Sarmata: odtworzenie bazy', async ({ config }) => {
    if (options.file === undefined) {
      log.error('Użycie: sarmata restore PLIK.dump (plik z katalogu backups).');
      return 2;
    }
    const plan = planRestore(env, config, { file: options.file, stamp: timestamp(new Date()) });
    if (options.dryRun) return dryRun(plan);
    if (
      !(await proceed(
        `Zastąpić bieżące dane kopią ${options.file}? Bieżąca baza trafi najpierw do backups.`,
        false,
      ))
    )
      return 130;
    return runPlan(ctx, plan, 'Odtworzono bazę.');
  });
}

async function uninstall(ctx: Context): Promise<number> {
  const { env, hosts, options } = ctx;
  return withInstallation(ctx, 'Sarmata: usuwanie', async ({ config }) => {
    const plan = planUninstall(env, config, {
      purge: options.purge,
      stamp: timestamp(new Date()),
    });
    if (options.dryRun) return dryRun(plan);
    const question = options.purge
      ? 'Usunąć Sarmatę razem z bazą i wszystkimi kopiami? Tego nie da się cofnąć.'
      : 'Usunąć Sarmatę? Końcowa kopia bazy zostanie w katalogu backups.';
    if (!(await proceed(question, false))) return 130;
    const result = await executePlan(plan, hosts, progress().onEvent);
    if (result.status !== 'ok') return finish(result);
    // Services may exist even with AI off (an interrupted "sarmata ai"), so always remove them.
    await executePlan(aiServiceRemovalPlan(env), hosts, progress().onEvent);
    log.info(`Modele AI zostały w ${aiDataDir(env)}. Można usunąć ten katalog ręcznie.`);
    if (env.engineHost === 'wsl')
      log.info(
        `Dystrybucja WSL ${WSL_DISTRO} i ustawienia w %USERPROFILE%\\.wslconfig zostały. Dystrybucję usuwa: wsl --unregister ${WSL_DISTRO}${options.purge ? '' : ' (razem z kopiami w backups, więc najpierw je przenieś)'}.`,
      );
    outro(options.purge ? 'Usunięto.' : `Usunięto. Kopie bazy zostały w ${layout(env).backups}.`);
    return 0;
  });
}

async function render(ctx: Context): Promise<number> {
  const { env, hosts, options } = ctx;
  intro('Sarmata: podgląd konfiguracji');
  if (options.answers === undefined || options.out === undefined) {
    log.error('Użycie: sarmata render --answers PLIK --out KATALOG');
    return 2;
  }
  const upstream = await readUpstream(env, hosts);
  if (upstream === null) return 1;
  const answers = await readAnswers(hosts, options.answers);
  const secrets = secretsFromAnswers(answers, freshSecrets());
  const out = resolve(options.out);
  const join = (...parts: string[]): string => systemPath(env).join(...parts);
  await hosts.system.writeFile(
    join(out, 'compose.yaml'),
    renderCompose(upstream, answers.config, aiRelayPorts(env, answers.config)),
  );
  await hosts.system.writeFile(join(out, '.env'), renderEnv(answers.config, secrets), 0o600);
  if (usesCaddy(answers.config))
    await hosts.system.writeFile(join(out, 'Caddyfile'), renderCaddyfile(answers.config));
  outro(`Zapisano compose.yaml i .env w ${out}`);
  return 0;
}

async function main(args: readonly string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean', default: false },
      answers: { type: 'string' },
      open: { type: 'boolean', default: false },
      from: { type: 'string' },
      git: { type: 'string' },
      ref: { type: 'string' },
      purge: { type: 'boolean', default: false },
      out: { type: 'string' },
      staged: { type: 'boolean', default: false },
      off: { type: 'boolean', default: false },
    },
  });
  const command = positionals[0] ?? 'install';
  if (command === 'help') {
    console.log(USAGE);
    return 0;
  }
  const options: Options = {
    dryRun: values['dry-run'],
    answers: values.answers,
    open: values.open,
    from: values.from,
    git: values.git,
    ref: values.ref,
    purge: values.purge,
    out: values.out,
    staged: values.staged,
    off: values.off,
    file: positionals[1],
  };
  // One adapter for both packages: plans run through it, the AI runtime detects hardware with it.
  const machine = localMachine();
  const system = localHost(machine);
  const env = await detectEnvironment(system, {
    platform: process.platform,
    arch: process.arch,
    execPath: process.execPath,
    userHome: homedir(),
    env: process.env,
  });
  const hosts: Hosts = {
    system,
    engine: env.engineHost === 'wsl' ? wslHost(WSL_DISTRO, system) : system,
  };
  const ctx: Context = { env, hosts, machine, options };
  switch (command) {
    case 'install':
      return install(ctx);
    case 'update':
      return update(ctx);
    case 'start':
      return start(ctx);
    case 'stop':
      return withInstallation(ctx, 'Sarmata: zatrzymanie', ({ config }) =>
        runPlan(ctx, planStop(env, config)),
      );
    case 'status':
      return status(ctx);
    case 'ai':
      return ai(ctx);
    case 'restore':
      return restore(ctx);
    case 'uninstall':
      return uninstall(ctx);
    case 'render':
      return render(ctx);
    default:
      console.error(USAGE);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exit(code);
  },
  (error: unknown) => {
    if (error instanceof WizardCancelled) {
      cancel('Przerwano. Nic nie zmieniono.');
      process.exit(130);
    }
    log.error(errorMessage(error));
    process.exit(1);
  },
);
