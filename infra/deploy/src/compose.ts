import { parse, stringify } from 'yaml';
import { API_PORT, APP_PORT, type InstallConfig } from './config.ts';

type ComposeService = Record<string, unknown>;

interface UpstreamCompose {
  readonly services: Readonly<Record<string, ComposeService | undefined>>;
}

export const TOOLS_IMAGE = 'postgres:17.12-alpine3.24';
export const CADDY_IMAGE = 'caddy:2.11.9';
export const RELAY_IMAGE = 'alpine/socat:1.8.1.1';

/** Vendored upstream files, relative to the installation directory (compose project directory). */
const SUPABASE_FILES = './source/infra/deploy/supabase';
const LIGHT_SUPABASE: readonly string[] = ['db', 'auth', 'rest', 'kong'];
const FULL_SUPABASE: readonly string[] = [
  ...LIGHT_SUPABASE,
  'meta',
  'studio',
  'storage',
  'imgproxy',
];
/** Upstream bind mounts with data, moved to named volumes (no host permission issues, also on Windows). */
const DATA_VOLUMES: Readonly<Record<string, string>> = {
  './volumes/db/data': 'db-data',
  './volumes/storage': 'storage-data',
  './volumes/snippets': 'studio-snippets',
};
const MIGRATIONS_MOUNT = './source/database/supabase/migrations:/migrations:ro';
const DBTOOL_MOUNT = './source/infra/deploy/docker/dbtool.sh:/scripts/dbtool.sh:ro';
const BACKUPS_MOUNT = './backups:/backups';
const DBTOOL_ENTRYPOINT = ['/bin/sh', '/scripts/dbtool.sh'];
const AUTH_HOOK = {
  GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED: 'true',
  // database/supabase/config.toml: the hook lives in the access schema.
  GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI: 'pg-functions://postgres/access/custom_access_token_hook',
};
// backend/ai/src/config.ts, read by services in the web process and in the worker.
const AI_ENVIRONMENT = {
  SARMATA_AI_ENABLED: '${SARMATA_AI_ENABLED}',
  SARMATA_AI_TEXT_BASE_URL: '${SARMATA_AI_TEXT_BASE_URL}',
  SARMATA_AI_TEXT_MODEL: '${SARMATA_AI_TEXT_MODEL}',
  SARMATA_AI_DECISION_BASE_URL: '${SARMATA_AI_DECISION_BASE_URL}',
};
// frontend/web/src/env.ts. No service key: the web app acts with the user's JWT (ADR 0004).
const WEB_ENVIRONMENT = {
  NODE_ENV: 'production',
  SITE_URL: '${SITE_URL}',
  SUPABASE_URL: '${SUPABASE_INTERNAL_URL}',
  SUPABASE_PUBLISHABLE_KEY: '${ANON_KEY}',
  ...AI_ENVIRONMENT,
};
// backend/worker/src/config.ts. The only container with the service key, which bypasses RLS.
const WORKER_ENVIRONMENT = {
  NODE_ENV: 'production',
  SITE_URL: '${SITE_URL}',
  SUPABASE_URL: '${SUPABASE_INTERNAL_URL}',
  SUPABASE_SECRET_KEY: '${SERVICE_ROLE_KEY}',
  SMTP_HOST: '${SMTP_HOST}',
  SMTP_PORT: '${SMTP_PORT}',
  SMTP_USER: '${SMTP_USER}',
  SMTP_PASS: '${SMTP_PASS}',
  SMTP_SENDER_EMAIL: '${SMTP_ADMIN_EMAIL}',
  SMTP_SENDER_NAME: '${SMTP_SENDER_NAME}',
  ...AI_ENVIRONMENT,
};
const WEB_HEALTHCHECK = {
  test: [
    'CMD',
    'node',
    '-e',
    "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))",
  ],
  interval: '10s',
  timeout: '5s',
  retries: 6,
  start_period: '30s',
};

/** An image built locally from the sources (ADR 0003), one per Dockerfile target. */
export interface AppImage {
  readonly target: 'web' | 'worker';
  readonly repository: string;
}

