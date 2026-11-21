import { posix, win32 } from 'node:path';
import type { InstallConfig } from './config.ts';
import {
  lacksMirroredNetworking,
  WSL_DISTRO,
  WSL_IMAGE,
  type EngineStatus,
  type Environment,
  type LinuxDistro,
} from './environment.ts';
import { haltStep, runAction, step, type Step } from './plan.ts';
import { PROFILE_TABLE, usesCaddy } from './profiles.ts';
import { psQuote } from './shortcut.ts';

export interface EngineSetup {
  readonly steps: readonly Step[];
  /** Prefix for docker commands after these steps, e.g. sudo right after installing on Linux. */
  readonly dockerPrefix: readonly string[];
  /** The steps end with a halt: nothing after them may run. */
  readonly halted: boolean;
}

const MESSAGES = {
  macMissing:
    'Nie znaleziono silnika kontenerów ani Homebrew. Na macOS zainstaluj Docker Desktop (jeśli urząd ma licencję) albo Homebrew (https://brew.sh), a potem uruchom install.sh ponownie: kreator sam zainstaluje Colima.',
  linuxUnsupported:
    'Kreator instaluje Docker Engine na Ubuntu, Debianie, Fedorze i RHEL oraz zgodnych. Na tym systemie zainstaluj Docker Engine według https://docs.docker.com/engine/install/ i uruchom install.sh ponownie.',
  desktopStopped:
    'Docker Desktop jest zainstalowany, ale nie działa. Uruchom go, poczekaj, aż będzie gotowy, i uruchom kreator ponownie.',
  rebootAfterWsl: 'Zainstalowano WSL2. Uruchom ponownie komputer, a potem jeszcze raz install.bat.',
  engineMissing:
    'Nie znaleziono silnika kontenerów. Uruchom instalację ponownie: install.sh albo install.bat.',
  lanNeedsWindows11:
    'Dostęp z sieci urzędu przez WSL wymaga Windows 11 22H2 lub nowszego (tryb sieci mirrored). Na Windows 10 wybierz dostęp tylko z tego komputera albo zainstaluj Sarmatę na serwerze z Linuksem.',
} as const;

const conflictsMessage = (packages: readonly string[]): string =>
  `Docker Engine nie zainstaluje się obok pakietów: ${packages.join(', ')} (konflikt z containerd.io). Usuń je poleceniem sudo dnf remove ${packages.join(' ')} i uruchom install.sh ponownie.`;

const WSL_CONF = '[boot]\nsystemd=true\n\n[user]\ndefault=root\n';
// Hyper-V firewall rules for WSL carry this creator id (learn.microsoft.com/windows/wsl/networking).
const WSL_VM_CREATOR_ID = '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}';
/** Name of the Hyper-V firewall rule and of the logon task that wakes the WSL distro. */
export const WINDOWS_RULE = 'Sarmata';
export const WSL_AUTOSTART_TASK = 'Sarmata WSL';
// Caddy publishes these in every installation reachable from the LAN (profiles.ts, usesCaddy).
const HTTPS_PORTS: readonly number[] = [80, 443];

const ready = (steps: readonly Step[], dockerPrefix: readonly string[]): EngineSetup => ({
  steps,
  dockerPrefix,
  halted: false,
});
const haltSetup = (steps: readonly Step[], message: string): EngineSetup => ({
  steps: [...steps, haltStep(message)],
  dockerPrefix: [],
  halted: true,
});

/** Linux as a regular user needs sudo for root work. WSL steps already run as root. */
export function sudoPrefix(env: Environment): readonly string[] {
  return env.os === 'linux' && env.engineHost === 'local' && !env.user.isRoot ? ['sudo'] : [];
}

