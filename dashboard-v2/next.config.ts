import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": [
      "./scripts/**/*",
      "./templates/**/*",
      "../gcc-classify.mjs",
      "../templates/gcc-companies.yml",
      "./portals/**/*",
      "./runtime-assets/**/*",
      "./config/**/*",
      "./data/**/*",
      "./fonts/**/*",
    ],
  },
};

export default nextConfig;
