import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const agent = process.env.AGENT_URL ?? "http://localhost:8787";
    return [
      {
        // Everything under /api is proxied to the agent EXCEPT the two paths
        // handled locally by this app:
        //
        //   /api/defense/*  the SSO session bridge (must attach the bearer)
        //   /api/auth/*     login / callback / logout
        //
        // The exclusion is required, not an optimisation. A bare array is an
        // `afterFiles` rewrite, and per Next's documented routing order
        // `afterFiles` (step 6) is checked BEFORE dynamic routes (step 7), so a
        // catch-all `/api/:path*` rewrite would shadow the dynamic
        // `app/api/defense/[...path]/route.ts` and forward defence traffic to
        // the agent unauthenticated. The static auth routes win only because
        // non-dynamic files are served at step 5 - do not rely on that.
        source: "/api/:path((?!defense|auth).*)",
        destination: `${agent}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;