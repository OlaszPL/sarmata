import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  answersSchema,
  dockerCliConfigWithPlugins,
  installConfigSchema,
  isHostName,
  PROFILE_TABLE,
  wslConfigNote,
} from './index.ts';
import { BASE_CONFIG, PROFILES, windowsEnvironment } from './test-support/fixtures.ts';

const issues = (value: unknown): string[] => {
  const result = installConfigSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
};

describe('installConfigSchema with the profile table', () => {
  it('allows the exposures the table lists for each profile', () => {
    expect(
      issues({ ...BASE_CONFIG, exposure: 'lan', host: 'pc', tls: { mode: 'internal' } }),
    ).toContain('exposure');
    expect(issues(PROFILES.standard)).toEqual([]);
    expect(issues(PROFILES.standardLocal)).toEqual([]);
    expect(
      issues({
        ...PROFILES.server,
        exposure: 'localhost',
        host: 'localhost',
        tls: { mode: 'none' },
      }),
    ).toContain('exposure');
  });

  it('requires HTTPS exactly when the app is reachable from the LAN', () => {
    expect(issues({ ...PROFILES.standard, tls: { mode: 'none' } })).toContain('tls');
    expect(issues({ ...PROFILES.standardLocal, tls: { mode: 'internal' } })).toContain('tls');
  });

  it('takes only DNS names and IP addresses as host', () => {
    expect(issues({ ...PROFILES.server, host: 'oceny pc {' })).toContain('host');
    expect(issues({ ...PROFILES.server, host: 'oceny.urzad.local\n\trespond 200' })).toContain(
      'host',
    );
    expect(isHostName('10.0.0.15')).toBe(true);
    expect(isHostName('fe80::1')).toBe(true);
    expect(isHostName('OCENY-PC')).toBe(true);
    expect(isHostName('-pc')).toBe(false);
  });

  it('offers the server profile on Linux only', () => {
    expect(PROFILE_TABLE.server.systems).toEqual(['linux']);
    expect(PROFILE_TABLE.light.systems).toContain('windows');
  });
});

describe('dockerCliConfigWithPlugins', () => {
  it('adds the Homebrew plugin directory once and keeps the other settings', () => {
    const next = dockerCliConfigWithPlugins(
      '{"auths":{},"cliPluginsExtraDirs":["/x"]}',
      '/opt/homebrew',
    );
    expect(JSON.parse(next ?? '')).toEqual({
      auths: {},
      cliPluginsExtraDirs: ['/x', '/opt/homebrew/lib/docker/cli-plugins'],
    });
    expect(dockerCliConfigWithPlugins(next, '/opt/homebrew')).toBeNull();
    expect(dockerCliConfigWithPlugins(null, '/opt/homebrew')).toContain('cli-plugins');
  });

  it('refuses a file that is not a JSON object', () => {
    expect(() => dockerCliConfigWithPlugins('[]', '/opt/homebrew')).toThrow(/JSON object/);
  });
});

describe('wslConfigNote', () => {
  it('says that .wslconfig changes every WSL distro of the account', () => {
    expect(wslConfigNote(windowsEnvironment(), PROFILES.standard)).toContain(
      'wszystkich dystrybucji WSL',
    );
    expect(
      wslConfigNote(
        windowsEnvironment({ wslConfig: '[general]\ninstanceIdleTimeout=-1\n' }),
        PROFILES.light,
      ),
    ).toBeNull();
  });
});

describe('examples', () => {
  it.each(['light', 'standard', 'server', 'external'])(
    '%s.json is a valid answers file',
    (name) => {
      const text = readFileSync(new URL(`../examples/${name}.json`, import.meta.url), 'utf8');
      expect(answersSchema.safeParse(JSON.parse(text)).success).toBe(true);
    },
  );
});
