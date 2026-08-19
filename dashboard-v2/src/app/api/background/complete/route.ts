import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureBackgroundSchema } from '@/lib/ops-schema';
import { parseRunMetadata } from '@/lib/analytics/run-metadata';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-worker-secret') || '';
  const expected = process.env.WORKER_WEBHOOK_SECRET || '';
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const userId = String((body as any).user_id || '').trim();
  const actionScript = String((body as any).action_script || '').trim();
  const actionArgs = String((body as any).action_args || '').trim();
  const status = String((body as any).status || '').trim(); // success | failure | cancelled
  const runUrl = String((body as any).run_url || '').trim();
  const runId = String((body as any).run_id || '').trim();
  const jobIdRaw = (body as any).job_id;
  const errorMessage = String((body as any).error_message || '').trim() || null;
  const durationMsRaw = (body as any).duration_ms;
  const durationMs =
    durationMsRaw != null && String(durationMsRaw).trim() !== ''
      ? Number.parseInt(String(durationMsRaw), 10)
      : null;

  const runMeta = parseRunMetadata({
    actionScript,
    actionArgs,
    jobId: jobIdRaw,
  });

  if (!userId || !actionScript || !status) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  await ensureBackgroundSchema(sql);

  if (runId) {
    await sql`
      INSERT INTO background_runs (
        id, user_id, action_script, action_args, status, run_url, completed_at,
        job_id, action_type, error_message, duration_ms
      )
      VALUES (
        ${runId},
        ${userId},
        ${actionScript},
        ${actionArgs || null},
        ${status},
        ${runUrl || null},
        NOW(),
        ${runMeta.job_id},
        ${runMeta.action_type},
        ${errorMessage},
        ${Number.isFinite(durationMs as number) ? durationMs : null}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        run_url = COALESCE(EXCLUDED.run_url, background_runs.run_url),
        completed_at = EXCLUDED.completed_at,
        job_id = COALESCE(EXCLUDED.job_id, background_runs.job_id),
        action_type = COALESCE(EXCLUDED.action_type, background_runs.action_type),
        error_message = COALESCE(EXCLUDED.error_message, background_runs.error_message),
        duration_ms = COALESCE(EXCLUDED.duration_ms, background_runs.duration_ms)
    `;
  }

  const rows = await sql`
    INSERT INTO background_events (
      user_id, action_script, action_args, status, run_url, job_id, action_type
    )
    VALUES (
      ${userId},
      ${actionScript},
      ${actionArgs || null},
      ${status},
      ${runUrl || null},
      ${runMeta.job_id},
      ${runMeta.action_type}
    )
    RETURNING id, created_at
  `;

  return NextResponse.json({ ok: true, id: rows[0]?.id, created_at: rows[0]?.created_at, run_id: runId || null });
}

