import { describe, expect, it } from 'vitest';
import { renderBootstrapSql, renderCaddyfile } from './index.ts';
import { config, PROFILES } from './test-support/fixtures.ts';

describe('renderCaddyfile', () => {
  it('server with local Supabase: internal CA, API paths to Kong, the rest to the app', () => {
    const caddyfile = renderCaddyfile(PROFILES.server);
    expect(caddyfile).toContain('oceny.urzad.local {');
    expect(caddyfile).toContain('\ttls internal');
    expect(caddyfile).toContain('@supabase path /auth/v1/* /rest/v1/* /storage/v1/*');
    expect(caddyfile).toContain('reverse_proxy kong:8000');
    expect(caddyfile).toContain('reverse_proxy web:3000');
  });

  it('uses the office certificate when given', () => {
    const withFiles = config({
      ...PROFILES.server,
      tls: { mode: 'files', certPath: '/etc/ssl/oceny.pem', keyPath: '/etc/ssl/oceny.key' },
    });
    expect(renderCaddyfile(withFiles)).toContain('tls /certs/cert.pem /certs/key.pem');
  });

  it('with an external Supabase proxies only the app', () => {
    const external = config({
      ...PROFILES.server,
      supabase: { mode: 'external', url: 'https://abc.supabase.co' },
    });
    expect(renderCaddyfile(external)).not.toContain('kong');
  });

  it('refuses profiles without Caddy', () => {
    expect(() => renderCaddyfile(PROFILES.light)).toThrow(/server profile/);
  });
});

describe('renderBootstrapSql', () => {
  it('escapes quotes, hashes the password in the database and lowercases the e-mail', () => {
    const sql = renderBootstrapSql({
      officeName: "Urząd 'Testowy'",
      email: 'Admin@Urzad.test',
      password: "pa'ss",
      firstName: 'Anna',
      lastName: "O'Neil",
    });
    expect(sql).toContain("insert into public.offices (name) values ('Urząd ''Testowy''')");
    expect(sql).toContain("extensions.crypt('pa''ss', extensions.gen_salt('bf'))");
    expect(sql).toContain("lower('Admin@Urzad.test')");
    expect(sql).toMatch(/^do \$bootstrap\$$/m);
  });

  it('picks another dollar-quote tag when a value contains the default one', () => {
    const sql = renderBootstrapSql({
      officeName: 'Urząd',
      email: 'a@b.test',
      password: 'x$bootstrap$y',
      firstName: 'A',
      lastName: 'B',
    });
    expect(sql).toMatch(/^do \$bootstrap_x\$$/m);
    expect(sql).toMatch(/^\$bootstrap_x\$;$/m);
  });
});
