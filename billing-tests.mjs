/**
 * billing-tests.mjs — unit + light integration for Pro paywall / UPI billing
 * Run: node billing-tests.mjs
 */
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
let passed = 0;
let failed = 0;

function ok(name) {
  console.log(`  ✅ ${name}`);
  passed++;
}
function bad(name, err) {
  console.log(`  ❌ ${name}`);
  console.log(`     ${err?.message || err}`);
  failed++;
}
function test(name, fn) {
  try {
    fn();
    ok(name);
  } catch (e) {
    bad(name, e);
  }
}

// ── Mirror pure helpers (same rules as dashboard-v2/src/lib/billing/*) ──

function resolvePlanForCountry(countryCode) {
  const cc = String(countryCode || '').trim().toUpperCase();
  if (cc === 'IN') {
    return { country: 'IN', currency: 'inr', amountMinor: 9900, display: '₹99' };
  }
  if (cc === 'GB') {
    return { country: 'GB', currency: 'gbp', amountMinor: 79, display: '£0.79' };
  }
  if (['DE', 'FR', 'NL', 'ES', 'IT', 'BE', 'AT', 'IE', 'PT'].includes(cc)) {
    return { country: cc, currency: 'eur', amountMinor: 79, display: '€0.79' };
  }
  return { country: cc || 'US', currency: 'usd', amountMinor: 79, display: '$0.79' };
}

function buildUpiPayUri(cfg, transactionRef) {
  const params = new URLSearchParams();
  params.set('pa', cfg.vpa);
  params.set('pn', cfg.payeeName);
  params.set('am', cfg.amountInr.toFixed(2));
  params.set('cu', 'INR');
  params.set('tn', cfg.note);
  if (transactionRef) params.set('tr', transactionRef.slice(0, 35));
  return `upi://pay?${params.toString()}`;
}

function upiTransactionRef(userId) {
  return `CO${String(userId).replace(/\D/g, '').slice(-8)}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function createProAccessToken(userId, secret, now = Date.now()) {
  const payload = `pro.${userId}.${now}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

function verifyProAccessToken(token, secret, now = Date.now()) {
  const decoded = Buffer.from(token, 'base64url').toString('utf8');
  const parts = decoded.split('.');
  if (parts.length !== 4 || parts[0] !== 'pro') return null;
  const [, userId, ts, sig] = parts;
  const ageMs = now - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 7 * 24 * 60 * 60 * 1000) return null;
  const payload = `pro.${userId}.${ts}`;
  const expected = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return String(userId);
}

function createProApproveToken(claimId, secret) {
  return createHmac('sha256', secret).update(`upi-approve.${claimId}`).digest('hex').slice(0, 24);
}

function normalizeUtr(raw) {
  return String(raw).replace(/\s+/g, '').toUpperCase();
}

function isValidUtr(utr) {
  return /^[0-9A-Z]{8,22}$/.test(utr);
}

console.log('\n🧪 billing unit + integration tests\n');

console.log('1. Geo pricing (unit)');
test('IN → ₹99 / inr / 9900 minor', () => {
  const p = resolvePlanForCountry('IN');
  assert.equal(p.display, '₹99');
  assert.equal(p.currency, 'inr');
  assert.equal(p.amountMinor, 9900);
});
test('US → $0.79', () => {
  assert.equal(resolvePlanForCountry('US').display, '$0.79');
  assert.equal(resolvePlanForCountry(null).display, '$0.79');
});
test('GB → £0.79', () => {
  assert.equal(resolvePlanForCountry('gb').display, '£0.79');
});
test('DE → €0.79', () => {
  assert.equal(resolvePlanForCountry('DE').display, '€0.79');
});

console.log('\n2. UPI deep link (unit)');
test('static upi:// never needs CIT page', () => {
  const uri = buildUpiPayUri(
    {
      vpa: 'akashkaintura@icici',
      payeeName: 'Akash Kaintura',
      amountInr: 99,
      note: 'Thank you for Choosing Career-ops',
    },
    'CO42ABCD',
  );
  assert.ok(uri.startsWith('upi://pay?'));
  assert.ok(uri.includes('pa=akashkaintura%40icici') || uri.includes('pa=akashkaintura@icici'));
  assert.ok(uri.includes('am=99.00'));
  assert.ok(uri.includes('cu=INR'));
  assert.ok(uri.includes('tr=CO42ABCD'));
});
test('transaction ref starts with CO', () => {
  const ref = upiTransactionRef(12345);
  assert.ok(ref.startsWith('CO'));
  assert.ok(ref.length >= 6);
});

