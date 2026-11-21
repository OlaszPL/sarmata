import { homedir } from 'node:os';
import { posix } from 'node:path';
import {
  bielikOneCommands,
  defaultDataDir,
  detectHardware,
  installBielikOne,
  installLlamaCpp,
  llamaServerCommand,
  localMachine,
  MODEL_FILES,
  prepareLlamaServer,
  recommendRuntime,
  type ModelId,
  type ProgressEvent,
  type RuntimeContext,
  type RuntimeRecommendation,
} from '@sarmata/ai-runtime';
import { AI_PORT, type InstallConfig, type Profile } from './config.ts';
import { sudoPrefix } from './engine.ts';
import type { Environment } from './environment.ts';
import { runAction, step, type Plan, type Step } from './plan.ts';
import { psQuote } from './shortcut.ts';

export type EnabledAi = Extract<InstallConfig['ai'], { enabled: true }>;

export type AiServiceId = 'llama-server' | 'bielik-one-backend' | 'bielik-one-frontend';
const AI_SERVICE_IDS: readonly AiServiceId[] = [
  'llama-server',
  'bielik-one-backend',
  'bielik-one-frontend',
];

/** A native AI process to run as a system service. */
export interface ServiceCommand {
  readonly id: AiServiceId;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly logFile: string;
}

// Native AI never listens beyond loopback. Containers reach it through host.docker.internal
// (macOS) or the ai-relay container bound to the docker0 gateway (Linux, WSL).
const AI_HOST = '127.0.0.1';

const unitName = (id: AiServiceId): string => `sarmata-ai-${id}.service`;
const launchLabel = (id: AiServiceId): string => `pl.sarmata.ai.${id}`;
const taskName = (id: AiServiceId): string => `Sarmata AI ${id}`;
const isModelId = (id: string): id is ModelId => Object.hasOwn(MODEL_FILES, id);
const systemdQuote = (arg: string): string =>
  `"${arg.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
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

function context(onProgress: (event: ProgressEvent) => void): RuntimeContext {
  const machine = localMachine();
  return { machine, dataDir: defaultDataDir(machine.os, process.env, homedir()), onProgress };
}

/** Tier proposal for the wizard: hardware detection only, no downloads. */
export async function proposeAi(profile: Profile): Promise<RuntimeRecommendation> {
  return recommendRuntime(await detectHardware(localMachine()), profile);
}

/** Installation settings for a proposal, null when the machine is too weak for any model. */
export function aiSettings(recommendation: RuntimeRecommendation): EnabledAi | null {
  if (recommendation.model === null) return null;
  return {
    enabled: true,
    modelId: recommendation.model.id,
    alias: recommendation.model.alias,
    decisionPort: recommendation.bielikOne?.package.port ?? null,
  };
}

/**
 * Plan 5 order: hardware, llama.cpp, hardware again (AMD and Intel GPUs show up only now), model
 * download and device benchmark, then Bielik-One when the settings include it. Returns the
 * processes to register as system services.
 */
export async function installAiRuntime(
  profile: Profile,
  ai: EnabledAi,
  onProgress: (event: ProgressEvent) => void,
): Promise<readonly ServiceCommand[]> {
  const model = ai.modelId;
  if (!isModelId(model)) throw new Error(`Unknown AI model ${model}`);
  const ctx = context(onProgress);
  const first = recommendRuntime(await detectHardware(ctx.machine), profile, { model });
  const llama = await installLlamaCpp(first.llamaCpp, ctx);
  const hardware = await detectHardware(ctx.machine, llama);
  const recommendation = recommendRuntime(hardware, profile, { model });
  const prepared = await prepareLlamaServer(
    {
      llama,
      hardware,
      model: recommendation.model ?? MODEL_FILES[model],
      port: AI_PORT,
      host: AI_HOST,
      ...recommendation.server,
    },
    ctx,
  );
  const llamaServer = llamaServerCommand(prepared.config);
  const services: ServiceCommand[] = [
    { id: 'llama-server', ...llamaServer, env: {}, logFile: prepared.config.logFile },
  ];
  if (ai.decisionPort !== null && recommendation.bielikOne !== null) {
    const install = await installBielikOne(recommendation.bielikOne.engine, ctx);
    const commands = bielikOneCommands(install, recommendation.bielikOne.package, ctx.dataDir);
    services.push(
      { id: 'bielik-one-backend', ...commands.backend },
      { id: 'bielik-one-frontend', ...commands.frontend },
    );
  }
  return services;
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
    `StandardOutput=append:${service.logFile}`,
    `StandardError=append:${service.logFile}`,
    'Restart=on-failure',
    'RestartSec=10',
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

/** Registers the native AI processes so they start with the system: systemd, launchd or a logon task. */
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

/** Unregisters every AI service. Models stay in the AI data directory of plan 5. */
export function aiServiceRemovalPlan(env: Environment): Plan {
  switch (env.os) {
    case 'linux': {
      const sudo = sudoPrefix(env);
      return {
        steps: AI_SERVICE_IDS.flatMap((id) => [
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
        steps: AI_SERVICE_IDS.flatMap((id) => [
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
        steps: AI_SERVICE_IDS.map((id) =>
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

/** Where plan 5 keeps the runtime and the models (for messages). */
export const aiDataDir = (env: Environment): string =>
  defaultDataDir(env.os, process.env, env.userHome);
