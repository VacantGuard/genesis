import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["libsql"],
  experimental: {
    serverActions: {
      // Vercel refuses request bodies over 4.5 MB. Stay under that.
      bodySizeLimit: "4mb",
    },
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