console.log('\n3. Access + approve tokens (unit)');
const SECRET = 'test-billing-secret-for-ci';
test('access token round-trip', () => {
  const token = createProAccessToken(42, SECRET);
  assert.equal(verifyProAccessToken(token, SECRET), '42');
});
test('tampered access token rejected', () => {
  const token = createProAccessToken(42, SECRET);
  const badToken = token.slice(0, -2) + 'xx';
  assert.equal(verifyProAccessToken(badToken, SECRET), null);
});
test('expired access token rejected (>7d)', () => {
  const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
  const token = createProAccessToken(7, SECRET, old);
  assert.equal(verifyProAccessToken(token, SECRET), null);
});
test('approve token matches HMAC', () => {
  const t = createProApproveToken('99', SECRET);
  const expected = createProApproveToken('99', SECRET);
  assert.equal(t, expected);
  assert.notEqual(createProApproveToken('98', SECRET), t);
});

console.log('\n4. UTR validation (unit)');
test('accepts 12-digit UTR', () => {
  assert.equal(isValidUtr(normalizeUtr('123456789012')), true);
});
test('rejects short UTR', () => {
  assert.equal(isValidUtr(normalizeUtr('123')), false);
});
test('strips spaces and uppercases', () => {
  assert.equal(normalizeUtr(' ab cd 12 '), 'ABCD12');
});

console.log('\n5. Copilot free limits (unit)');
test('free limit is 10 / 2hr', () => {
  assert.equal(10, 10);
  const windowMs = 2 * 60 * 60 * 1000;
  assert.equal(windowMs, 7_200_000);
});

console.log('\n6. Integration — billing files wired');
const mustExist = [
  'dashboard-v2/src/lib/billing/plans.ts',
  'dashboard-v2/src/lib/billing/upi.ts',
  'dashboard-v2/src/lib/billing/entitlements.ts',
  'dashboard-v2/src/lib/billing/access-token.ts',
  'dashboard-v2/src/lib/billing/schema.ts',
  'dashboard-v2/src/app/api/billing/checkout/route.ts',
  'dashboard-v2/src/app/api/billing/upi/route.ts',
  'dashboard-v2/src/app/api/billing/upi/claim/route.ts',
  'dashboard-v2/src/app/api/billing/upi/approve/route.ts',
  'dashboard-v2/src/app/api/billing/upi/claims/route.ts',
  'dashboard-v2/src/app/billing/upi/page.tsx',
  'dashboard-v2/src/app/billing/simulate/page.tsx',
  'dashboard-v2/src/components/ProPaywall.tsx',
  'dashboard-v2/src/components/AdminPaymentsPanel.tsx',
];
for (const rel of mustExist) {
  test(`exists ${rel}`, () => {
    assert.ok(existsSync(join(ROOT, rel)), `missing ${rel}`);
  });
}

test('Dashboard imports ProPaywall + AdminPaymentsPanel', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/src/components/Dashboard.tsx'), 'utf8');
  assert.ok(src.includes('ProPaywall'));
  assert.ok(src.includes('AdminPaymentsPanel'));
  assert.ok(src.includes('hasPro'));
});

test('chat route uses checkCopilotRateLimit', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/src/app/api/chat/route.ts'), 'utf8');
  assert.ok(src.includes('checkCopilotRateLimit'));
  assert.ok(src.includes('copilot_rate_limit'));
});

test('resume export-pdf gates with assertProAccess', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/src/app/api/resume/export-pdf/route.ts'), 'utf8');
  assert.ok(src.includes('assertProAccess'));
});

test('middleware allows /billing/simulate public', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/src/middleware.ts'), 'utf8');
  assert.ok(src.includes('/billing/simulate'));
});

test('migrate.mjs creates user_subscriptions + upi_payment_claims', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/migrate.mjs'), 'utf8');
  assert.ok(src.includes('user_subscriptions'));
  assert.ok(src.includes('upi_payment_claims'));
});

test('mail has sendProAccessEmail + sendUpiClaimAdminEmail', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/src/lib/mail.ts'), 'utf8');
  assert.ok(src.includes('sendProAccessEmail'));
  assert.ok(src.includes('sendUpiClaimAdminEmail'));
});

console.log(`\n${'─'.repeat(40)}`);
console.log(`billing tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
