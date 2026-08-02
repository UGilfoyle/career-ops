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
    console.log('Migration successful: users, newsletter/referral, verification_tokens, jobs.posted_* updated.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

migrate();