/** Elevated PowerShell through a UAC prompt, the script passed encoded so no quoting can break it. */
export function elevatedPowerShell(title: string, script: string, allowFailure = false): Step {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return step(
    title,
    'system',
    runAction(
      [
        'powershell.exe',
        '-NoProfile',
        '-Command',
        `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-EncodedCommand','${encoded}'`,
      ],
      { interactive: true, allowFailure },
    ),
  );
}

/** Official repositories from docs.docker.com/engine/install (checked 21.11.2026). */
export function dockerInstallScript(distro: LinuxDistro): string {
  const packages =
    'docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin';
  if (distro.family === 'apt') {
    const suite =
      distro.id === 'ubuntu' ? '${UBUNTU_CODENAME:-$VERSION_CODENAME}' : '$VERSION_CODENAME';
    return [
      'set -eu',
      'export DEBIAN_FRONTEND=noninteractive',
      'apt-get update',
      'apt-get install -y ca-certificates curl git unzip',
      'install -m 0755 -d /etc/apt/keyrings',
      `curl -fsSL https://download.docker.com/linux/${distro.id}/gpg -o /etc/apt/keyrings/docker.asc`,
      'chmod a+r /etc/apt/keyrings/docker.asc',
      '. /etc/os-release',
      `printf 'Types: deb\\nURIs: https://download.docker.com/linux/${distro.id}\\nSuites: %s\\nComponents: stable\\nArchitectures: %s\\nSigned-By: /etc/apt/keyrings/docker.asc\\n' "${suite}" "$(dpkg --print-architecture)" > /etc/apt/sources.list.d/docker.sources`,
      'apt-get update',
      `apt-get install -y ${packages}`,
      'systemctl enable --now docker',
    ].join('\n');
  }
  const addRepo =
    distro.id === 'fedora'
      ? 'dnf config-manager addrepo --from-repofile https://download.docker.com/linux/fedora/docker-ce.repo'
      : 'dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo';
  return [
    'set -eu',
    'dnf -y install dnf-plugins-core git unzip',
    `[ -f /etc/yum.repos.d/docker-ce.repo ] || ${addRepo}`,
    `dnf -y install ${packages}`,
    'systemctl enable --now docker',
  ].join('\n');
}

const installDocker = (distro: LinuxDistro, sudo: readonly string[]): Step =>
  step(
    'Instalacja Docker Engine z oficjalnego repozytorium Dockera',
    'engine',
    runAction([...sudo, 'sh', '-c', dockerInstallScript(distro)], { interactive: true }),
  );

/** Sets key=value in an INI section, adding the section or key when missing. */
export function setIniValue(text: string, section: string, key: string, value: string): string {
  const normalized = text.replaceAll('\r\n', '\n').replace(/\n+$/, '');
  const lines = normalized === '' ? [] : normalized.split('\n');
  const start = lines.findIndex(
    (line) => line.trim().toLowerCase() === `[${section}]`.toLowerCase(),
  );
  if (start === -1)
    return (
      [...lines, ...(lines.length > 0 ? [''] : []), `[${section}]`, `${key}=${value}`].join('\n') +
      '\n'
    );
  const next = lines.findIndex((line, index) => index > start && line.trim().startsWith('['));
  const end = next === -1 ? lines.length : next;
  const existing = lines.findIndex(
    (line, index) =>
      index > start &&
      index < end &&
      line.split('=')[0]?.trim().toLowerCase() === key.toLowerCase(),
  );
  if (existing !== -1) {
    lines[existing] = `${key}=${value}`;
  } else {
    let insertAt = end;
    while (insertAt > start + 1 && lines[insertAt - 1]?.trim() === '') insertAt -= 1;
    lines.splice(insertAt, 0, `${key}=${value}`);
  }
  return lines.join('\n') + '\n';
}

const shutdownWsl = step(
  'Ponowne uruchomienie WSL z nowymi ustawieniami',
  'system',
  runAction(['wsl.exe', '--shutdown']),
);

