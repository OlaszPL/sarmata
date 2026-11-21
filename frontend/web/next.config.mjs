import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages export TypeScript sources, Next compiles them with the app. The list holds
  // @sarmata/services, @sarmata/ui and their internal packages (the dependency graph).
  transpilePackages: [
    '@sarmata/ui',
    '@sarmata/services',
    '@sarmata/repositories',
    '@sarmata/database',
    '@sarmata/domain',
    '@sarmata/regulations',
    '@sarmata/exports',
  ],
  // Native Typst module (napi): Next must not bundle it, it loads from node_modules at runtime.
  serverExternalPackages: ['@myriaddreamin/typst-ts-node-compiler'],
  poweredByHeader: false,
  // Self-contained server for the Docker image (infra/deploy/docker/app.Dockerfile, ADR 0003).
  output: 'standalone',
  // Trace workspace packages from the monorepo root, so the standalone output includes them.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // Typst reads the font files at runtime (backend/exports/src/pdf/font.ts), tracing cannot see them.
  // The standalone output must contain them, the Docker image copies that output.
  outputFileTracingIncludes: {
    '/api/oceny/**/*': ['../../backend/exports/fonts/**/*'],
  },
};

export default nextConfig;
