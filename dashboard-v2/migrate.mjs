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
    console.log('Migration successful: users, verification_tokens, and jobs.posted_* updated.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

migrate();