// After wsl --shutdown the next command boots the distro before systemd has started Docker.
const waitForDocker = step(
  'Oczekiwanie na Docker Engine w WSL',
  'engine',
  runAction([
    'sh',
    '-c',
    'for i in $(seq 120); do docker info >/dev/null 2>&1 && exit 0; sleep 1; done; echo "Docker Engine did not start" >&2; exit 1',
  ]),
);

function hyperVFirewall(ports: readonly number[]): Step {
  return elevatedPowerShell(
    'Reguła zapory Hyper-V dla dostępu z sieci urzędu',
    `if (-not (Get-NetFirewallHyperVRule -Name '${WINDOWS_RULE}' -ErrorAction SilentlyContinue)) { New-NetFirewallHyperVRule -Name '${WINDOWS_RULE}' -DisplayName '${WINDOWS_RULE}' -Direction Inbound -VMCreatorId '${WSL_VM_CREATOR_ID}' -Protocol TCP -LocalPorts ${ports.join(',')} }`,
  );
}

/** The new %USERPROFILE%\.wslconfig, or null when nothing changes. */
function nextWslConfig(
  env: Environment,
  config: Pick<InstallConfig, 'exposure' | 'ai'>,
): string | null {
  const current = env.wslConfig ?? '';
  // The distro keeps running after the wizard exits, so the stack stays up.
  let next = setIniValue(current, 'general', 'instanceIdleTimeout', '-1');
  // Mirrored networking: LAN access, and WSL loopback reaching llama-server on Windows for ai-relay.
  if (config.exposure === 'lan' || config.ai.enabled)
    next = setIniValue(next, 'wsl2', 'networkingMode', 'mirrored');
  return next === current ? null : next;
}

/**
 * What the wizard changes in .wslconfig, for the summary before it starts: the file holds the
 * settings of every WSL distro of the account. Null when nothing changes.
 */
export function wslConfigNote(
  env: Environment,
  config: Pick<InstallConfig, 'exposure' | 'ai'>,
): string | null {
  if (env.engineHost !== 'wsl' || nextWslConfig(env, config) === null) return null;
  const mirrored = config.exposure === 'lan' || config.ai.enabled;
  return `Kreator zmieni ${win32.join(env.userHome, '.wslconfig')}: WSL będzie działać w tle (instanceIdleTimeout=-1)${mirrored ? ' z siecią mirrored' : ''}. Te ustawienia dotyczą wszystkich dystrybucji WSL tego konta.`;
}

/** Writes .wslconfig and restarts WSL when the settings change, then waits for Docker again. */
export function wslSettingSteps(
  env: Environment,
  config: Pick<InstallConfig, 'exposure' | 'ai'>,
  options: { readonly dockerInstalled: boolean },
): Step[] {
  if (env.engineHost !== 'wsl') return [];
  const next = nextWslConfig(env, config);
  if (next === null) return [];
  return [
    step('Ustawienia WSL (praca w tle, sieć)', 'system', {
      kind: 'write',
      path: win32.join(env.userHome, '.wslconfig'),
      content: next,
    }),
    shutdownWsl,
    ...(options.dockerInstalled ? [waitForDocker] : []),
  ];
}

/** A logon task wakes the WSL distro, so the stack comes back after a reboot without the shortcut. */
export function wslAutostart(env: Environment): Step[] {
  if (env.engineHost !== 'wsl') return [];
  const script = [
    `$action = New-ScheduledTaskAction -Execute 'wsl.exe' -Argument '-d ${WSL_DISTRO} --exec /bin/true'`,
    '$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME',
    `Register-ScheduledTask -TaskName ${psQuote(WSL_AUTOSTART_TASK)} -Action $action -Trigger $trigger -Force | Out-Null`,
  ].join('; ');
  return [
    step(
      'Uruchamianie WSL po zalogowaniu',
      'system',
      runAction(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script]),
    ),
  ];
}

