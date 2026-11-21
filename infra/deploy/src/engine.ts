import { win32 } from 'node:path';
import { API_PORT, APP_PORT, type InstallConfig } from './config.ts';
import {
  WSL_DISTRO,
  WSL_IMAGE,
  type EngineStatus,
  type Environment,
  type LinuxDistro,
} from './environment.ts';
import { haltStep, runAction, step, type Step } from './plan.ts';

export interface EngineSetup {
  readonly steps: readonly Step[];
  /** Prefix for docker commands after these steps, e.g. sudo right after installing on Linux. */
  readonly dockerPrefix: readonly string[];
  /** The steps end with a halt: nothing after them may run. */
  readonly halted: boolean;
}

const MESSAGES = {
  macMissing:
    'Nie znaleziono silnika kontenerów. Na macOS zainstaluj Docker Desktop (jeśli urząd ma licencję) albo Colima: brew install colima docker docker-compose, potem colima start. Następnie uruchom install.sh ponownie.',
  linuxUnsupported:
    'Kreator instaluje Docker Engine na Ubuntu, Debianie, Fedorze i RHEL oraz zgodnych. Na tym systemie zainstaluj Docker Engine według https://docs.docker.com/engine/install/ i uruchom install.sh ponownie.',
  desktopStopped:
    'Docker Desktop jest zainstalowany, ale nie działa. Uruchom go, poczekaj, aż będzie gotowy, i uruchom kreator ponownie.',
  rebootAfterWsl: 'Zainstalowano WSL2. Uruchom ponownie komputer, a potem jeszcze raz install.bat.',
  engineMissing:
    'Nie znaleziono silnika kontenerów. Uruchom instalację ponownie: install.sh albo install.bat.',
} as const;

const WSL_CONF = '[boot]\nsystemd=true\n\n[user]\ndefault=root\n';
// Hyper-V firewall rules for WSL carry this creator id (learn.microsoft.com/windows/wsl/networking).
const WSL_VM_CREATOR_ID = '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}';

const ready = (steps: readonly Step[], dockerPrefix: readonly string[]): EngineSetup => ({
  steps,
  dockerPrefix,
  halted: false,
});
const halt = (steps: readonly Step[], message: string): EngineSetup => ({
  steps: [...steps, haltStep(message)],
  dockerPrefix: [],
  halted: true,
});

/** Linux as a regular user needs sudo for root work. WSL steps already run as root. */
export function sudoPrefix(env: Environment): readonly string[] {
  return env.os === 'linux' && env.engineHost === 'local' && !env.user.isRoot ? ['sudo'] : [];
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

interface WslSettings {
  readonly configWrite: readonly Step[];
  readonly firewall: readonly Step[];
}

const shutdownWsl = step(
  'Ponowne uruchomienie WSL z nowymi ustawieniami',
  'system',
  runAction(['wsl.exe', '--shutdown']),
);

function hyperVFirewall(ports: readonly number[]): Step {
  const script = `if (-not (Get-NetFirewallHyperVRule -Name 'Sarmata' -ErrorAction SilentlyContinue)) { New-NetFirewallHyperVRule -Name 'Sarmata' -DisplayName 'Sarmata' -Direction Inbound -VMCreatorId '${WSL_VM_CREATOR_ID}' -Protocol TCP -LocalPorts ${ports.join(',')} }`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return step(
    'Reguła zapory Hyper-V dla dostępu z sieci urzędu',
    'system',
    runAction(
      [
        'powershell.exe',
        '-NoProfile',
        '-Command',
        `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile','-EncodedCommand','${encoded}'`,
      ],
      { interactive: true },
    ),
  );
}

/** WSL keeps the distro running after the wizard exits, and mirrors the network for LAN access. */
function wslSettings(env: Environment, config: InstallConfig): WslSettings {
  const current = env.wslConfig ?? '';
  let next = setIniValue(current, 'general', 'instanceIdleTimeout', '-1');
  // Mirrored networking: LAN access, and WSL loopback reaching llama-server on Windows for ai-relay.
  if (config.exposure === 'lan' || config.ai.enabled)
    next = setIniValue(next, 'wsl2', 'networkingMode', 'mirrored');
  const ports = config.profile === 'server' ? [80, 443] : [APP_PORT, API_PORT];
  return {
    configWrite:
      next === current
        ? []
        : [
            step('Ustawienia WSL (praca w tle, sieć)', 'system', {
              kind: 'write',
              path: win32.join(env.userHome, '.wslconfig'),
              content: next,
            }),
          ],
    firewall: config.exposure === 'lan' ? [hyperVFirewall(ports)] : [],
  };
}

function startStopped(
  env: Environment,
  vendor: Extract<EngineStatus, { state: 'stopped' }>['vendor'],
): EngineSetup {
  switch (vendor) {
    case 'docker-desktop':
      return halt([], MESSAGES.desktopStopped);
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

function installEngine(
  env: Environment,
  wslState: 'missing' | 'no-distro' | 'distro' | null,
  wsl: WslSettings,
): EngineSetup {
  if (env.os === 'macos') return halt([], MESSAGES.macMissing);
  if (env.os === 'linux') {
    if (env.linuxDistro === null) return halt([], MESSAGES.linuxUnsupported);
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
    return halt(
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
  const restart = distro.length > 0 || wsl.configWrite.length > 0 ? [shutdownWsl] : [];
  return ready(
    [
      ...distro,
      ...wsl.configWrite,
      ...restart,
      installDocker({ family: 'apt', id: 'ubuntu' }, []),
      ...wsl.firewall,
    ],
    [],
  );
}

/** Steps that leave a running container engine, for install. */
export function prepareEngine(env: Environment, config: InstallConfig): EngineSetup {
  const wsl =
    env.engineHost === 'wsl' ? wslSettings(env, config) : { configWrite: [], firewall: [] };
  const settings = wsl.configWrite.length > 0 ? [...wsl.configWrite, shutdownWsl] : [];
  const engine = env.engine;
  switch (engine.state) {
    case 'ready':
      return ready([...settings, ...wsl.firewall], engine.dockerPrefix);
    case 'stopped': {
      const started = startStopped(env, engine.vendor);
      return started.halted
        ? started
        : ready([...settings, ...started.steps, ...wsl.firewall], started.dockerPrefix);
    }
    case 'missing':
      return installEngine(env, engine.wsl, wsl);
  }
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
      return halt([], MESSAGES.engineMissing);
  }
}
