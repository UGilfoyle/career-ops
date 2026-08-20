import type postgres from 'postgres';
import { onceSchema } from './schema-once';

export async function ensureBackgroundSchema(sql: postgres.Sql): Promise<void> {
  await onceSchema('background', async () => {
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
      await sql`CREATE INDEX IF NOT EXISTS background_runs_job_id_idx ON background_runs (job_id) WHERE job_id IS NOT NULL`;
    } catch (e) {
      console.warn('[ensureBackgroundSchema] analytics columns skipped:', (e as Error).message);
    }
  });
}

export async function ensurePageViewsSchema(sql: postgres.Sql): Promise<void> {
  await onceSchema('page_views', async () => {
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
  });
}

export async function ensureMasterPdfSchema(sql: postgres.Sql): Promise<void> {
  await onceSchema('master_pdf', async () => {
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
  });
}

export async function ensureUserProfilesSchema(sql: postgres.Sql): Promise<void> {
  await onceSchema('user_profiles', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE,
        resume_context JSONB DEFAULT '{}',
        targeting_keywords JSONB DEFAULT '{"positive": [], "negative": []}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
  });
}

/** Stealth resume / companion telemetry (Phase 1). */
export async function ensureApplicationTelemetrySchema(sql: postgres.Sql): Promise<void> {
  await onceSchema('application_telemetry', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS application_tracking (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        application_id INTEGER,
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
      console.warn('[ensureApplicationTelemetrySchema] unique application_id index skipped:', (e as Error).message);
    }
  });

  // Separate key so existing isolates that already ran Phase-1 DDL still pick up SET NULL.
  await onceSchema('application_telemetry_fk_set_null', async () => {
    try {
      await sql`
        ALTER TABLE application_tracking
          DROP CONSTRAINT IF EXISTS application_tracking_application_id_fkey
      `;
      await sql`
        ALTER TABLE application_tracking
          ADD CONSTRAINT application_tracking_application_id_fkey
          FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
      `;
    } catch (e) {
      console.warn('[ensureApplicationTelemetrySchema] application_id FK SET NULL skipped:', (e as Error).message);
    }
  });
}
