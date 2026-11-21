import { describe, expect, it } from 'vitest';
import { renderBootstrapSql, renderCaddyfile } from './index.ts';
import { config, PROFILES } from './test-support/fixtures.ts';

describe('renderCaddyfile', () => {
  it('server with local Supabase: internal CA, only the auth paths to Kong, the rest to the app', () => {
    const caddyfile = renderCaddyfile(PROFILES.server);
    expect(caddyfile).toContain('oceny.urzad.local {');
    expect(caddyfile).toContain('\ttls internal');
    expect(caddyfile).toContain('\thandle /auth/v1/* {\n\t\treverse_proxy kong:8000');
    expect(caddyfile).not.toContain('/rest/v1');
    expect(caddyfile).not.toContain('/storage/v1');
    expect(caddyfile).toContain('reverse_proxy web:3000');
  });

  it('standard in the LAN gets the same HTTPS front', () => {
    expect(renderCaddyfile(PROFILES.standard)).toContain('oceny-pc {');
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

  it('refuses installations reachable only from this computer', () => {
    expect(() => renderCaddyfile(PROFILES.light)).toThrow(/office network/);
  });
});

describe('renderBootstrapSql', () => {
  it('creates the account through access.create_account and escapes quotes', () => {
    const sql = renderBootstrapSql({
      officeName: "Urząd 'Testowy'",
      email: 'Admin@Urzad.test',
      password: "pa'ss",
      firstName: 'Anna',
      lastName: "O'Neil",
    });
    expect(sql).toContain("insert into public.offices (name) values ('Urząd ''Testowy''')");
    expect(sql).toContain('perform access.create_account(');
    expect(sql).toContain("email => 'Admin@Urzad.test'");
    expect(sql).toContain("last_name => 'O''Neil'");
    expect(sql).toMatch(/^do \$bootstrap\$$/m);
  });

  it('keeps the password out of the statement that can fail and out of psql output', () => {
    const sql = renderBootstrapSql({
      officeName: 'Urząd',
      email: 'a@b.test',
      password: 'Tajne-Haslo-2026',
      firstName: 'A',
      lastName: 'B',
    });
    const statements = sql.split(/^do |^\$bootstrap\$;$/m);
    expect(statements[0]).toContain(
      "select from set_config('sarmata.bootstrap_password', 'Tajne-Haslo-2026', false);",
    );
    expect(statements[1]).not.toContain('Tajne-Haslo-2026');
    expect(statements[1]).toContain("password => current_setting('sarmata.bootstrap_password')");
    expect(
      sql.trimEnd().endsWith("select from set_config('sarmata.bootstrap_password', '', false);"),
    ).toBe(true);
  });

  it('picks another dollar-quote tag when a value contains the default one', () => {
    const sql = renderBootstrapSql({
      officeName: 'Urząd $bootstrap$',
      email: 'a@b.test',
      password: 'x-y-z-1234567',
      firstName: 'A',
      lastName: 'B',
    });
    expect(sql).toMatch(/^do \$bootstrap_x\$$/m);
    expect(sql).toMatch(/^\$bootstrap_x\$;$/m);
  });
});
