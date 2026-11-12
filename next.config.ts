import type { NextConfig } from 'next';

/**
 * One build mode: the whole app, served by Next (Vercel in production, or
 * `next start` locally). The fees desk needs a server because balances are
 * derived per request and decisions are written back, so there is deliberately
 * no static-export path.
 */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

export default nextConfig;
