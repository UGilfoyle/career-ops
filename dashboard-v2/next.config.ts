import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
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
