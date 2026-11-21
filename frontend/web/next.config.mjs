import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages export TypeScript sources, Next compiles them with the app.
  transpilePackages: [
    '@sarmata/ui',
    '@sarmata/services',
    '@sarmata/repositories',
    '@sarmata/database',
    '@sarmata/domain',
  ],
  poweredByHeader: false,
  // Self-contained server for the Docker image (infra/deploy/docker/app.Dockerfile, ADR 0003).
  output: 'standalone',
  // Trace workspace packages from the monorepo root, so the standalone output includes them.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
};

export default nextConfig;
