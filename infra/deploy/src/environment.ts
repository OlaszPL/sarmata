import { posix, win32 } from 'node:path';
import { wslCommand, type Host } from './host.ts';

export type Os = 'windows' | 'linux' | 'macos';
export type Arch = 'x64' | 'arm64';

export type LinuxDistro =
  | { readonly family: 'apt'; readonly id: 'ubuntu' | 'debian' }
  | { readonly family: 'dnf'; readonly id: 'fedora' | 'rhel' };

export type EngineStatus =
  | { readonly state: 'ready'; readonly dockerPrefix: readonly string[] }
  | { readonly state: 'stopped'; readonly vendor: 'docker-desktop' | 'colima' | 'linux-service' }
  | { readonly state: 'missing'; readonly wsl: 'missing' | 'no-distro' | 'distro' | null };

/** What the installer knows about the computer. Plain data, so plans are pure functions of it. */
export interface Environment {
  readonly os: Os;
  readonly arch: Arch;
  /** wsl: Docker Engine in the WSL distro "sarmata" (Windows without Docker Desktop). */
  readonly engineHost: 'local' | 'wsl';
  /** Installation directory on the engine host. */
  readonly home: string;
  /** Directory of the installed sarmata command, on the system side. */
  readonly binDir: string;
  readonly execPath: string;
  /** Unpacked release this binary comes from, null for an installed copy. */
  readonly releaseDir: string | null;
  readonly userHome: string;
  /** Null when the system has no desktop (Linux server). */
  readonly desktopDir: string | null;
  readonly user: { readonly name: string; readonly group: string; readonly isRoot: boolean };
  readonly linuxDistro: LinuxDistro | null;
  readonly engine: EngineStatus;
  readonly installed: boolean;
  /** Current %USERPROFILE%\.wslconfig (Windows with WSL), null when missing. */
  readonly wslConfig: string | null;
}

