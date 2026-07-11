import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": [
      "./scripts/**/*",
      "./templates/**/*",
      "../gcc-classify.mjs",
      "../gcc-signal-engine.mjs",
      "../jd-keyword-align.mjs",
      "../jd-profile-match.mjs",
      "../education-format.mjs",
      "../profile-hydrate.mjs",
      "../resume-quality.mjs",
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