const WEB: AppImage = { target: 'web', repository: 'sarmata/web' };
const WORKER: AppImage = { target: 'worker', repository: 'sarmata/worker' };
/** The same two images in every profile: the worker is a separate container (ADR 0004). */
export const APP_IMAGES: readonly AppImage[] = [WEB, WORKER];

function supabaseServices(config: InstallConfig): readonly string[] {
  if (config.supabase.mode === 'external') return [];
  return config.profile === 'light' ? LIGHT_SUPABASE : FULL_SUPABASE;
}

/** Every service of the installation, sorted, including the on-demand "tools". */
export function servicesFor(
  config: InstallConfig,
  aiRelayPorts: readonly number[] = [],
): readonly string[] {
  const names = new Set([...supabaseServices(config), 'web', 'worker', 'tools']);
  if (aiRelayPorts.length > 0) names.add('ai-relay');
  if (config.profile === 'server') {
    names.add('caddy');
    names.add('backup');
  }
  return [...names].sort();
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] | null =>
  Array.isArray(value) ? value.map((entry: unknown) => String(entry)) : null;

/** Light, localhost exposure and server bind to loopback. Standard in the LAN binds everywhere. */
const bindPrefix = (config: InstallConfig): string =>
  config.profile === 'standard' && config.exposure === 'lan' ? '' : '127.0.0.1:';

function rewriteVolume(entry: string): string {
  if (!entry.startsWith('./volumes/')) return entry;
  const [hostPath = '', containerPath = '', ...options] = entry.split(':');
  const named = DATA_VOLUMES[hostPath];
  if (named !== undefined) return `${named}:${containerPath}`;
  return [`${SUPABASE_FILES}/${hostPath.slice(2)}`, containerPath, ...options].join(':');
}

function adaptSupabaseService(
  name: string,
  original: ComposeService,
  kept: readonly string[],
  config: InstallConfig,
): ComposeService {
  const service: ComposeService = { ...original };
  // Compose names containers after the project, so a second Supabase on the machine does not clash.
  delete service.container_name;
  if (isRecord(original.depends_on)) {
    const dependencies = Object.entries(original.depends_on).filter(([dependency]) =>
      kept.includes(dependency),
    );
    if (dependencies.length > 0) service.depends_on = Object.fromEntries(dependencies);
    else delete service.depends_on;
  }
  const volumes = stringList(original.volumes);
  if (volumes !== null) service.volumes = volumes.map(rewriteVolume);
  if (name === 'kong') service.ports = [`${bindPrefix(config)}${API_PORT}:8000`];
  if (name === 'auth' && isRecord(original.environment)) {
    service.environment = { ...original.environment, ...AUTH_HOOK };
  }
  return service;
}

function appService(
  image: AppImage,
  local: boolean,
  environment: Record<string, string>,
  extra: ComposeService,
): ComposeService {
  return {
    image: `${image.repository}:current`,
    pull_policy: 'never',
    restart: 'unless-stopped',
    ...(local
      ? {
          depends_on: {
            kong: { condition: 'service_healthy' },
            auth: { condition: 'service_healthy' },
          },
        }
      : {}),
    environment,
    extra_hosts: ['host.docker.internal:host-gateway'],
    ...extra,
  };
}

/**
 * Exposes native AI ports (listening on 127.0.0.1) on the docker0 gateway only, where
 * host.docker.internal:host-gateway points. $$ keeps compose from interpolating shell variables.
 */
function relayService(ports: readonly number[]): ComposeService {
  const forwards = ports
    .map((port) => `socat TCP-LISTEN:${port},bind=$$gateway,fork,reuseaddr TCP:127.0.0.1:${port} &`)
    .join(' ');
  return {
    image: RELAY_IMAGE,
    restart: 'unless-stopped',
    network_mode: 'host',
    entrypoint: ['/bin/sh', '-c'],
    command: [
      `gateway=$$(ip -4 -o addr show docker0 | awk '{ split($$4, a, "/"); print a[1] }'); ` +
        `[ -n "$$gateway" ] || { echo "docker0 has no IPv4 address" >&2; exit 1; }; ${forwards} wait`,
    ],
  };
}

