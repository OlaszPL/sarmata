import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { posix, resolve, win32 } from 'node:path';
import { parseArgs } from 'node:util';
import { cancel, confirm, intro, isCancel, log, note, outro, spinner } from '@clack/prompts';
import type { ProgressEvent } from '@sarmata/ai-runtime';
import {
  aiDataDir,
  aiRelayPorts,
  aiServicePlan,
  aiServiceRemovalPlan,
  answersSchema,
  binaryName,
  describePlan,
  detectEnvironment,
  executePlan,
  generateSecrets,
  installAiRuntime,
  installConfigSchema,
  layout,
  localHost,
  parseEnv,
  planInstall,
  planStageSource,
  planStart,
  planStatus,
  planStop,
  planUninstall,
  planUpdate,
  publicUrls,
  readSecrets,
  renderCaddyfile,
  renderCompose,
  renderEnv,
  secretsFromAnswers,
  WSL_DISTRO,
  wslHost,
  type Answers,
  type Environment,
  type ExecutionEvent,
  type ExecutionResult,
  type Hosts,
  type InstallConfig,
  type Plan,
  type Secrets,
  type UpdateSource,
} from './index.ts';
import { askInstallAnswers, WizardCancelled } from './wizard.ts';

const USAGE = `Użycie: sarmata <polecenie> [opcje]

  install     kreator instalacji (opcje: --answers PLIK, --dry-run)
  start       uruchomienie (opcja: --open otwiera przeglądarkę)
  stop        zatrzymanie
  status      stan usług
  update      aktualizacja (opcje: --from KATALOG albo PLIK.zip, --git URL --ref TAG, --dry-run)
  uninstall   usunięcie z końcową kopią bazy w backups/ (opcje: --purge, --dry-run)
  render      zapis compose.yaml i .env bez instalacji (opcje: --answers PLIK --out KATALOG)`;

const UPSTREAM_COMPOSE = ['infra', 'deploy', 'supabase', 'docker-compose.yml'] as const;
const NOT_INSTALLED = 'Nie znaleziono instalacji Sarmaty na tym komputerze.';
const EXTERNAL_CHECKLIST =
  'W panelu projektu Supabase: włącz hook Custom Access Token z funkcją access.custom_access_token_hook, ' +
  'ustaw Site URL na adres aplikacji i skonfiguruj SMTP dla e-maili logowania.';

interface Options {
  readonly dryRun: boolean;
  readonly answers: string | undefined;
  readonly open: boolean;
  readonly from: string | undefined;
  readonly git: string | undefined;
  readonly ref: string | undefined;
  readonly purge: boolean;
  readonly out: string | undefined;
}

interface Installation {
  readonly config: InstallConfig;
  readonly secrets: Secrets;
}

const systemPath = (env: Environment): typeof posix => (env.os === 'windows' ? win32 : posix);
const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
const timestamp = (date: Date): string =>
  date.toISOString().slice(0, 19).replaceAll('-', '').replaceAll(':', '').replace('T', '-');

function progressText(event: ProgressEvent): string {
  if (event.kind === 'step') return event.message;
  const percent =
    event.totalBytes === 0 ? 100 : Math.floor((event.receivedBytes * 100) / event.totalBytes);
  return `${event.file}: ${percent}%`;
}

function progress(): (event: ExecutionEvent) => void {
  const indicator = spinner();
  let spinning = false;
  const settle = (message: string): void => {
    if (spinning) {
      indicator.stop(message);
      spinning = false;
    }
  };
  return (event) => {
    switch (event.type) {
      case 'start':
        if (event.step.action.kind === 'run' && event.step.action.interactive === true) {
          log.step(event.step.title);
        } else {
          indicator.start(event.step.title);
          spinning = true;
        }
        return;
      case 'done':
        settle(event.step.title);
        return;
      case 'fail':
        settle(event.step.title);
        log.error(`Błąd: ${event.message}`);
        return;
      case 'rollback':
        log.warn(`Wycofywanie: ${event.step.title}`);
        return;
      case 'rollback-fail':
        log.error(`Nie udało się wycofać: ${event.step.title}: ${event.message}`);
        return;
    }
  };
}

