/**
 * billing-db-e2e.mjs — real Postgres handshake test for the Pro/UPI billing flow.
 *
 * Everything runs inside one transaction that is always rolled back, so the test
 * touches the live schema without leaving a single row behind.
 *
 * Run: node billing-db-e2e.mjs          (skips cleanly when DATABASE_URL is absent)
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DASHBOARD = join(ROOT, 'dashboard-v2');

function loadEnvLocal() {
  const file = join(DASHBOARD, '.env.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('⏭  billing DB e2e skipped (no DATABASE_URL)');
  process.exit(0);
}

const require = createRequire(join(DASHBOARD, 'package.json'));
const postgres = require('postgres').default || require('postgres');

let passed = 0;
const checks = [];
function check(name, fn) {
  checks.push([name, fn]);
}

const ROLLBACK = Symbol('rollback');
const TEST_USER = `e2e-billing-${Date.now()}`;
const TEST_EMAIL = `e2e-billing-${Date.now()}@example.invalid`;
const UTR_A = `E2E${Date.now().toString().slice(-9)}`;
const UTR_B = `E2X${Date.now().toString().slice(-9)}`;

const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 5 });

async function ensureSchema(trx) {
  await trx`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'inactive',
      plan TEXT NOT NULL DEFAULT 'pro_monthly',
      country_code TEXT,
      currency TEXT,
      amount_minor INT,
      provider TEXT,
      external_customer_id TEXT,
      external_subscription_id TEXT,
      current_period_end TIMESTAMPTZ,
      access_email_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await trx`
    CREATE TABLE IF NOT EXISTS upi_payment_claims (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      amount_inr NUMERIC(10,2) NOT NULL,
      upi_vpa TEXT NOT NULL,
      transaction_ref TEXT,
      utr TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT
    )
  `;
  await trx`
    CREATE UNIQUE INDEX IF NOT EXISTS upi_payment_claims_utr_uidx
    ON upi_payment_claims (utr)
  `;
  await trx`
    CREATE UNIQUE INDEX IF NOT EXISTS upi_payment_claims_user_pending_uidx
    ON upi_payment_claims (user_id) WHERE status = 'pending'
  `;
}

function insertClaim(trx, utr) {
  return trx`
    INSERT INTO upi_payment_claims (user_id, user_email, amount_inr, upi_vpa, utr, status)
    VALUES (${TEST_USER}, ${TEST_EMAIL}, 99, 'test@upi', ${utr}, 'pending')
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
}

function activatePro(trx) {
  return trx`
    INSERT INTO user_subscriptions (
      user_id, status, plan, country_code, currency, amount_minor, provider, current_period_end, updated_at
    ) VALUES (
      ${TEST_USER}, 'active', 'pro_monthly', 'IN', 'inr', 9900, 'upi_direct', NOW() + INTERVAL '31 days', NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      status = 'active',
      plan = 'pro_monthly',
      country_code = 'IN',
      currency = 'inr',
      amount_minor = 9900,
      provider = 'upi_direct',
      current_period_end = NOW() + INTERVAL '31 days',
      updated_at = NOW()
  `;
}

console.log('\n🧪 billing DB handshake e2e (transactional, always rolled back)\n');

try {
  await sql.begin(async (trx) => {
    await ensureSchema(trx);
    console.log('  ✅ schema ensure is idempotent on the live database');
    passed++;

    const first = await insertClaim(trx, UTR_A);
    assert.equal(first.length, 1, 'first claim should insert');
    console.log('  ✅ first UPI claim stored as pending');
    passed++;

    const duplicate = await insertClaim(trx, UTR_A);
    assert.equal(duplicate.length, 0, 'same UTR must not create a second row');
    console.log('  ✅ resubmitting the same UTR does not duplicate the claim');
    passed++;

    const secondUtr = await insertClaim(trx, UTR_B);
    assert.equal(secondUtr.length, 0, 'second pending claim must be blocked by the DB');
    console.log('  ✅ database rejects a second pending claim for the same user');
    passed++;

    const pending = await trx`
      SELECT id, status FROM upi_payment_claims WHERE user_id = ${TEST_USER}
    `;
    assert.equal(pending.length, 1, 'exactly one claim row survives retries');
    assert.equal(pending[0].status, 'pending');
    console.log('  ✅ exactly one claim row after three submit attempts');
    passed++;

    // Approve twice: activation runs before the status flip, and both writes are
    // idempotent, so a retried approval cannot duplicate or lose access.
    await activatePro(trx);
    await trx`
      UPDATE upi_payment_claims SET status = 'approved', reviewed_at = NOW(), reviewed_by = 'e2e'
      WHERE id = ${pending[0].id}
    `;
    await activatePro(trx);

    const subs = await trx`
      SELECT status, currency, amount_minor, current_period_end
      FROM user_subscriptions WHERE user_id = ${TEST_USER}
    `;
    assert.equal(subs.length, 1, 'double approval must not create two subscriptions');
    assert.equal(subs[0].status, 'active');
    assert.equal(subs[0].currency, 'inr');
    assert.equal(Number(subs[0].amount_minor), 9900);
    assert.ok(new Date(subs[0].current_period_end).getTime() > Date.now());
    console.log('  ✅ repeated approval keeps one active subscription (no double charge state)');
    passed++;

    const approved = await trx`
      SELECT status FROM upi_payment_claims WHERE user_id = ${TEST_USER}
    `;
    assert.equal(approved.length, 1);
    assert.equal(approved[0].status, 'approved');
    console.log('  ✅ claim ends approved with access already granted');
    passed++;

    // With the claim approved, a fresh payment attempt is allowed by the index but
    // the API guard treats approved as "already Pro" — assert the DB view the API reads.
    const latest = await trx`
      SELECT status FROM upi_payment_claims
      WHERE user_id = ${TEST_USER}
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC
      LIMIT 1
    `;
    assert.equal(latest[0].status, 'approved');
    console.log('  ✅ latest-claim lookup returns approved (paywall shows Pro, not pay again)');
    passed++;

    throw ROLLBACK;
  });
} catch (e) {
  if (e !== ROLLBACK) {
    console.error('\n  ❌ billing DB e2e failed');
    console.error(`     ${e?.message || e}`);
    await sql.end({ timeout: 5 });
    process.exit(1);
  }
}

const leftoverClaims = await sql`
  SELECT COUNT(*)::int AS n FROM upi_payment_claims WHERE user_id = ${TEST_USER}
`;
const leftoverSubs = await sql`
  SELECT COUNT(*)::int AS n FROM user_subscriptions WHERE user_id = ${TEST_USER}
`;

try {
  assert.equal(leftoverClaims[0].n, 0);
  assert.equal(leftoverSubs[0].n, 0);
  console.log('  ✅ rollback left zero test rows behind (no data loss, no residue)');
  passed++;
} catch (e) {
  console.error('  ❌ rollback residue detected', e.message);
  await sql.end({ timeout: 5 });
  process.exit(1);
}

await sql.end({ timeout: 5 });
console.log(`\n${'─'.repeat(40)}`);
console.log(`billing DB e2e: ${passed} passed, 0 failed`);
