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
        ADD COLUMN IF NOT EXISTS posted_checked_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS portal_key TEXT,
        ADD COLUMN IF NOT EXISTS logo_url TEXT,
        ADD COLUMN IF NOT EXISTS logo_source TEXT
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

    await sql`
      CREATE TABLE IF NOT EXISTS practice_packs (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_id INT,
        company TEXT,
        role TEXT,
        jd_hash TEXT NOT NULL,
        pack_json JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS practice_packs_user_created_idx ON practice_packs (user_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS practice_packs_user_job_idx ON practice_packs (user_id, job_id)`;

    await sql`
      CREATE TABLE IF NOT EXISTS background_runs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action_script TEXT NOT NULL,
        action_args TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        run_url TEXT,
        queued_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS background_runs_user_id_queued_at_idx ON background_runs (user_id, queued_at DESC)`;
    try {
      await sql`
        ALTER TABLE background_runs
          ADD COLUMN IF NOT EXISTS job_id INTEGER,
          ADD COLUMN IF NOT EXISTS action_type TEXT,
          ADD COLUMN IF NOT EXISTS error_message TEXT,
          ADD COLUMN IF NOT EXISTS duration_ms INTEGER
      `;
      await sql`
        ALTER TABLE background_events
          ADD COLUMN IF NOT EXISTS job_id INTEGER,
          ADD COLUMN IF NOT EXISTS action_type TEXT
      `;
      await sql`CREATE INDEX IF NOT EXISTS background_runs_action_type_idx ON background_runs (action_type, queued_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS background_runs_user_action_idx ON background_runs (user_id, action_type, queued_at DESC)`;
    } catch (e) {
      console.warn('Skipped background_runs analytics columns:', e.message);
    }
    await sql`
      CREATE TABLE IF NOT EXISTS background_events (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        action_script TEXT NOT NULL,
        action_args TEXT,
        status TEXT NOT NULL,
        run_url TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS background_events_user_id_created_at_idx ON background_events (user_id, created_at DESC)`;

    await sql`
      CREATE TABLE IF NOT EXISTS page_views (
        id SERIAL PRIMARY KEY,
        visitor_hash TEXT NOT NULL,
        path TEXT NOT NULL DEFAULT '/',
        referrer TEXT,
        user_agent TEXT,
        country TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_page_views_visitor_hash ON page_views (visitor_hash)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS master_pdf_exports (
        user_id TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        html TEXT,
        pdf BYTEA,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, content_hash)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE,
        resume_context JSONB DEFAULT '{}',
        targeting_keywords JSONB DEFAULT '{"positive": [], "negative": []}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_jobs_user_score_created ON jobs (user_id, score DESC NULLS LAST, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_apps_user_applied ON applications (user_id, applied_at DESC)`;
    } catch (e) {
      console.warn('Skipped jobs/applications covering indexes:', e.message);
    }

    await sql`
      CREATE TABLE IF NOT EXISTS application_tracking (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
        slug TEXT UNIQUE NOT NULL,
        company TEXT NOT NULL,
        role TEXT,
        github_url TEXT,
        linkedin_url TEXT,
        portfolio_url TEXT,
        view_count INTEGER DEFAULT 0,
        click_count INTEGER DEFAULT 0,
        total_dwell_sec INTEGER DEFAULT 0,
        last_engaged_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS application_events (
        id SERIAL PRIMARY KEY,
        tracking_id INTEGER REFERENCES application_tracking(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        target TEXT,
        ip_hash TEXT NOT NULL,
        user_agent TEXT,
        dwell_seconds INTEGER DEFAULT 0,
        country TEXT,
        is_candidate_test BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_app_tracking_slug ON application_tracking (slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_app_tracking_user ON application_tracking (user_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_app_tracking_application ON application_tracking (application_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_app_events_tracking_id ON application_events (tracking_id)`;
    try {
      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS application_tracking_application_id_uidx
        ON application_tracking (application_id)
        WHERE application_id IS NOT NULL
      `;
    } catch (e) {
      console.warn('Skipped application_tracking_application_id_uidx:', e.message);
    }

    console.log('Migration successful: billing, practice, background, page_views, master_pdf, user_profiles, jobs/apps indexes, application telemetry.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sql.end();
  }
}

migrate();
