import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  composeVariables,
  parseEnv,
  renderCompose,
  renderEnv,
  servicesFor,
  type InstallConfig,
} from './index.ts';
import {
  PROFILE_NAMES,
  PROFILES,
  secrets,
  upstreamCompose,
  type ProfileName,
} from './test-support/fixtures.ts';

type Service = Record<string, unknown>;

interface Compose {
  readonly name: string;
  readonly services: Record<string, Service | undefined>;
  readonly volumes: Record<string, unknown>;
}

const render = (config: InstallConfig): Compose =>
  parse(renderCompose(upstreamCompose(), config)) as Compose;

const EXPECTED: Readonly<Record<ProfileName, readonly string[]>> = {
  light: ['auth', 'db', 'kong', 'rest', 'tools', 'web', 'worker'],
  standard: [
    'auth',
    'db',
    'imgproxy',
    'kong',
    'meta',
    'rest',
    'storage',
    'studio',
    'tools',
    'web',
    'worker',
  ],
  server: [
    'auth',
    'backup',
    'caddy',
    'db',
    'imgproxy',
    'kong',
    'meta',
    'rest',
    'storage',
    'studio',
    'tools',
    'web',
    'worker',
  ],
  external: ['tools', 'web', 'worker'],
  withAi: [
    'auth',
    'db',
    'imgproxy',
    'kong',
    'meta',
    'rest',
    'storage',
    'studio',
    'tools',
    'web',
    'worker',
  ],
};

describe('servicesFor and renderCompose', () => {
  it.each(PROFILE_NAMES)('%s: the compose file has exactly the services of the profile', (name) => {
    expect(servicesFor(PROFILES[name])).toEqual(EXPECTED[name]);
    expect(Object.keys(render(PROFILES[name]).services).sort()).toEqual(EXPECTED[name]);
  });

  it('light: Kong and the app on localhost, Kong does not wait for Studio', () => {
    const { services } = render(PROFILES.light);
    expect(services.kong?.depends_on).toBeUndefined();
    expect(services.kong?.ports).toEqual(['127.0.0.1:8000:8000']);
    expect(services.web).toMatchObject({
      image: 'sarmata/web:current',
      pull_policy: 'never',
      ports: ['127.0.0.1:3000:3000'],
    });
    expect(services.worker).toMatchObject({
      image: 'sarmata/worker:current',
      pull_policy: 'never',
    });
  });

  it('gives the service key to the worker only, never to the web app (ADR 0004)', () => {
    const { services } = render(PROFILES.light);
    expect(services.web?.environment).not.toHaveProperty('SUPABASE_SECRET_KEY');
    expect(services.web?.environment).toMatchObject({
      SUPABASE_PUBLISHABLE_KEY: '${ANON_KEY}',
      SARMATA_AI_ENABLED: '${SARMATA_AI_ENABLED}',
    });
    expect(services.worker?.environment).toMatchObject({
      SUPABASE_URL: '${SUPABASE_INTERNAL_URL}',
      SUPABASE_SECRET_KEY: '${SERVICE_ROLE_KEY}',
      SARMATA_AI_TEXT_BASE_URL: '${SARMATA_AI_TEXT_BASE_URL}',
    });
  });

  it('AI relay: host network, AI ports bound to the docker0 gateway only', () => {
    const compose = parse(
      renderCompose(upstreamCompose(), PROFILES.withAi, [55491, 8026]),
    ) as Compose;
    expect(servicesFor(PROFILES.withAi, [55491, 8026])).toContain('ai-relay');
    const relay = compose.services['ai-relay'];
    expect(relay).toMatchObject({ image: 'alpine/socat:1.8.1.1', network_mode: 'host' });
    const command = relay?.command;
    const script = Array.isArray(command) ? String(command[0]) : '';
    expect(script).toContain(
      'socat TCP-LISTEN:55491,bind=$$gateway,fork,reuseaddr TCP:127.0.0.1:55491',
    );
    expect(script).toContain(
      'socat TCP-LISTEN:8026,bind=$$gateway,fork,reuseaddr TCP:127.0.0.1:8026',
    );
    expect(script).not.toContain('0.0.0.0');
  });

  it('standard in the LAN: ports on all interfaces, Kong waits for Studio', () => {
    const { services } = render(PROFILES.standard);
    expect(services.kong?.ports).toEqual(['8000:8000']);
    expect(services.kong?.depends_on).toEqual({ studio: { condition: 'service_healthy' } });
    expect(services.web).toMatchObject({ image: 'sarmata/web:current', ports: ['3000:3000'] });
    expect(services.worker).toMatchObject({ image: 'sarmata/worker:current' });
  });

  it('keeps data in named volumes and reads Supabase config files from the vendored sources', () => {
    const compose = render(PROFILES.light);
    expect(compose.name).toBe('sarmata');
    expect(compose.services.db?.volumes).toContain('db-data:/var/lib/postgresql/data');
    expect(compose.services.db?.volumes).toContain(
      './source/infra/deploy/supabase/volumes/db/roles.sql:/docker-entrypoint-initdb.d/init-scripts/99-roles.sql:Z',
    );
    expect(compose.services.kong?.volumes).toContain(
      './source/infra/deploy/supabase/volumes/api/kong.yml:/home/kong/temp.yml:ro,z',
    );
    expect(Object.keys(compose.volumes).sort()).toEqual(['db-config', 'db-data', 'db-rollback']);
  });

  it('drops fixed container names and enables the custom access token hook', () => {
    const { services } = render(PROFILES.standard);
    for (const service of Object.values(services))
      expect(service).not.toHaveProperty('container_name');
    expect(services.auth?.environment).toMatchObject({
      GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED: 'true',
      GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI:
        'pg-functions://postgres/access/custom_access_token_hook',
    });
  });

  it('external Supabase: tools talk to the external database, the app does not wait for Kong', () => {
    const { services } = render(PROFILES.external);
    expect(services.tools?.environment).toEqual({
      DATABASE_URL: '${EXTERNAL_DATABASE_URL}',
      BACKUP_DATABASE_URL: '${EXTERNAL_DATABASE_URL}',
      BACKUP_SCOPE: 'app',
    });
    expect(services.web).not.toHaveProperty('depends_on');
    expect(services.web?.environment).toMatchObject({ SUPABASE_URL: '${SUPABASE_INTERNAL_URL}' });
  });

  it('server: only Caddy is exposed, with the Caddyfile and nightly backups', () => {
    const { services } = render(PROFILES.server);
    expect(services.web).not.toHaveProperty('ports');
    expect(services.caddy).toMatchObject({ image: 'caddy:2.11.9', ports: ['80:80', '443:443'] });
    expect(services.caddy?.volumes).toContain('./Caddyfile:/etc/caddy/Caddyfile:ro');
    expect(services.backup).toMatchObject({ command: ['schedule'] });
  });

  it.each(PROFILE_NAMES)('%s: every variable used by compose is set in .env', (name) => {
    const defined = Object.keys(parseEnv(renderEnv(PROFILES[name], secrets())));
    const missing = composeVariables(renderCompose(upstreamCompose(), PROFILES[name])).filter(
      (variable) => !defined.includes(variable),
    );
    expect(missing).toEqual([]);
  });
});
