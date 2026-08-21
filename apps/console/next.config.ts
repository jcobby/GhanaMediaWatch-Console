import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @dawuro/core ships raw TypeScript rather than a build step: one source of
  // truth, no stale dist/ to get out of sync with the phone app.
  transpilePackages: ['@dawuro/core'],
  typedRoutes: true,
  experimental: {
    // Route handlers proxy the backend, so the browser never holds a token.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
