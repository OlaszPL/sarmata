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
};

export default nextConfig;
