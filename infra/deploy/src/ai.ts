import { posix } from 'node:path';
import {
  bielikOneCommands,
  defaultDataDir,
  detectHardware,
  installBielikOne,
  installLlamaCpp,
  llamaServerCommand,
  MODEL_FILES,
  prepareLlamaServer,
  recommendRuntime,
  runtimeChoices,
  type InstallProfile,
  type Machine,
  type ModelId,
  type RuntimeContext,
  type RuntimeRecommendation,
} from '@sarmata/ai-runtime';
import { AI_PORT, NATIVE_AI_BIND, type EnabledAi } from './config.ts';
import { sudoPrefix } from './engine.ts';
import { lacksMirroredNetworking, type Environment } from './environment.ts';
import { haltPlan, runAction, step, type Plan, type Step } from './plan.ts';
import { psQuote } from './shortcut.ts';

export type AiServiceId = 'llama-server' | 'bielik-one-backend' | 'bielik-one-frontend';
export const TEXT_SERVICES: readonly AiServiceId[] = ['llama-server'];
export const DECISION_SERVICES: readonly AiServiceId[] = [
  'bielik-one-backend',
  'bielik-one-frontend',
];
const AI_SERVICE_IDS: readonly AiServiceId[] = [...TEXT_SERVICES, ...DECISION_SERVICES];

/** A native AI process to run as a system service. */
export interface ServiceCommand {
  readonly id: AiServiceId;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly logFile: string;
}

/** uv release the installer downloads when uv is missing (ADR 0003: Python goes through uv). */
export const UV_INSTALLER = 'https://astral.sh/uv/0.13.9/install.sh';

const unitName = (id: AiServiceId): string => `sarmata-ai-${id}.service`;
const launchLabel = (id: AiServiceId): string => `pl.sarmata.ai.${id}`;
const taskName = (id: AiServiceId): string => `Sarmata AI ${id}`;
const isModelId = (id: string): id is ModelId => Object.hasOwn(MODEL_FILES, id);
// systemd expands % specifiers everywhere and $VARIABLES in ExecStart: both doubled stay literal.
// A function replacement: in a replacement string "$$" itself means one dollar sign.
const systemdEscape = (text: string): string =>
  text.replaceAll('%', '%%').replaceAll('$', () => '$$');
