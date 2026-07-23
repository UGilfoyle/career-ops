import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Chromium/Puppeteer out of the Turbopack/webpack bundle — load at runtime only.
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
  // Do NOT trace Chromium into the Serverless Function zip (symlink / invalid package on Vercel).
  outputFileTracingExcludes: {
    "/api/resume/export-pdf": [
      "./node_modules/@sparticuz/chromium/**/*",
      "./node_modules/@sparticuz/chromium-min/**/*.br",
      "./node_modules/puppeteer-core/.local-chromium/**/*",
    ],
  },
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
    "/api/resume/export-pdf": ["./runtime-assets/generate-pdf.mjs"],
  },
};

export default nextConfig;
