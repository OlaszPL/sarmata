import type { InstallProfile, OperatingSystem } from '@sarmata/ai-runtime';
import type { InstallConfig } from './config.ts';

/** Who reaches the app: only this computer, or the computers in the office network. */
export type Exposure = 'localhost' | 'lan';

/** What a profile of ADR 0003 includes. Every profile check in the installer reads this table. */
export interface ProfileSpec {
  /** Wizard label hint, in Polish. */
  readonly hint: string;
  /** Allowed exposures, the first one is the wizard default. */
  readonly exposures: readonly Exposure[];
  /** Upstream Supabase services of a local Supabase. */
  readonly supabaseServices: readonly string[];
  /** A backup container dumps the database every night. */
  readonly nightlyBackups: boolean;
  /** Systems the wizard offers the profile on (README "Wybór profilu"). */
  readonly systems: readonly OperatingSystem[];
  /** Size of the Colima VM the wizard creates on macOS. */
  readonly vm: { readonly cpus: number; readonly memoryGiB: number };
}

const LIGHT_SUPABASE: readonly string[] = ['db', 'auth', 'rest', 'kong'];
// No realtime, edge functions, analytics or pooler: the app does not use them (ADR 0003).
const FULL_SUPABASE: readonly string[] = [
  ...LIGHT_SUPABASE,
  'meta',
  'studio',
  'storage',
  'imgproxy',
];
const EVERY_SYSTEM: readonly OperatingSystem[] = ['windows', 'linux', 'macos'];

export const PROFILE_TABLE: Readonly<Record<InstallProfile, ProfileSpec>> = {
  light: {
    hint: 'jedno stanowisko, słaby komputer, AI domyślnie wyłączone',
    exposures: ['localhost'],
    supabaseServices: LIGHT_SUPABASE,
    nightlyBackups: false,
    systems: EVERY_SYSTEM,
    vm: { cpus: 2, memoryGiB: 4 },
  },
  standard: {
    hint: 'mocniejsze stanowisko albo mały urząd',
    exposures: ['localhost', 'lan'],
    supabaseServices: FULL_SUPABASE,
    nightlyBackups: false,
    systems: EVERY_SYSTEM,
    vm: { cpus: 4, memoryGiB: 8 },
  },
  server: {
    hint: 'serwer z Linuksem w sieci urzędu, kopie co noc',
    exposures: ['lan'],
    supabaseServices: FULL_SUPABASE,
    nightlyBackups: true,
    systems: ['linux'],
    vm: { cpus: 4, memoryGiB: 8 },
  },
};

/**
 * Caddy terminates HTTPS in front of every installation reachable from the office network, so no
 * password or session cookie crosses the LAN in clear text (ADR 0003). Localhost needs no TLS.
 */
export const usesCaddy = (config: Pick<InstallConfig, 'exposure'>): boolean =>
  config.exposure === 'lan';

/** Upstream Supabase services of an installation, none with an external Supabase. */
export function supabaseServicesOf(
  config: Pick<InstallConfig, 'profile' | 'supabase'>,
): readonly string[] {
  return config.supabase.mode === 'external' ? [] : PROFILE_TABLE[config.profile].supabaseServices;
}
