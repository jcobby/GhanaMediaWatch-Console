import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Somewhere other than `.next`, when asked.
   *
   * `next build` and `next dev` both write to `.next`, so running a build while
   * a dev server is up corrupts the running server: pages start answering 500
   * with fully-rendered HTML, and client navigations fail with "Server action
   * not found" because the action ids no longer match the bundle being served.
   * It looks like an application bug and is not one.
   *
   * Set `DAWURO_DIST_DIR` to build or run a second instance beside a live dev
   * server without touching it. Unset — the normal case — nothing changes.
   */
  ...(process.env.DAWURO_DIST_DIR ? { distDir: process.env.DAWURO_DIST_DIR } : {}),
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
