import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  generateSecrets,
  installConfigSchema,
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
