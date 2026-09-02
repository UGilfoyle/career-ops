/**
 * portals/scrapers/stealth-browser.mjs — Stealth browser session with Obscura CDP + Playwright fallback.
 * 
 * Provides:
 * 1. Obscura Engine connection via CDP (ws://127.0.0.1:9222) — ~30MB RAM & hardware fingerprint spoofing.
 * 2. 100% Guaranteed Fallback to Standard Playwright Chromium if Obscura daemon is not running.
 * 3. Zero breaking changes for CI/CD, unit tests, or existing scraper logic.
 */
import { chromium } from 'playwright';

const OBSCURA_CDP_URL = process.env.OBSCURA_CDP_URL || process.env.CDP_URL || 'http://127.0.0.1:9222';

/**
 * Checks if Obscura / CDP daemon is currently reachable
 */
export async function isObscuraDaemonAvailable(cdpUrl = OBSCURA_CDP_URL) {
  try {
    const res = await fetch(`${cdpUrl}/json/version`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Open a stealth scraper session (Obscura CDP if running, standard Chromium fallback)
 * @param {Object} options
 * @param {string} [options.userAgent]
 * @param {{ width: number, height: number }} [options.viewport]
 * @returns {Promise<{ browser: any, context: any, page: any, engine: 'obscura_cdp'|'playwright_chromium', close: () => Promise<void> }>}
 */
export async function openStealthScraperSession(options = {}) {
  const {
    userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport = { width: 1280, height: 800 },
  } = options;

  // 1. Try Obscura Rust CDP if available
  const available = await isObscuraDaemonAvailable();
  if (available) {
    try {
      const browser = await chromium.connectOverCDP(OBSCURA_CDP_URL, { timeout: 3000 });
      const context = browser.contexts().length > 0 ? browser.contexts()[0] : await browser.newContext({ userAgent, viewport });
      const page = await context.newPage();
      return {
        browser,
        context,
        page,
        engine: 'obscura_cdp',
        close: async () => {
          if (!page.isClosed()) await page.close().catch(() => {});
        },
      };
    } catch (err) {
      console.warn(`[Stealth-Browser] Obscura CDP connect failed (${err.message}). Using Playwright Chromium fallback.`);
    }
  }

  // 2. Resilient Standard Playwright Chromium Fallback
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent, viewport });
  const page = await context.newPage();
  return {
    browser,
    context,
    page,
    engine: 'playwright_chromium',
    close: async () => {
      await browser.close().catch(() => {});
    },
  };
}
