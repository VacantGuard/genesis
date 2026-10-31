import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["libsql"],
  serverActions: {
    bodySizeLimit: "5mb",
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