/** Removes the Windows parts of a WSL installation: the logon task and the firewall rule. */
export function wslRemovalSteps(env: Environment): Step[] {
  if (env.engineHost !== 'wsl') return [];
  return [
    step(
      'Usunięcie zadania uruchamiającego WSL',
      'system',
      runAction(
        [
          'powershell.exe',
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `Unregister-ScheduledTask -TaskName ${psQuote(WSL_AUTOSTART_TASK)} -Confirm:$false`,
        ],
        { allowFailure: true },
      ),
    ),
    elevatedPowerShell(
      'Usunięcie reguły zapory Hyper-V',
      `Remove-NetFirewallHyperVRule -Name '${WINDOWS_RULE}' -ErrorAction SilentlyContinue`,
      true,
    ),
  ];
}

function startStopped(
  env: Environment,
  vendor: Extract<EngineStatus, { state: 'stopped' }>['vendor'],
): EngineSetup {
  switch (vendor) {
    case 'docker-desktop':
      return haltSetup([], MESSAGES.desktopStopped);
    case 'colima':
      return ready(
        [
          step(
            'Uruchamianie Colima',
            'system',
            runAction(['colima', 'start'], { interactive: true }),
          ),
        ],
        [],
      );
    case 'linux-service': {
      const sudo = sudoPrefix(env);
      return ready(
        [
          step(
            'Uruchamianie usługi Docker',
            'engine',
            runAction([...sudo, 'systemctl', 'enable', '--now', 'docker'], {
              interactive: sudo.length > 0,
            }),
          ),
        ],
        sudo,
      );
    }
  }
}

/**
 * ~/.docker/config.json with Homebrew's plugin directory, so "docker compose" and "docker buildx"
 * find the Homebrew plugins. Null when it is already there. Throws on a file that is not JSON.
 */
export function dockerCliConfigWithPlugins(
  current: string | null,
  brewPrefix: string,
): string | null {
  const pluginDir = posix.join(brewPrefix, 'lib', 'docker', 'cli-plugins');
  const parsed: unknown = current === null || current.trim() === '' ? {} : JSON.parse(current);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new Error('~/.docker/config.json is not a JSON object');
  const settings = parsed as Record<string, unknown>;
  const listed: unknown = settings.cliPluginsExtraDirs;
  const dirs: readonly unknown[] = Array.isArray(listed) ? listed : [];
  if (dirs.includes(pluginDir)) return null;
  return `${JSON.stringify({ ...settings, cliPluginsExtraDirs: [...dirs, pluginDir] }, null, 2)}\n`;
}

/** macOS without an engine: Colima from Homebrew, with BuildKit and the compose plugin. */
function installColima(env: Environment, config: Pick<InstallConfig, 'profile'>): EngineSetup {
  if (env.brewPrefix === null) return haltSetup([], MESSAGES.macMissing);
  const vm = PROFILE_TABLE[config.profile].vm;
  let pluginConfig: string | null;
  try {
    pluginConfig = dockerCliConfigWithPlugins(env.dockerCliConfig, env.brewPrefix);
  } catch {
    return haltSetup(
      [],
      'Plik ~/.docker/config.json nie jest poprawnym JSON-em. Popraw go albo usuń i uruchom install.sh ponownie.',
    );
  }
  return ready(
    [
      step(
        'Instalacja Colima i Dockera z Homebrew',
        'system',
        runAction(['brew', 'install', 'colima', 'docker', 'docker-compose', 'docker-buildx'], {
          interactive: true,
        }),
      ),
      ...(pluginConfig === null
        ? []
        : [
            step('Wtyczki Dockera z Homebrew (compose, buildx)', 'system', {
              kind: 'write',
              path: posix.join(env.userHome, '.docker', 'config.json'),
              content: pluginConfig,
            }),
          ]),
      step(
        `Uruchamianie Colima (${vm.cpus} rdzenie, ${vm.memoryGiB} GB pamięci)`,
        'system',
        runAction(['colima', 'start', '--cpu', String(vm.cpus), '--memory', String(vm.memoryGiB)], {
          interactive: true,
        }),
      ),
    ],
    [],
  );
}

