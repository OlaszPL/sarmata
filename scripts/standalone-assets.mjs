// Copies the static assets of the Next.js build into its standalone output, the same layout the
// Docker image builds (infra/deploy/docker/app.Dockerfile), so `pnpm start` can run server.js directly.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../frontend/web/', import.meta.url));
const standalone = `${web}.next/standalone/frontend/web/`;

if (!existsSync(`${standalone}server.js`)) {
  console.error('No standalone build in frontend/web/.next/standalone. Run pnpm build.');
  process.exit(1);
}

for (const [from, to] of [
  [`${web}.next/static`, `${standalone}.next/static`],
  [`${web}public`, `${standalone}public`],
]) {
  if (!existsSync(from)) continue;
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}
console.log('Copied static assets into the standalone build');