function finish(result: ExecutionResult): number {
  switch (result.status) {
    case 'ok':
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

function summary(config: InstallConfig): string {
  return [
    `Profil: ${config.profile}`,
    `Supabase: ${config.supabase.mode === 'local' ? 'na tym komputerze' : config.supabase.url}`,
    `Adres aplikacji: ${publicUrls(config).appUrl}`,
    `SMTP: ${config.smtp.enabled ? config.smtp.host : 'brak, powiadomienia tylko w aplikacji'}`,
    `AI: ${config.ai.enabled ? config.ai.alias : 'wyłączone'}`,
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
    secrets: readSecrets(parseEnv(envText)),
  };
}

/** Installs the AI runtime and registers its system services. AI problems never fail the installation. */
async function setUpAi(env: Environment, hosts: Hosts, config: InstallConfig): Promise<void> {
  if (!config.ai.enabled) return;
  const indicator = spinner();
  indicator.start('Instalacja modułu AI (pobieranie modelu może potrwać)');
  let installed = false;
  try {
    const services = await installAiRuntime(config.profile, config.ai, (event) => {
      indicator.message(progressText(event));
    });
    installed = true;
    indicator.stop('Model AI pobrany i sprawdzony');
    const result = await executePlan(aiServicePlan(env, services), hosts, progress());
    if (result.status !== 'ok') throw new Error(result.message);
  } catch (error) {
    if (!installed) indicator.stop('Moduł AI nie działa');
    log.warn(
      `Aplikacja działa bez AI. Szczegóły: ${errorMessage(error)}. Usługi AI można dograć, instalując ponownie z tej paczki.`,
    );
  }
}

async function install(env: Environment, hosts: Hosts, options: Options): Promise<number> {
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
      ? await askInstallAnswers(env)
      : await readAnswers(hosts, options.answers);
  const secrets = secretsFromAnswers(answers, generateSecrets(randomBytes, new Date()));
  const plan = planInstall({
    env,
    config: answers.config,
    secrets,
    upstreamCompose: upstream,
    adminPassword: answers.adminPassword,
  });
  if (options.dryRun) return dryRun(plan);
  note(summary(answers.config), 'Podsumowanie');
  if (!(await proceed('Rozpocząć instalację?'))) return 130;
  const result = await executePlan(plan, hosts, progress());
  if (result.status !== 'ok') return finish(result);
  await setUpAi(env, hosts, answers.config);
  if (answers.config.supabase.mode === 'external') note(EXTERNAL_CHECKLIST, 'Zewnętrzne Supabase');
  outro(
    `Gotowe. Otwórz ${publicUrls(answers.config).appUrl} i zaloguj się jako ${answers.config.admin.email}.`,
  );
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

function newLauncher(env: Environment, source: UpdateSource): string | null {
  const binary = binaryName(env.os, env.arch);
  if (source.kind === 'dir')
    return systemPath(env).join(source.path, 'infra', 'deploy', 'dist', binary);
  if (source.kind === 'zip' && env.engineHost === 'local') {
    const paths = layout(env);
    return paths.join(paths.source, 'infra', 'deploy', 'dist', binary);
  }
  return null;
}

async function update(env: Environment, hosts: Hosts, options: Options): Promise<number> {
  intro('Sarmata: aktualizacja');
  const installation = await readInstallation(env, hosts);
  if (installation === null) {
    log.error(NOT_INSTALLED);
    return 1;
  }
  const source = updateSource(env, options);
  if (source === null) {
    log.error(
      'Podaj źródło nowej wersji: --from KATALOG, --from PLIK.zip albo --git URL --ref TAG.',
    );
    return 2;
  }
  const stage = planStageSource(env, source);
  if (options.dryRun)
    return dryRun(
      stage,
      'Tryb próbny: pokazano pobranie nowej wersji. Pozostałe kroki zależą od jej plików.',
    );
  if (!(await proceed('Aktualizacja zatrzyma aplikację na kilka minut. Kontynuować?'))) return 130;
  const staged = await executePlan(stage, hosts, progress());
  if (staged.status !== 'ok') return finish(staged);
  const paths = layout(env);
  const upstream = await hosts.engine.readFile(paths.join(paths.sourceNext, ...UPSTREAM_COMPOSE));
  if (upstream === null) {
    log.error('Nowa wersja nie zawiera infra/deploy/supabase/docker-compose.yml.');
    return 1;
  }
  const plan = planUpdate({
    env,
    ...installation,
    upstreamCompose: upstream,
    stamp: timestamp(new Date()),
    newLauncher: newLauncher(env, source),
  });
  const result = await executePlan(plan, hosts, progress());
  if (result.status !== 'ok') return finish(result);
  outro(`Zaktualizowano. Aplikacja: ${publicUrls(installation.config).appUrl}`);
  return 0;
}

async function start(env: Environment, hosts: Hosts, options: Options): Promise<number> {
  intro('Sarmata: uruchamianie');
  const installation = await readInstallation(env, hosts);
  if (installation === null) {
    log.error(NOT_INSTALLED);
    return 1;
  }
  const { config } = installation;
  // Native AI runs as system services and starts with the system, nothing to do here.
  const result = await executePlan(
    planStart(env, config, { open: options.open }),
    hosts,
    progress(),
  );
  if (result.status !== 'ok') return finish(result);
  outro(`Sarmata działa: ${publicUrls(config).appUrl}`);
  return 0;
}

async function simple(
  env: Environment,
  hosts: Hosts,
  title: string,
  planFor: (env: Environment, config: InstallConfig) => Plan,
): Promise<number> {
  intro(title);
  const installation = await readInstallation(env, hosts);
  if (installation === null) {
    log.error(NOT_INSTALLED);
    return 1;
  }
  const result = await executePlan(planFor(env, installation.config), hosts, progress());
  if (result.status !== 'ok') return finish(result);
  outro('Gotowe.');
  return 0;
}

async function uninstall(env: Environment, hosts: Hosts, options: Options): Promise<number> {
  intro('Sarmata: usuwanie');
  const installation = await readInstallation(env, hosts);
  if (installation === null) {
    log.error(NOT_INSTALLED);
    return 1;
  }
  const plan = planUninstall(env, installation.config, {
    purge: options.purge,
    stamp: timestamp(new Date()),
  });
  if (options.dryRun) return dryRun(plan);
  const question = options.purge
    ? 'Usunąć Sarmatę razem z bazą i wszystkimi kopiami? Tego nie da się cofnąć.'
    : 'Usunąć Sarmatę? Końcowa kopia bazy zostanie w katalogu backups.';
  if (!(await proceed(question, false))) return 130;
  const result = await executePlan(plan, hosts, progress());
  if (result.status !== 'ok') return finish(result);
  if (installation.config.ai.enabled) {
    await executePlan(aiServiceRemovalPlan(env), hosts, progress());
    log.info(`Modele AI zostały w ${aiDataDir(env)}. Można usunąć ten katalog ręcznie.`);
  }
  outro(options.purge ? 'Usunięto.' : `Usunięto. Kopie bazy zostały w ${layout(env).backups}.`);
  return 0;
}

async function render(env: Environment, hosts: Hosts, options: Options): Promise<number> {
  intro('Sarmata: podgląd konfiguracji');
  if (options.answers === undefined || options.out === undefined) {
    log.error('Użycie: sarmata render --answers PLIK --out KATALOG');
    return 2;
  }
  const upstream = await readUpstream(env, hosts);
  if (upstream === null) return 1;
  const answers = await readAnswers(hosts, options.answers);
  const secrets = secretsFromAnswers(answers, generateSecrets(randomBytes, new Date()));
  const out = resolve(options.out);
  const join = (...parts: string[]): string => systemPath(env).join(...parts);
  await hosts.system.writeFile(
    join(out, 'compose.yaml'),
    renderCompose(upstream, answers.config, aiRelayPorts(env, answers.config)),
  );
  await hosts.system.writeFile(join(out, '.env'), renderEnv(answers.config, secrets), 0o600);
  if (answers.config.profile === 'server')
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
  };
  const system = localHost();
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
  switch (command) {
    case 'install':
      return install(env, hosts, options);
    case 'update':
      return update(env, hosts, options);
    case 'start':
      return start(env, hosts, options);
    case 'stop':
      return simple(env, hosts, 'Sarmata: zatrzymanie', planStop);
    case 'status':
      return simple(env, hosts, 'Sarmata: stan usług', planStatus);
    case 'uninstall':
      return uninstall(env, hosts, options);
    case 'render':
      return render(env, hosts, options);
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
