import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["libsql"],
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