const systemdQuote = (arg: string): string =>
  `"${systemdEscape(arg).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
const windowsArg = (arg: string): string =>
  /[\s"]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg;
const xml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const launchAgentPath = (env: Environment, id: AiServiceId): string =>
  posix.join(env.userHome, 'Library', 'LaunchAgents', `${launchLabel(id)}.plist`);

/** Where @sarmata/ai-runtime keeps the runtime, the models and the logs of this account. */
export const aiDataDir = (env: Environment): string =>
  defaultDataDir(env.os, process.env, env.userHome);

/**
 * Why AI cannot run on this computer, null when it can. On Windows 10 the WSL engine cannot reach
 * a native server on the Windows loopback (no mirrored networking).
 */
export function aiUnsupportedReason(env: Environment): string | null {
  return lacksMirroredNetworking(env)
    ? 'Moduł AI z WSL wymaga Windows 11 22H2 lub nowszego (tryb sieci mirrored).'
    : null;
}

/** Models the wizard offers: the recommended tier first, then the other fitting ones. */
export interface AiProposal {
  readonly choices: readonly RuntimeRecommendation[];
  /** Why the first choice, or why there is none. */
  readonly reason: string;
  readonly enabledByDefault: boolean;
}

/** Hardware detection only, no downloads. */
export async function proposeAi(machine: Machine, profile: InstallProfile): Promise<AiProposal> {
  const hardware = await detectHardware(machine);
  const recommended = recommendRuntime(hardware, profile);
  return {
    choices: runtimeChoices(hardware, profile),
    reason: recommended.reason,
    enabledByDefault: recommended.enabledByDefault,
  };
}

/** Installation settings for a chosen model, with Bielik-One only when it fits and is wanted. */
export function aiSettings(
  recommendation: RuntimeRecommendation,
  decisions: boolean,
): EnabledAi | null {
  if (recommendation.model === null) return null;
  return {
    enabled: true,
    modelId: recommendation.model.id,
    alias: recommendation.model.alias,
    decisionPort: decisions ? (recommendation.bielikOne?.package.port ?? null) : null,
  };
}

function modelOf(ai: EnabledAi): ModelId {
  if (!isModelId(ai.modelId)) throw new Error(`Unknown AI model ${ai.modelId}`);
  return ai.modelId;
}

/**
 * The text model: hardware, llama.cpp, hardware again (AMD and Intel GPUs show up only through
 * llama-server --list-devices), model download and device benchmark. Returns llama-server as a
 * service to register.
 */
export async function installTextRuntime(
  ctx: RuntimeContext,
  profile: InstallProfile,
  ai: EnabledAi,
): Promise<ServiceCommand> {
  const model = modelOf(ai);
  const first = recommendRuntime(await detectHardware(ctx.machine), profile, { model });
  const llama = await installLlamaCpp(first.llamaCpp, ctx);
  const hardware = await detectHardware(ctx.machine, llama);
  const recommendation = recommendRuntime(hardware, profile, { model });
  const prepared = await prepareLlamaServer(
    {
      llama,
      hardware,
      model: MODEL_FILES[model],
      port: AI_PORT,
      host: NATIVE_AI_BIND,
      ...recommendation.server,
    },
    ctx,
  );
  const llamaServer = llamaServerCommand(prepared.config);
  return { id: 'llama-server', ...llamaServer, env: {}, logFile: prepared.config.logFile };
}

/** Bielik-One (vLLM or MLX) next to the text model, installed with the given uv. */
export async function installDecisionRuntime(
  ctx: RuntimeContext,
  profile: InstallProfile,
  ai: EnabledAi,
  uv: string,
): Promise<readonly ServiceCommand[]> {
  const recommendation = recommendRuntime(await detectHardware(ctx.machine), profile, {
    model: modelOf(ai),
  });
  const decision = recommendation.bielikOne;
  if (decision === null) throw new Error('Bielik-One does not fit next to the text model here');
  const install = await installBielikOne(decision.engine, ctx, { uv });
  const commands = bielikOneCommands(install, decision.package, ctx.dataDir);
  return [
    { id: 'bielik-one-backend', ...commands.backend },
    { id: 'bielik-one-frontend', ...commands.frontend },
  ];
}

/** Steps that install uv for Bielik-One, and the uv command to use afterwards. */
export function uvInstall(env: Environment, dataDir: string): { plan: Plan; command: string } {
  if (env.os === 'windows')
    return { plan: haltPlan('Bielik-One nie działa na Windows.'), command: 'uv' };
  if (env.os === 'macos' && env.brewPrefix !== null) {
    return {
      plan: {
        steps: [
          step(
            'Instalacja uv z Homebrew',
            'system',
            runAction(['brew', 'install', 'uv'], { interactive: true }),
          ),
        ],
      },
      command: posix.join(env.brewPrefix, 'bin', 'uv'),
    };
  }
  // The official installer of a pinned release, into the AI data directory, without touching PATH.
  const dir = posix.join(dataDir, 'uv');
  return {
    plan: {
      steps: [
        step(
          'Instalacja uv (menedżer Pythona dla Bielik-One)',
          'system',
          runAction([
            'sh',
            '-c',
            'curl -LsSf "$1" | env UV_INSTALL_DIR="$2" UV_NO_MODIFY_PATH=1 sh',
            'sh',
            UV_INSTALLER,
            dir,
          ]),
        ),
      ],
    },
    command: posix.join(dir, 'uv'),
  };
}

function linuxSteps(env: Environment, service: ServiceCommand): Step[] {
  const sudo = sudoPrefix(env);
  const unit = [
    '[Unit]',
    `Description=Sarmata AI (${service.id})`,
    'After=network-online.target',
    '',
    '[Service]',
    `User=${env.user.name}`,
    ...Object.entries(service.env).map(
      ([key, value]) => `Environment=${systemdQuote(`${key}=${value}`)}`,
    ),
    `ExecStart=${[service.command, ...service.args].map(systemdQuote).join(' ')}`,
    `StandardOutput=append:${systemdEscape(service.logFile)}`,
    `StandardError=append:${systemdEscape(service.logFile)}`,
    'Restart=on-failure',
    'RestartSec=10',
    // The runtime writes only its data directory and caches in the account's home.
    'NoNewPrivileges=yes',
    'ProtectSystem=full',
    'PrivateTmp=yes',
    '',
    '[Install]',
    'WantedBy=multi-user.target',
    '',
  ].join('\n');
  return [
    step(
      `Zapis usługi systemowej ${service.id} (systemd)`,
      'system',
      runAction([...sudo, 'sh', '-c', `cat > /etc/systemd/system/${unitName(service.id)}`], {
        stdin: unit,
      }),
    ),
    step(
      `Uruchomienie usługi ${service.id}`,
      'system',
      runAction([...sudo, 'systemctl', 'enable', '--now', unitName(service.id)]),
    ),
  ];
}

function macSteps(env: Environment, service: ServiceCommand): Step[] {
  const plist = launchAgentPath(env, service.id);
  const environment = Object.entries(service.env);
  const content = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key><string>${launchLabel(service.id)}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    ...[service.command, ...service.args].map((arg) => `    <string>${xml(arg)}</string>`),
    '  </array>',
    ...(environment.length > 0
      ? [
          '  <key>EnvironmentVariables</key>',
          '  <dict>',
          ...environment.map(
            ([key, value]) => `    <key>${xml(key)}</key><string>${xml(value)}</string>`,
          ),
          '  </dict>',
        ]
      : []),
    '  <key>RunAtLoad</key><true/>',
    '  <key>KeepAlive</key><true/>',
    `  <key>StandardOutPath</key><string>${xml(service.logFile)}</string>`,
    `  <key>StandardErrorPath</key><string>${xml(service.logFile)}</string>`,
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
  return [
    step(`Zapis usługi ${service.id} (launchd)`, 'system', { kind: 'write', path: plist, content }),
    step(
      `Zatrzymanie poprzedniej usługi ${service.id}`,
      'system',
      runAction(['launchctl', 'unload', plist], { allowFailure: true }),
    ),
    step(
      `Uruchomienie usługi ${service.id}`,
      'system',
      runAction(['launchctl', 'load', '-w', plist]),
    ),
  ];
}

function windowsSteps(service: ServiceCommand): Step[] {
  // Bielik-One runs only on vLLM (Linux) and MLX (macOS), llama-server needs no variables.
  if (Object.keys(service.env).length > 0)
    throw new Error(`${service.id}: environment variables are not supported on Windows`);
  const script = [
    `$action = New-ScheduledTaskAction -Execute ${psQuote(service.command)} -Argument ${psQuote(service.args.map(windowsArg).join(' '))}`,
    '$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME',
    '$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)',
    `Register-ScheduledTask -TaskName ${psQuote(taskName(service.id))} -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null`,
    `Start-ScheduledTask -TaskName ${psQuote(taskName(service.id))}`,
  ].join('; ');
  return [
    step(
      `Rejestracja zadania ${service.id} przy logowaniu`,
      'system',
      runAction(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script]),
    ),
  ];
}

/**
 * Registers native AI processes so they start with the system: systemd units on Linux, launch
 * agents on macOS, logon tasks on Windows (ADR 0003).
 */
export function aiServicePlan(env: Environment, services: readonly ServiceCommand[]): Plan {
  switch (env.os) {
    case 'linux':
      return {
        steps: [
          ...services.flatMap((service) => linuxSteps(env, service).slice(0, 1)),
          step(
            'Odświeżenie usług systemd',
            'system',
            runAction([...sudoPrefix(env), 'systemctl', 'daemon-reload']),
          ),
          ...services.flatMap((service) => linuxSteps(env, service).slice(1)),
        ],
      };
    case 'macos':
      return { steps: services.flatMap((service) => macSteps(env, service)) };
    case 'windows':
      return { steps: services.flatMap(windowsSteps) };
  }
}

/** Unregisters AI services (all by default). Models stay in the AI data directory. */
export function aiServiceRemovalPlan(
  env: Environment,
  ids: readonly AiServiceId[] = AI_SERVICE_IDS,
): Plan {
  switch (env.os) {
    case 'linux': {
      const sudo = sudoPrefix(env);
      return {
        steps: ids.flatMap((id) => [
          step(
            `Zatrzymanie usługi ${id}`,
            'system',
            runAction([...sudo, 'systemctl', 'disable', '--now', unitName(id)], {
              allowFailure: true,
            }),
          ),
          step(
            `Usunięcie usługi ${id}`,
            'system',
            runAction([...sudo, 'rm', '-f', `/etc/systemd/system/${unitName(id)}`]),
          ),
        ]),
      };
    }
    case 'macos':
      return {
        steps: ids.flatMap((id) => [
          step(
            `Zatrzymanie usługi ${id}`,
            'system',
            runAction(['launchctl', 'unload', launchAgentPath(env, id)], { allowFailure: true }),
          ),
          step(`Usunięcie usługi ${id}`, 'system', {
            kind: 'remove',
            path: launchAgentPath(env, id),
          }),
        ]),
      };
    case 'windows':
      return {
        steps: ids.map((id) =>
          step(
            `Usunięcie zadania ${id}`,
            'system',
            runAction(
              [
                'powershell.exe',
                '-NoProfile',
                '-NonInteractive',
                '-Command',
                `Unregister-ScheduledTask -TaskName ${psQuote(taskName(id))} -Confirm:$false`,
              ],
              { allowFailure: true },
            ),
          ),
        ),
      };
  }
}
