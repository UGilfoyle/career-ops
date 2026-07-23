import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
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
    "/api/resume/export-pdf": [
      "./node_modules/@sparticuz/chromium/**/*",
      "./runtime-assets/generate-pdf.mjs",
    ],
  },
};

export default nextConfig;