function installEngine(
  env: Environment,
  config: InstallConfig,
  wslState: 'missing' | 'no-distro' | 'distro' | null,
): EngineSetup {
  if (env.os === 'macos') return installColima(env, config);
  if (env.os === 'linux') {
    if (env.linuxDistro === null) return haltSetup([], MESSAGES.linuxUnsupported);
    if (env.conflictingPackages.length > 0)
      return haltSetup([], conflictsMessage(env.conflictingPackages));
    const sudo = sudoPrefix(env);
    const group =
      sudo.length > 0
        ? [
            step(
              `Dodanie konta ${env.user.name} do grupy docker`,
              'engine',
              runAction(['sudo', 'usermod', '-aG', 'docker', env.user.name]),
            ),
          ]
        : [];
    return ready([installDocker(env.linuxDistro, sudo), ...group], sudo);
  }
  if (wslState === 'missing' || wslState === null) {
    return haltSetup(
      [
        step(
          'Instalacja WSL2 (wymaga uprawnień administratora)',
          'system',
          runAction(['wsl.exe', '--install', '--no-distribution'], { interactive: true }),
        ),
      ],
      MESSAGES.rebootAfterWsl,
    );
  }
  const distro =
    wslState === 'no-distro'
      ? [
          step(
            `Instalacja dystrybucji ${WSL_IMAGE} jako ${WSL_DISTRO}`,
            'system',
            runAction(
              [
                'wsl.exe',
                '--install',
                WSL_IMAGE,
                '--name',
                WSL_DISTRO,
                '--no-launch',
                '--web-download',
              ],
              { interactive: true },
            ),
          ),
          step('Włączenie systemd w dystrybucji', 'engine', {
            kind: 'write',
            path: '/etc/wsl.conf',
            content: WSL_CONF,
          }),
        ]
      : [];
  const settings = wslSettingSteps(env, config, { dockerInstalled: false });
  // A new distro must restart once so /etc/wsl.conf (systemd) takes effect.
  const restart = distro.length > 0 && settings.length === 0 ? [shutdownWsl] : [];
  return ready(
    [
      ...distro,
      ...settings,
      ...restart,
      installDocker({ family: 'apt', id: 'ubuntu' }, []),
      ...(usesCaddy(config) ? [hyperVFirewall(HTTPS_PORTS)] : []),
    ],
    [],
  );
}

/** Steps that leave a running container engine, for install. */
export function prepareEngine(env: Environment, config: InstallConfig): EngineSetup {
  if (lacksMirroredNetworking(env) && config.exposure === 'lan')
    return haltSetup([], MESSAGES.lanNeedsWindows11);
  const engine = env.engine;
  if (engine.state === 'missing') return installEngine(env, config, engine.wsl);
  const firewall =
    env.engineHost === 'wsl' && usesCaddy(config) ? [hyperVFirewall(HTTPS_PORTS)] : [];
  if (engine.state === 'ready') {
    return ready(
      [...wslSettingSteps(env, config, { dockerInstalled: true }), ...firewall],
      engine.dockerPrefix,
    );
  }
  const started = startStopped(env, engine.vendor);
  if (started.halted) return started;
  // The service starts right after the restart, so there is nothing to wait for yet.
  return ready(
    [...wslSettingSteps(env, config, { dockerInstalled: false }), ...started.steps, ...firewall],
    started.dockerPrefix,
  );
}

/** Steps that start an installed but stopped engine, for start, update and uninstall. */
export function startEngine(env: Environment): EngineSetup {
  const engine = env.engine;
  switch (engine.state) {
    case 'ready':
      return ready([], engine.dockerPrefix);
    case 'stopped':
      return startStopped(env, engine.vendor);
    case 'missing':
      return haltSetup([], MESSAGES.engineMissing);
  }
}