function dbToolEnvironment(local: boolean): Record<string, string> {
  return local
    ? {
        DATABASE_URL: 'postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres',
        BACKUP_DATABASE_URL: 'postgres://supabase_admin:${POSTGRES_PASSWORD}@db:5432/postgres',
        BACKUP_SCOPE: 'full',
      }
    : {
        DATABASE_URL: '${EXTERNAL_DATABASE_URL}',
        BACKUP_DATABASE_URL: '${EXTERNAL_DATABASE_URL}',
        BACKUP_SCOPE: 'app',
      };
}

function namedVolumes(services: Readonly<Record<string, ComposeService>>): string[] {
  const names = new Set<string>();
  for (const service of Object.values(services)) {
    for (const entry of stringList(service.volumes) ?? []) {
      const source = entry.split(':')[0] ?? '';
      if (source !== '' && !source.startsWith('.') && !source.startsWith('/')) names.add(source);
    }
  }
  return [...names].sort();
}

/**
 * compose.yaml of an installation: the upstream services of the profile plus our services.
 * aiRelayPorts: native AI ports to expose to containers (Linux and WSL with AI enabled).
 */
export function renderCompose(
  upstreamYaml: string,
  config: InstallConfig,
  aiRelayPorts: readonly number[] = [],
): string {
  const upstream = parse(upstreamYaml) as UpstreamCompose;
  const kept = supabaseServices(config);
  const local = kept.length > 0;
  const services: Record<string, ComposeService> = {};
  for (const name of kept) {
    const original = upstream.services[name];
    if (original === undefined) throw new Error(`upstream compose has no service "${name}"`);
    services[name] = adaptSupabaseService(name, original, kept, config);
  }

  const webPorts = config.profile === 'server' ? [] : [`${bindPrefix(config)}${APP_PORT}:3000`];
  services.web = appService(WEB, local, WEB_ENVIRONMENT, {
    healthcheck: WEB_HEALTHCHECK,
    ...(webPorts.length > 0 ? { ports: webPorts } : {}),
  });
  services.worker = appService(WORKER, local, WORKER_ENVIRONMENT, {});
  if (aiRelayPorts.length > 0) services['ai-relay'] = relayService(aiRelayPorts);

  services.tools = {
    image: TOOLS_IMAGE,
    profiles: ['tools'],
    entrypoint: DBTOOL_ENTRYPOINT,
    environment: dbToolEnvironment(local),
    volumes: [
      MIGRATIONS_MOUNT,
      DBTOOL_MOUNT,
      BACKUPS_MOUNT,
      ...(local ? ['db-data:/data/db', 'db-rollback:/data/rollback'] : []),
    ],
  };

  if (config.profile === 'server') {
    services.caddy = {
      image: CADDY_IMAGE,
      restart: 'unless-stopped',
      ports: ['80:80', '443:443'],
      depends_on: {
        web: { condition: 'service_healthy' },
        ...(local ? { kong: { condition: 'service_healthy' } } : {}),
      },
      volumes: [
        './Caddyfile:/etc/caddy/Caddyfile:ro',
        'caddy-data:/data',
        'caddy-config:/config',
        ...(config.tls.mode === 'files' ? ['./certs:/certs:ro'] : []),
      ],
    };
    services.backup = {
      image: TOOLS_IMAGE,
      restart: 'unless-stopped',
      entrypoint: DBTOOL_ENTRYPOINT,
      command: ['schedule'],
      environment: dbToolEnvironment(local),
      volumes: [DBTOOL_MOUNT, BACKUPS_MOUNT],
      ...(local ? { depends_on: { db: { condition: 'service_healthy' } } } : {}),
    };
  }

  const volumes = Object.fromEntries(namedVolumes(services).map((name) => [name, {}]));
  return stringify({ name: 'sarmata', services, volumes }, { lineWidth: 0 });
}

/** Variables compose must find in .env: ${NAME} without a default value. */
export function composeVariables(composeYaml: string): string[] {
  const names = new Set<string>();
  const text = composeYaml.replaceAll('$$', '');
  for (const match of text.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)(:?[-?+][^}$]*)?\}/g)) {
    const name = match[1];
    const modifier = match[2];
    if (name !== undefined && (modifier === undefined || modifier.includes('?'))) names.add(name);
  }
  return [...names].sort();
}
