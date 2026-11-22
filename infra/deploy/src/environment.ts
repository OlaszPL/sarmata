import { posix, win32 } from 'node:path';
import {
  architectureOf,
  operatingSystemOf,
  type Architecture,
  type OperatingSystem,
} from '@sarmata/ai-runtime';
import { wslCommand, type Host } from './host.ts';

export type LinuxDistro =
  | { readonly family: 'apt'; readonly id: 'ubuntu' | 'debian' }
  | { readonly family: 'dnf'; readonly id: 'fedora' | 'rhel' };

export type EngineStatus =
  | { readonly state: 'ready'; readonly dockerPrefix: readonly string[] }
  | { readonly state: 'stopped'; readonly vendor: 'docker-desktop' | 'colima' | 'linux-service' }
  | { readonly state: 'missing'; readonly wsl: 'missing' | 'no-distro' | 'distro' | null };

/** What the installer knows about the computer. Plain data, so plans are pure functions of it. */
export interface Environment {
  readonly os: OperatingSystem;
  readonly arch: Architecture;
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
  /** sarmata.json exists: the installation finished (it is written last). */
  readonly installed: boolean;
  /** The installation's source directory exists (an interrupted update may have moved it). */
  readonly sourcePresent: boolean;
  /** VERSION of the installed release, null for a build from git. */
  readonly installedVersion: string | null;
  /** Current %USERPROFILE%\.wslconfig (Windows with WSL), null when missing. */
  readonly wslConfig: string | null;
  /** Windows build number, null elsewhere. Mirrored WSL networking needs 22621 (Windows 11 22H2). */
  readonly windowsBuild: number | null;
  /** Homebrew prefix on macOS, null without Homebrew or elsewhere. */
  readonly brewPrefix: string | null;
  /** Current ~/.docker/config.json on macOS, null when missing. */
  readonly dockerCliConfig: string | null;
  /** Installed packages that conflict with Docker Engine (podman and runc on RHEL). */
  readonly conflictingPackages: readonly string[];
  /** Commands on the engine host that zip and git updates need. */
  readonly engineTools: { readonly unzip: boolean; readonly git: boolean };
  /** SARMATA_BUILD_CA_FILE: PEM of a TLS-inspecting proxy, passed to image builds as the ca secret. */
  readonly buildCaFile: string | null;
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
/** First Windows build with mirrored WSL networking and Hyper-V firewall rules (11 22H2). */
export const MIRRORED_NETWORKING_BUILD = 22621;
const LINUX_HOME = '/opt/sarmata';
const CONFIG_FILE = 'sarmata.json';
const DOCKER_DESKTOP_INSTALLED =
  "if (Test-Path (Join-Path $env:ProgramFiles 'Docker\\Docker\\Docker Desktop.exe')) { exit 0 } else { exit 1 }";
const NO_TOOLS = { unzip: false, git: false } as const;
const posixJoin = (...parts: string[]): string => posix.join(...parts);
const win32Join = (...parts: string[]): string => win32.join(...parts);

type Common = Pick<Environment, 'arch' | 'execPath' | 'releaseDir' | 'userHome' | 'buildCaFile'>;
type InstallationFacts = Pick<Environment, 'installed' | 'sourcePresent' | 'installedVersion'>;

interface Probe {
  ok(argv: readonly string[]): Promise<boolean>;
  text(argv: readonly string[]): Promise<string | null>;
}

function probes(system: Host): Probe {
  const run = (argv: readonly string[]) => {
    const [command = '', ...args] = argv;
    return system.run(command, args);
  };
  return {
    ok: async (argv) => (await run(argv)).exitCode === 0,
    text: async (argv) => {
      const result = await run(argv);
      return result.exitCode === 0 ? result.stdout.trim() : null;
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

async function installationFacts(
  read: (path: string) => Promise<string | null>,
  join: (...parts: string[]) => string,
  home: string,
): Promise<InstallationFacts> {
  const version = (await read(join(home, 'source', 'VERSION')))?.trim() ?? '';
  return {
    installed: (await read(join(home, CONFIG_FILE))) !== null,
    sourcePresent: (await read(join(home, 'source', 'package.json'))) !== null,
    installedVersion: version === '' ? null : version,
  };
}

async function engineTools(probe: Probe, wrap: (argv: string[]) => string[]) {
  return {
    unzip: await probe.ok(wrap(['sh', '-c', 'command -v unzip'])),
    git: await probe.ok(wrap(['sh', '-c', 'command -v git'])),
  };
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

// Docker's RHEL instructions remove these first: containerd.io conflicts with them.
async function conflictsWithDocker(
  probe: Probe,
  distro: LinuxDistro | null,
  engine: EngineStatus,
): Promise<string[]> {
  if (distro?.id !== 'rhel' || engine.state !== 'missing') return [];
  const found: string[] = [];
  for (const name of ['podman', 'runc']) if (await probe.ok(['rpm', '-q', name])) found.push(name);
  return found;
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
  const linuxDistro = osRelease === null ? null : parseOsRelease(osRelease);
  const engine = await linuxEngine(probe, isRoot);
  return {
    os: 'linux',
    ...common,
    engineHost: 'local',
    home: LINUX_HOME,
    binDir: posix.join(LINUX_HOME, 'bin'),
    desktopDir: hasDesktop ? desktop : null,
    user: { name, group, isRoot },
    linuxDistro,
    engine,
    ...(await installationFacts((path) => system.readFile(path), posixJoin, LINUX_HOME)),
    wslConfig: null,
    windowsBuild: null,
    brewPrefix: null,
    dockerCliConfig: null,
    conflictingPackages: await conflictsWithDocker(probe, linuxDistro, engine),
    engineTools: await engineTools(probe, (argv) => argv),
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
  const brewPrefix = await probe.text(['brew', '--prefix']);
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
    ...(await installationFacts((path) => system.readFile(path), posixJoin, home)),
    wslConfig: null,
    windowsBuild: null,
    brewPrefix: brewPrefix === '' ? null : brewPrefix,
    dockerCliConfig: await system.readFile(posix.join(common.userHome, '.docker', 'config.json')),
    conflictingPackages: [],
    engineTools: await engineTools(probe, (argv) => argv),
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
  const build = Number(await probe.text(powershell('[Environment]::OSVersion.Version.Build')));
  const shared = {
    os: 'windows',
    ...common,
    userHome,
    binDir: win32.join(localAppData, 'Programs', 'Sarmata'),
    desktopDir: desktop === null || desktop === '' ? null : desktop,
    user: { name: facts.env.USERNAME ?? 'user', group: '', isRoot: false },
    windowsBuild: Number.isInteger(build) && build > 0 ? build : null,
    brewPrefix: null,
    dockerCliConfig: null,
    conflictingPackages: [],
  } as const;

  // Docker Desktop (when the office has a licence) or another engine already on PATH.
  const desktopHome = win32.join(facts.env.ProgramData ?? 'C:\\ProgramData', 'Sarmata');
  const desktopShared = {
    ...shared,
    engineHost: 'local',
    home: desktopHome,
    linuxDistro: null,
    wslConfig: null,
    engineTools: NO_TOOLS,
  } as const;
  const desktopFacts = (): Promise<InstallationFacts> =>
    installationFacts((path) => system.readFile(path), win32Join, desktopHome);
  if (await probe.ok(['docker', 'info'])) {
    return {
      ...desktopShared,
      engine: { state: 'ready', dockerPrefix: [] },
      ...(await desktopFacts()),
    };
  }
  if (await probe.ok(powershell(DOCKER_DESKTOP_INSTALLED))) {
    // Read the installation too, so start says "Docker Desktop is not running", not "not installed".
    return {
      ...desktopShared,
      engine: { state: 'stopped', vendor: 'docker-desktop' },
      ...(await desktopFacts()),
    };
  }

  const missing = { installed: false, sourcePresent: false, installedVersion: null } as const;
  const wsl = {
    ...shared,
    engineHost: 'wsl',
    home: LINUX_HOME,
    linuxDistro: { family: 'apt', id: 'ubuntu' },
    wslConfig: await system.readFile(win32.join(userHome, '.wslconfig')),
  } as const;
  if (!(await probe.ok(['wsl.exe', '--status'])))
    return {
      ...wsl,
      engine: { state: 'missing', wsl: 'missing' },
      ...missing,
      engineTools: NO_TOOLS,
    };
  const distros = (await probe.text(['wsl.exe', '--list', '--quiet'])) ?? '';
  if (
    !distros
      .split(/\r?\n/)
      .map((line) => line.trim())
      .includes(WSL_DISTRO)
  ) {
    return {
      ...wsl,
      engine: { state: 'missing', wsl: 'no-distro' },
      ...missing,
      engineTools: NO_TOOLS,
    };
  }
  const inDistro = (argv: readonly string[]): string[] => wslCommand(WSL_DISTRO, argv);
  const installation = await installationFacts(
    (path) => probe.text(inDistro(['cat', path])),
    posixJoin,
    LINUX_HOME,
  );
  const withFacts = {
    ...wsl,
    ...installation,
    engineTools: await engineTools(probe, inDistro),
  };
  if (await probe.ok(inDistro(['docker', 'info'])))
    return { ...withFacts, engine: { state: 'ready', dockerPrefix: [] } };
  if (await probe.ok(inDistro(['sh', '-c', 'command -v docker'])))
    return { ...withFacts, engine: { state: 'stopped', vendor: 'linux-service' } };
  return { ...withFacts, engine: { state: 'missing', wsl: 'distro' } };
}

const nonEmpty = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
};

/** Reads the facts the plans need: system, engine state, directories, an existing installation. */
export async function detectEnvironment(system: Host, facts: ProcessFacts): Promise<Environment> {
  const common: Common = {
    arch: architectureOf(facts.arch),
    execPath: facts.execPath,
    releaseDir: releaseDirOf(facts.execPath),
    userHome: facts.userHome,
    buildCaFile: nonEmpty(facts.env.SARMATA_BUILD_CA_FILE),
  };
  const probe = probes(system);
  switch (operatingSystemOf(facts.platform)) {
    case 'linux':
      return detectLinux(system, probe, common);
    case 'macos':
      return detectMac(system, probe, common);
    case 'windows':
      return detectWindows(system, probe, facts, common);
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

export const binaryName = (os: OperatingSystem, arch: Architecture): string =>
  `sarmata-${os}-${arch}${os === 'windows' ? '.exe' : ''}`;

export const samePath = (a: string, b: string): boolean =>
  a.replaceAll('\\', '/').toLowerCase() === b.replaceAll('\\', '/').toLowerCase();

/** Windows with the WSL engine on a build without mirrored networking (Windows 10). */
export const lacksMirroredNetworking = (env: Environment): boolean =>
  env.engineHost === 'wsl' &&
  env.windowsBuild !== null &&
  env.windowsBuild < MIRRORED_NETWORKING_BUILD;
