import type { InstallConfig } from './config.ts';

/**
 * Caddyfile of the server profile: HTTPS with the office certificate or Caddy's internal CA,
 * Supabase API paths to Kong (local Supabase), everything else to the app.
 */
export function renderCaddyfile(config: InstallConfig): string {
  if (config.profile !== 'server') throw new Error('Caddy runs only in the server profile');
  const tls = config.tls.mode === 'files' ? 'tls /certs/cert.pem /certs/key.pem' : 'tls internal';
  const lines = [
    '{',
    '\tadmin off',
    '\tskip_install_trust',
    '}',
    '',
    `${config.host} {`,
    `\t${tls}`,
    '\tencode zstd gzip',
  ];
  if (config.supabase.mode === 'local') {
    lines.push(
      '',
      '\t@supabase path /auth/v1/* /rest/v1/* /storage/v1/*',
      '\thandle @supabase {',
      '\t\treverse_proxy kong:8000',
      '\t}',
    );
  }
  lines.push('', '\thandle {', '\t\treverse_proxy web:3000', '\t}', '}', '');
  return lines.join('\n');
}
