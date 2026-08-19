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
