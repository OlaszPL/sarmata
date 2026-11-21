import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  generateSecrets,
  installConfigSchema,
  type Environment,
  type InstallConfig,
  type Secrets,
} from '../index.ts';

/** Light profile, local Supabase, no SMTP, no AI: the smallest valid installation. */
export const BASE_CONFIG: InstallConfig = {
  schemaVersion: 1,
  profile: 'light',
  exposure: 'localhost',
  host: 'localhost',
  tls: { mode: 'none' },
  supabase: { mode: 'local' },
  smtp: { enabled: false },
  ai: { enabled: false },
  office: { name: 'Urząd Testowy' },
  admin: { email: 'admin@urzad.test', firstName: 'Anna', lastName: 'Admin' },
  shortcut: true,
};

export function config(overrides: Partial<InstallConfig> = {}): InstallConfig {
  return installConfigSchema.parse({ ...BASE_CONFIG, ...overrides });
}

export const PROFILES = {
  light: config(),
  standard: config({ profile: 'standard', exposure: 'lan', host: 'oceny-pc' }),
  server: config({
    profile: 'server',
    exposure: 'lan',
    host: 'oceny.urzad.local',
    tls: { mode: 'internal' },
  }),
  external: config({ supabase: { mode: 'external', url: 'https://abc.supabase.co' } }),
  withAi: config({
    profile: 'standard',
    ai: {
      enabled: true,
      modelId: 'bielik-11b-v3.1-q4_k_m',
      alias: 'bielik-11b-v3.1-instruct',
      decisionPort: 8026,
    },
  }),
} as const;
export type ProfileName = keyof typeof PROFILES;
export const PROFILE_NAMES: readonly ProfileName[] = [
  'light',
  'standard',
  'server',
  'external',
  'withAi',
];

/** Deterministic secrets: counter bytes and a fixed time. */
export function secrets(overrides: Partial<Secrets> = {}): Secrets {
  let counter = 0;
  const random = (size: number): Uint8Array =>
    Uint8Array.from({ length: size }, () => counter++ % 256);
  return {
    ...generateSecrets(random, new Date('2026-11-21T12:00:00Z')),
    SMTP_PASS: '',
    EXTERNAL_DATABASE_URL: '',
    ...overrides,
  };
}

/** The vendored docker-compose.yml of supabase/supabase v1.26.08. */
export function upstreamCompose(): string {
  return readFileSync(
    fileURLToPath(new URL('../../supabase/docker-compose.yml', import.meta.url)),
    'utf8',
  );
}

export function macEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    os: 'macos',
    arch: 'arm64',
    engineHost: 'local',
    home: '/Users/jan/Sarmata',
    binDir: '/Users/jan/Sarmata/bin',
    execPath: '/Users/jan/Downloads/sarmata/infra/deploy/dist/sarmata-macos-arm64',
    releaseDir: '/Users/jan/Downloads/sarmata',
    userHome: '/Users/jan',
    desktopDir: '/Users/jan/Desktop',
    user: { name: 'jan', group: 'staff', isRoot: false },
    linuxDistro: null,
    engine: { state: 'ready', dockerPrefix: [] },
    installed: false,
    wslConfig: null,
    ...overrides,
  };
}

export function linuxEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    os: 'linux',
    arch: 'x64',
    engineHost: 'local',
    home: '/opt/sarmata',
    binDir: '/opt/sarmata/bin',
    execPath: '/home/jan/sarmata/infra/deploy/dist/sarmata-linux-x64',
    releaseDir: '/home/jan/sarmata',
    userHome: '/home/jan',
    desktopDir: '/home/jan/Pulpit',
    user: { name: 'jan', group: 'jan', isRoot: false },
    linuxDistro: { family: 'apt', id: 'ubuntu' },
    engine: { state: 'ready', dockerPrefix: [] },
    installed: false,
    wslConfig: null,
    ...overrides,
  };
}

export function windowsEnvironment(overrides: Partial<Environment> = {}): Environment {
  return {
    os: 'windows',
    arch: 'x64',
    engineHost: 'wsl',
    home: '/opt/sarmata',
    binDir: 'C:\\Users\\jan\\AppData\\Local\\Programs\\Sarmata',
    execPath: 'C:\\Users\\jan\\Downloads\\sarmata\\infra\\deploy\\dist\\sarmata-windows-x64.exe',
    releaseDir: 'C:\\Users\\jan\\Downloads\\sarmata',
    userHome: 'C:\\Users\\jan',
    desktopDir: 'C:\\Users\\jan\\Desktop',
    user: { name: 'jan', group: '', isRoot: false },
    linuxDistro: { family: 'apt', id: 'ubuntu' },
    engine: { state: 'ready', dockerPrefix: [] },
    installed: false,
    wslConfig: null,
    ...overrides,
  };
}
