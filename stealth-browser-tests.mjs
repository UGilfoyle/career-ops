/**
 * stealth-browser-tests.mjs — Verification tests for Obscura + Playwright stealth session.
 */
import assert from 'node:assert';
import { isObscuraDaemonAvailable, openStealthScraperSession } from './portals/scrapers/stealth-browser.mjs';

async function main() {
  console.log('🧪 Testing stealth-browser integration & fallback resilience...');

  // Test 1: Liveness check is non-throwing
  const available = await isObscuraDaemonAvailable('http://127.0.0.1:9999');
  assert.strictEqual(available, false, 'Unreachable port returns false without throwing');
  console.log('  ✅ Non-throwing daemon probe verified');

  // Test 2: Launch and navigate
  const session = await openStealthScraperSession({ timeout: 500 });
  assert(session && session.page && typeof session.close === 'function', 'Session contains page and close handler');
  console.log(`  ✅ Session opened in engine mode: ${session.engine}`);

  await session.page.setContent('<html><body><div id="test">CareerOps Stealth Test</div></body></html>');
  const text = await session.page.evaluate(() => document.getElementById('test')?.innerText);
  assert.strictEqual(text, 'CareerOps Stealth Test', 'DOM evaluated correctly');
  console.log('  ✅ In-browser DOM evaluation verified');

  await session.close();
  console.log('  ✅ Session closed cleanly');
  console.log('🟢 All stealth-browser tests passed!');
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('❌ Stealth browser test failed:', err);
  process.exit(1);
});
