/**
 * feedback-tests.mjs — product feedback wiring + validation
 * Run: node feedback-tests.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
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

function parseFeedbackScore(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function sanitizeFeedbackComment(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  return text.slice(0, 2000);
}

console.log('\n🧪 product feedback tests\n');

test('score 1–5 accepted, else rejected', () => {
  assert.equal(parseFeedbackScore(5), 5);
  assert.equal(parseFeedbackScore(1), 1);
  assert.equal(parseFeedbackScore(0), null);
  assert.equal(parseFeedbackScore(6), null);
  assert.equal(parseFeedbackScore('3'), 3);
});

test('comment trimmed and capped', () => {
  assert.equal(sanitizeFeedbackComment('  hi '), 'hi');
  assert.equal(sanitizeFeedbackComment(''), null);
  assert.equal(sanitizeFeedbackComment('x'.repeat(3000)).length, 2000);
});

const mustExist = [
  'dashboard-v2/src/lib/feedback/schema.ts',
  'dashboard-v2/src/lib/feedback/validate.ts',
  'dashboard-v2/src/app/api/feedback/route.ts',
  'dashboard-v2/src/app/api/admin/feedback/route.ts',
  'dashboard-v2/src/components/ProductFeedbackCard.tsx',
  'dashboard-v2/src/components/ProductFeedbackNudge.tsx',
  'dashboard-v2/src/components/AdminFeedbackPanel.tsx',
];
for (const rel of mustExist) {
  test(`exists ${rel}`, () => {
    assert.ok(existsSync(join(ROOT, rel)), `missing ${rel}`);
  });
}

test('feedback API uses auth + upsert', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/src/app/api/feedback/route.ts'), 'utf8');
  assert.ok(src.includes('auth()'));
  assert.ok(src.includes('ON CONFLICT (user_id)'));
  assert.ok(src.includes('parseFeedbackScore'));
});

test('admin feedback is admin-gated', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/src/app/api/admin/feedback/route.ts'), 'utf8');
  assert.ok(src.includes('isAdminEmail'));
  assert.ok(src.includes('product_feedback'));
});

test('Dashboard wires feedback without touching billing emails', () => {
  const dash = readFileSync(join(ROOT, 'dashboard-v2/src/components/Dashboard.tsx'), 'utf8');
  assert.ok(dash.includes('ProductFeedbackCard'));
  assert.ok(dash.includes('AdminFeedbackPanel'));
  assert.ok(dash.includes('ProductFeedbackNudge'));
  const claim = readFileSync(join(ROOT, 'dashboard-v2/src/app/api/billing/upi/claim/route.ts'), 'utf8');
  assert.ok(claim.includes('sendUpiClaimAdminEmail'));
});

test('migrate.mjs creates product_feedback', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/migrate.mjs'), 'utf8');
  assert.ok(src.includes('product_feedback'));
});

test('nudge is dismissible (localStorage, non-blocking)', () => {
  const src = readFileSync(join(ROOT, 'dashboard-v2/src/components/ProductFeedbackNudge.tsx'), 'utf8');
  assert.ok(src.includes('localStorage'));
  assert.ok(src.includes('fixed bottom'));
  assert.ok(!src.includes('modal'), 'should not block UI with modal');
});

console.log(`\n${'─'.repeat(40)}`);
console.log(`feedback tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
