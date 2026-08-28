import type postgres from 'postgres';
import { onceSchema } from '../schema-once';

/** Idempotent product feedback table. One row per user (upsert on resubmit). */
export async function ensureFeedbackSchema(sql: postgres.Sql): Promise<void> {
  await onceSchema('product_feedback', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS product_feedback (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        user_email TEXT NOT NULL,
        score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5),
        comment TEXT,
        context TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS product_feedback_score_idx
      ON product_feedback (score)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS product_feedback_created_idx
      ON product_feedback (created_at DESC)
    `;
  });
}

export type FeedbackRow = {
  id: number;
  user_id: string;
  user_email: string;
  score: number;
  comment: string | null;
  context: string | null;
  created_at: Date;
  updated_at: Date;
};
