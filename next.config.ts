import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Raw payloads are read as bytes in Node, never in the edge runtime.
    serverActions: { bodySizeLimit: "1mb" },
  },
};

export default nextConfig;
