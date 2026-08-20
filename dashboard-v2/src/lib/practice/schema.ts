import type postgres from 'postgres';
import { z } from 'zod';
import { onceSchema } from '../schema-once';

/** Idempotent Interview Practice tables. Runs at most once per isolate. */
export async function ensurePracticeSchema(sql: postgres.Sql): Promise<void> {
  await onceSchema('practice', async () => {
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
    await sql`
      CREATE INDEX IF NOT EXISTS practice_packs_user_created_idx
      ON practice_packs (user_id, created_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS practice_packs_user_job_idx
      ON practice_packs (user_id, job_id)
    `;
  });
}

const promptItemSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  title: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(10).max(4000),
  outline: z.string().trim().min(8).max(4000),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  stackHints: z.array(z.string().trim().max(80)).max(12).optional(),
  starHint: z.string().trim().max(1000).optional(),
});

export const practicePackJsonSchema = z.object({
  company: z.string().trim().max(200).optional().default(''),
  role: z.string().trim().max(200).optional().default(''),
  keywords: z.array(z.string().trim().max(80)).max(30).default([]),
  fit: z
    .object({
      tier: z.enum(['strong', 'partial', 'low']),
      note: z.string().trim().max(800),
    })
    .optional(),
  /** Locked mix: 8 coding + 5 system design + 7 behavioral = 20+ */
  coding: z.array(promptItemSchema).min(8).max(10),
  systemDesign: z.array(promptItemSchema).min(5).max(6),
  behavioral: z.array(promptItemSchema).min(7).max(8),
});

export type PracticePackJson = z.infer<typeof practicePackJsonSchema>;

export type PracticePackRow = {
  id: number;
  user_id: string;
  job_id: number | null;
  company: string | null;
  role: string | null;
  jd_hash: string;
  pack_json: PracticePackJson;
  created_at: Date;
};

export function parsePracticePackJson(raw: unknown): PracticePackJson {
  return practicePackJsonSchema.parse(raw);
}

export function validatePracticePackJson(raw: unknown): {
  ok: boolean;
  data?: PracticePackJson;
  errors: string[];
} {
  const result = practicePackJsonSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data, errors: [] };
  const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  return { ok: false, errors };
}
