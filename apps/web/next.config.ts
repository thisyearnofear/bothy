import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const agent = process.env.AGENT_URL ?? "http://localhost:8787";
    return [{ source: "/api/:path*", destination: `${agent}/api/:path*` }];
  },
};

export default nextConfig;