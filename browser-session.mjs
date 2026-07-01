/**
 * browser-session.mjs — Attach Playwright to an existing Chromium-based browser
 * (Brave) via CDP and open a new tab instead of launching a separate window.
 */

const DEFAULT_CDP_URL = 'http://127.0.0.1:9222';

export function resolveCdpUrl() {
  return (
    process.env.BRAVE_CDP_URL ||
    process.env.CAREER_OPS_CDP_URL ||
    process.env.CDP_URL ||
    DEFAULT_CDP_URL
  );
}

export function shouldPreferBraveCdp() {
  if (process.env.GITHUB_ACTIONS || process.env.CI) return false;

  const mode = String(
    process.env.AUTO_APPLY_BROWSER || process.env.CAREER_OPS_BROWSER || 'brave-cdp',
  ).toLowerCase();

  if (mode === 'launch' || mode === 'playwright') return false;
  return mode === 'brave-cdp' || mode === 'cdp' || mode === 'brave';
}

export function braveCdpSetupHint(cdpUrl = resolveCdpUrl()) {
  const port = (() => {
    try {
      return new URL(cdpUrl).port || '9222';
    } catch {
      return '9222';
    }
  })();

  return [
    'Connect auto-apply to your open Brave browser:',
    `  1. Quit Brave completely`,
    `  2. Relaunch with remote debugging:`,
    `     open -a "Brave Browser" --args --remote-debugging-port=${port}`,
    `  3. Re-run auto-apply (a new tab will open — your other tabs stay open)`,
    '',
    `Or set BRAVE_CDP_URL if you use a different port (current: ${cdpUrl}).`,
    'Set AUTO_APPLY_BROWSER=launch to use a separate Playwright window instead.',
  ].join('\n');
}

/**
 * Open a page for auto-apply: prefer an existing Brave tab via CDP.
 *
 * @param {import('playwright').Chromium} chromium
 * @param {{ headless?: boolean }} [options]
 * @returns {Promise<{
 *   browser: import('playwright').Browser,
 *   context: import('playwright').BrowserContext,
 *   page: import('playwright').Page,
 *   mode: 'cdp' | 'launch',
 *   cleanup: (opts?: { closePage?: boolean }) => Promise<void>,
 * }>}
 */
export async function openApplyBrowser(chromium, { headless = false } = {}) {
  if (shouldPreferBraveCdp()) {
    const cdpUrl = resolveCdpUrl();
    try {
      const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 8000 });
      const contexts = browser.contexts();
      const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
      const page = await context.newPage();

      console.log(`🦁 Connected to Brave via CDP (${cdpUrl}) — opened a new tab.`);

      return {
        browser,
        context,
        page,
        mode: 'cdp',
        cleanup: async ({ closePage = false } = {}) => {
          if (closePage && page && !page.isClosed()) {
            await page.close().catch(() => {});
          }
          // Never browser.close() in CDP mode — that would quit Brave entirely.
        },
      };
    } catch (err) {
      const strict = process.env.CAREER_OPS_BROWSER_STRICT === '1';
      const message = `Could not connect to Brave at ${cdpUrl}: ${err.message}`;

      if (strict) {
        throw new Error(`${message}\n\n${braveCdpSetupHint(cdpUrl)}`);
      }

      console.warn(`⚠ ${message}`);
      console.warn(braveCdpSetupHint(cdpUrl));
      throw new Error('Brave CDP connection required for auto-apply. See setup steps above.');
    }
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`🌐 Launched separate Playwright browser (${headless ? 'headless' : 'headed'}).`);

  return {
    browser,
    context,
    page,
    mode: 'launch',
    cleanup: async ({ closePage = false } = {}) => {
      if (closePage && page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
      await browser.close().catch(() => {});
    },
  };
}
