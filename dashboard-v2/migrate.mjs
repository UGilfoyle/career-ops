import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function migrate() {
  console.log('Starting migration...');
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP;`;
    await sql`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id SERIAL PRIMARY KEY,
        identifier TEXT NOT NULL,
        token TEXT NOT NULL,
        expires TIMESTAMP NOT NULL,
        UNIQUE(identifier, token)
      );
    `;
    await sql`
      ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS posted_confidence TEXT,
        ADD COLUMN IF NOT EXISTS posted_reason TEXT,
        ADD COLUMN IF NOT EXISTS posted_checked_at TIMESTAMPTZ
    `;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN DEFAULT true`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_unsubscribed_at TIMESTAMPTZ`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS github_login TEXT`;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uidx
      ON users (referral_code)
      WHERE referral_code IS NOT NULL
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS newsletter_sends (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        kind TEXT NOT NULL DEFAULT 'monthly',
        month_key TEXT NOT NULL,
        UNIQUE (user_id, month_key, kind)
      )
    `;
    await sql`
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
    await sql`
      CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx
      ON user_subscriptions (status)
    `;
    await sql`
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
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS upi_payment_claims_utr_uidx
      ON upi_payment_claims (utr)
    `;
    try {
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS upi_payment_claims_user_pending_uidx
        ON upi_payment_claims (user_id) WHERE status = 'pending'
      `;
    } catch (e) {
      console.warn('Skipped upi_payment_claims_user_pending_uidx:', e.message);
    }
    console.log('Migration successful: users, newsletter/referral, verification_tokens, jobs.posted_*, user_subscriptions, upi_payment_claims updated.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

migrate();
