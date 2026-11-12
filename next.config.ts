import type { NextConfig } from "next";

// Security headers (design section 9). Locked decision L32: headers are set here,
// not in middleware/proxy.
const nextConfig: NextConfig = {
  // NOTE: the scaffold enabled `cacheComponents` and `partialPrefetching`. They are off
  // because Cache Components forbids `export const runtime = 'nodejs'` (Locked decision
  // L32) and Itan is dynamic, authenticated code. Logged as D-001 in docs/DEVIATIONS.md.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    const base = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    const noStore = [{ key: "Cache-Control", value: "no-store" }];
    return [
      { source: "/:path*", headers: base },
      { source: "/v/:path*", headers: noStore },
      { source: "/c/:path*", headers: noStore },
      { source: "/api/:path*", headers: noStore },
    ];
  },
};

export default nextConfig;
