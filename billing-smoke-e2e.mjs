/**
 * billing-smoke-e2e.mjs — smoke + e2e against local Next (optional)
 *
 * Usage:
 *   node billing-smoke-e2e.mjs              # smoke file + HTTP if server up
 *   BILLING_E2E=1 node billing-smoke-e2e.mjs  # fail if localhost:3000 down
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const BASE = process.env.BILLING_SMOKE_URL || 'http://localhost:3000';
const STRICT = process.env.BILLING_E2E === '1';

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(n) {
  console.log(`  ✅ ${n}`);
  passed++;
}
function bad(n, e) {
  console.log(`  ❌ ${n}: ${e?.message || e}`);
  failed++;
}
function skip(n) {
  console.log(`  ⏭  ${n}`);
  skipped++;
}

async function fetchStatus(path) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), body: await res.text() };
}

console.log('\n🔥 billing smoke + e2e\n');

console.log('1. Smoke — critical UI strings');
try {
  const sim = readFileSync(join(ROOT, 'dashboard-v2/src/app/billing/simulate/BillingSimulateClient.tsx'), 'utf8');
  assert.ok(sim.includes('Simulate'));
  assert.ok(sim.includes('Approve'));
  assert.ok(sim.includes('akashkaintura@icici') || sim.includes('%40icici'));
  ok('simulate client has pay + approve flow');
} catch (e) {
  bad('simulate client', e);
}

try {
  const upiPage = readFileSync(join(ROOT, 'dashboard-v2/src/app/billing/upi/page.tsx'), 'utf8');
  assert.ok(upiPage.includes('/api/billing/upi'));
  assert.ok(upiPage.includes('Submit payment'));
  ok('real UPI page wires claim API');
} catch (e) {
  bad('upi page', e);
}

try {
  const admin = readFileSync(join(ROOT, 'dashboard-v2/src/components/AdminPaymentsPanel.tsx'), 'utf8');
  assert.ok(admin.includes('/api/billing/upi/claims'));
  assert.ok(admin.includes("action: 'approve'") || admin.includes('approve'));
  assert.ok(admin.includes('reject'));
  ok('admin payments panel wired');
} catch (e) {
  bad('admin panel', e);
}

console.log('\n2. E2E HTTP — local server');
let serverUp = false;
try {
  const r = await fetch(BASE, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
  serverUp = r.status > 0;
} catch {
  serverUp = false;
}

if (!serverUp) {
  if (STRICT) {
    bad('localhost server', new Error(`${BASE} not reachable (start npm run dev)`));
  } else {
    skip(`server not running at ${BASE} — HTTP e2e skipped (set BILLING_E2E=1 to require)`);
  }
} else {
  try {
    const { status, body } = await fetchStatus('/billing/simulate');
    assert.equal(status, 200);
    assert.ok(body.includes('billing') || body.includes('Simulate') || body.includes('Career-Ops') || body.includes('__next'));
    ok('/billing/simulate → 200 (public)');
  } catch (e) {
    bad('/billing/simulate', e);
  }

  try {
    const { status } = await fetchStatus('/billing/upi');
    assert.ok(status === 307 || status === 302 || status === 200);
    ok(`/billing/upi → ${status} (auth-gated or ok)`);
  } catch (e) {
    bad('/billing/upi', e);
  }

  try {
    const { status } = await fetchStatus('/api/billing/plans');
    assert.ok([200, 401, 403, 405].includes(status), `unexpected ${status}`);
    ok(`/api/billing/plans → ${status}`);
  } catch (e) {
    bad('/api/billing/plans', e);
  }

  try {
    const { status } = await fetchStatus('/api/billing/upi/claims');
    assert.ok([401, 403].includes(status), `unexpected ${status}`);
    ok(`/api/billing/upi/claims → ${status} (admin only)`);
  } catch (e) {
    bad('/api/billing/upi/claims auth', e);
  }

  // Headless chrome screenshot if available
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(chrome)) {
    const out = join(ROOT, 'output/billing-demo/e2e-smoke.png');
    const r = spawnSync(
      chrome,
      ['--headless=new', '--disable-gpu', '--window-size=1280,900', `--screenshot=${out}`, `${BASE}/billing/simulate?step=admin`],
      { timeout: 30000 },
    );
    if (r.status === 0 && existsSync(out)) ok(`chrome screenshot → ${out}`);
    else skip('chrome screenshot failed');
  } else {
    skip('system Chrome not found for screenshot e2e');
  }
}

console.log(`\n${'─'.repeat(40)}`);
console.log(`billing smoke/e2e: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);