export interface ProcessFacts {
  readonly platform: string;
  readonly arch: string;
  readonly execPath: string;
  readonly userHome: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

export const WSL_DISTRO = 'sarmata';
export const WSL_IMAGE = 'Ubuntu-24.04';
const LINUX_HOME = '/opt/sarmata';
const CONFIG_FILE = 'sarmata.json';
const DOCKER_DESKTOP_INSTALLED =
  "if (Test-Path (Join-Path $env:ProgramFiles 'Docker\\Docker\\Docker Desktop.exe')) { exit 0 } else { exit 1 }";

type Common = Pick<Environment, 'arch' | 'execPath' | 'releaseDir' | 'userHome'>;

interface Probe {
  ok(argv: readonly string[]): Promise<boolean>;
  text(argv: readonly string[]): Promise<string | null>;
}

function probes(system: Host): Probe {
  return {
    ok: async (argv) => (await system.run(argv)).code === 0,
    text: async (argv) => {
      const result = await system.run(argv);
      return result.code === 0 ? result.stdout.trim() : null;
    },
  };
}

const powershell = (script: string): string[] => [
  'powershell.exe',
  '-NoProfile',
  '-NonInteractive',
  '-Command',
  script,
];

function releaseDirOf(execPath: string): string | null {
  const index = execPath.replaceAll('\\', '/').lastIndexOf('/infra/deploy/dist/');
  return index === -1 ? null : execPath.slice(0, index);
}

export function parseOsRelease(text: string): LinuxDistro | null {
  const fields = new Map<string, string>();
  for (const line of text.split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    const key = match?.[1];
    const value = match?.[2];
    if (key !== undefined && value !== undefined)
      fields.set(key, value.replace(/^["']|["']$/g, ''));
  }
  const id = fields.get('ID') ?? '';
  const like = (fields.get('ID_LIKE') ?? '').split(' ');
  if (id === 'debian') return { family: 'apt', id: 'debian' };
  if (id === 'ubuntu' || like.includes('ubuntu')) return { family: 'apt', id: 'ubuntu' };
  if (id === 'fedora') return { family: 'dnf', id: 'fedora' };
  if (['rhel', 'centos', 'rocky', 'almalinux'].includes(id) || like.includes('rhel'))
    return { family: 'dnf', id: 'rhel' };
  if (like.includes('debian')) return { family: 'apt', id: 'debian' };
  return null;
}

async function linuxEngine(probe: Probe, isRoot: boolean): Promise<EngineStatus> {
  if (await probe.ok(['docker', 'info'])) return { state: 'ready', dockerPrefix: [] };
  // Running but not reachable without root: the account is not in the docker group (yet).
  if (await probe.ok(['systemctl', 'is-active', '--quiet', 'docker']))
    return { state: 'ready', dockerPrefix: isRoot ? [] : ['sudo'] };
  if (await probe.ok(['sh', '-c', 'command -v docker']))
    return { state: 'stopped', vendor: 'linux-service' };
  return { state: 'missing', wsl: null };
}

async function detectLinux(system: Host, probe: Probe, common: Common): Promise<Environment> {
  const name = (await probe.text(['id', '-un'])) ?? 'root';
  const group = (await probe.text(['id', '-gn'])) ?? name;
  const isRoot = (await probe.text(['id', '-u'])) === '0';
  const osRelease = await system.readFile('/etc/os-release');
  const desktop = await probe.text(['xdg-user-dir', 'DESKTOP']);
  const hasDesktop =
    desktop !== null &&
    desktop !== '' &&
    desktop !== common.userHome &&
    (await probe.ok(['test', '-d', desktop]));
  return {
    os: 'linux',
    ...common,
    engineHost: 'local',
    home: LINUX_HOME,
    binDir: posix.join(LINUX_HOME, 'bin'),
    desktopDir: hasDesktop ? desktop : null,
    user: { name, group, isRoot },
    linuxDistro: osRelease === null ? null : parseOsRelease(osRelease),
    engine: await linuxEngine(probe, isRoot),
    installed: (await system.readFile(posix.join(LINUX_HOME, CONFIG_FILE))) !== null,
    wslConfig: null,
  };
}

async function detectMac(system: Host, probe: Probe, common: Common): Promise<Environment> {
  const home = posix.join(common.userHome, 'Sarmata');
  let engine: EngineStatus = { state: 'missing', wsl: null };
  if (await probe.ok(['docker', 'info'])) engine = { state: 'ready', dockerPrefix: [] };
  else if (await probe.ok(['sh', '-c', 'command -v colima']))
    engine = { state: 'stopped', vendor: 'colima' };
  else if (await probe.ok(['test', '-d', '/Applications/Docker.app']))
    engine = { state: 'stopped', vendor: 'docker-desktop' };
  const name = (await probe.text(['id', '-un'])) ?? 'user';
  return {
    os: 'macos',
    ...common,
    engineHost: 'local',
    home,
    binDir: posix.join(home, 'bin'),
    desktopDir: posix.join(common.userHome, 'Desktop'),
    user: { name, group: (await probe.text(['id', '-gn'])) ?? 'staff', isRoot: false },
    linuxDistro: null,
    engine,
    installed: (await system.readFile(posix.join(home, CONFIG_FILE))) !== null,
    wslConfig: null,
  };
}

async function detectWindows(
  system: Host,
  probe: Probe,
  facts: ProcessFacts,
  common: Common,
): Promise<Environment> {
  const userHome = facts.env.USERPROFILE ?? common.userHome;
  const localAppData = facts.env.LOCALAPPDATA ?? win32.join(userHome, 'AppData', 'Local');
  const desktop = await probe.text(powershell("[Environment]::GetFolderPath('Desktop')"));
  const shared = {
    os: 'windows',
    ...common,
    userHome,
    binDir: win32.join(localAppData, 'Programs', 'Sarmata'),
    desktopDir: desktop === null || desktop === '' ? null : desktop,
    user: { name: facts.env.USERNAME ?? 'user', group: '', isRoot: false },
  } as const;

  // Docker Desktop (when the office has a licence) or another engine already on PATH.
  const desktopHome = win32.join(facts.env.ProgramData ?? 'C:\\ProgramData', 'Sarmata');
  const desktopShared = {
    ...shared,
    engineHost: 'local',
    home: desktopHome,
    linuxDistro: null,
    wslConfig: null,
  } as const;
  if (await probe.ok(['docker', 'info'])) {
    const installed = (await system.readFile(win32.join(desktopHome, CONFIG_FILE))) !== null;
    return { ...desktopShared, engine: { state: 'ready', dockerPrefix: [] }, installed };
  }
  if (await probe.ok(powershell(DOCKER_DESKTOP_INSTALLED))) {
    return {
      ...desktopShared,
      engine: { state: 'stopped', vendor: 'docker-desktop' },
      installed: false,
    };
  }

  const wsl = {
    ...shared,
    engineHost: 'wsl',
    home: LINUX_HOME,
    linuxDistro: { family: 'apt', id: 'ubuntu' },
    wslConfig: await system.readFile(win32.join(userHome, '.wslconfig')),
  } as const;
  if (!(await probe.ok(['wsl.exe', '--status'])))
    return { ...wsl, engine: { state: 'missing', wsl: 'missing' }, installed: false };
  const distros = (await probe.text(['wsl.exe', '--list', '--quiet'])) ?? '';
  if (
    !distros
      .split(/\r?\n/)
      .map((line) => line.trim())
      .includes(WSL_DISTRO)
  ) {
    return { ...wsl, engine: { state: 'missing', wsl: 'no-distro' }, installed: false };
  }
  const inDistro = (argv: readonly string[]): string[] => wslCommand(WSL_DISTRO, argv);
  const installed = await probe.ok(inDistro(['test', '-f', posix.join(LINUX_HOME, CONFIG_FILE)]));
  if (await probe.ok(inDistro(['docker', 'info'])))
    return { ...wsl, engine: { state: 'ready', dockerPrefix: [] }, installed };
  if (await probe.ok(inDistro(['sh', '-c', 'command -v docker']))) {
    return { ...wsl, engine: { state: 'stopped', vendor: 'linux-service' }, installed };
  }
  return { ...wsl, engine: { state: 'missing', wsl: 'distro' }, installed };
}

/** Reads the facts the plans need: system, engine state, directories, an existing installation. */
export async function detectEnvironment(system: Host, facts: ProcessFacts): Promise<Environment> {
  if (facts.arch !== 'x64' && facts.arch !== 'arm64')
    throw new Error(`Unsupported architecture: ${facts.arch}`);
  const common: Common = {
    arch: facts.arch,
    execPath: facts.execPath,
    releaseDir: releaseDirOf(facts.execPath),
    userHome: facts.userHome,
  };
  const probe = probes(system);
  switch (facts.platform) {
    case 'linux':
      return detectLinux(system, probe, common);
    case 'darwin':
      return detectMac(system, probe, common);
    case 'win32':
      return detectWindows(system, probe, facts, common);
    default:
      throw new Error(`Unsupported platform: ${facts.platform}`);
  }
}

/** Paths of an installation, in the path style of the engine host. */
export interface Layout {
  readonly home: string;
  readonly source: string;
  readonly sourceNext: string;
  readonly sourcePrevious: string;
  readonly composeFile: string;
  readonly composePrevious: string;
  readonly envFile: string;
  readonly envPrevious: string;
  readonly configFile: string;
  readonly caddyfile: string;
  readonly certFile: string;
  readonly keyFile: string;
  readonly backups: string;
  /** The installed sarmata command, on the system side. */
  readonly launcher: string;
  readonly join: (...parts: string[]) => string;
}

export function layout(env: Environment): Layout {
  const path = env.os === 'windows' && env.engineHost === 'local' ? win32 : posix;
  const at = (...parts: string[]): string => path.join(env.home, ...parts);
  const system = env.os === 'windows' ? win32 : posix;
  return {
    home: env.home,
    source: at('source'),
    sourceNext: at('source.next'),
    sourcePrevious: at('source.previous'),
    composeFile: at('compose.yaml'),
    composePrevious: at('compose.yaml.previous'),
    envFile: at('.env'),
    envPrevious: at('.env.previous'),
    configFile: at(CONFIG_FILE),
    caddyfile: at('Caddyfile'),
    certFile: at('certs', 'cert.pem'),
    keyFile: at('certs', 'key.pem'),
    backups: at('backups'),
    launcher: system.join(env.binDir, env.os === 'windows' ? 'sarmata.exe' : 'sarmata'),
    join: (...parts) => path.join(...parts),
  };
}

/** C:\Users\jan\x as the WSL distro sees it: /mnt/c/Users/jan/x. */
export function toWslPath(windowsPath: string): string {
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(windowsPath);
  const drive = match?.[1];
  const rest = match?.[2];
  if (drive === undefined || rest === undefined)
    throw new Error(`Cannot map ${windowsPath} to a WSL path`);
  return `/mnt/${drive.toLowerCase()}/${rest.replaceAll('\\', '/')}`;
}

/** A system-side path as the engine host sees it. */
export const toEnginePath = (env: Environment, systemPath: string): string =>
  env.engineHost === 'wsl' ? toWslPath(systemPath) : systemPath;

export const binaryName = (os: Os, arch: Arch): string =>
  `sarmata-${os}-${arch}${os === 'windows' ? '.exe' : ''}`;

export const samePath = (a: string, b: string): boolean =>
  a.replaceAll('\\', '/').toLowerCase() === b.replaceAll('\\', '/').toLowerCase();
