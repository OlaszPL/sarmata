import type { InstallConfig } from './config.ts';
import { usesCaddy } from './profiles.ts';

/**
 * Caddyfile of an installation reachable from the LAN: HTTPS with the office certificate or
 * Caddy's internal CA, everything to the app. The app talks to Supabase server side, so only the
 * auth paths that e-mail links open in the browser go to Kong (local Supabase). REST, storage and
 * Studio stay on the loopback.
 */
export function renderCaddyfile(config: InstallConfig): string {
  if (!usesCaddy(config)) throw new Error('Caddy runs only for access from the office network');
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
    lines.push('', '\thandle /auth/v1/* {', '\t\treverse_proxy kong:8000', '\t}');
  }
  lines.push('', '\thandle {', '\t\treverse_proxy web:3000', '\t}', '}', '');
  return lines.join('\n');
}
