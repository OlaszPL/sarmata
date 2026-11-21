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
  ],
  poweredByHeader: false,
};

export default nextConfig;
