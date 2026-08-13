import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureBackgroundSchema } from '@/lib/ops-schema';

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

  if (!userId || !actionScript || !status) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  await ensureBackgroundSchema(sql);

  if (runId) {
    // Upsert run status
    await sql`
      INSERT INTO background_runs (id, user_id, action_script, action_args, status, run_url, completed_at)
      VALUES (${runId}, ${userId}, ${actionScript}, ${actionArgs || null}, ${status}, ${runUrl || null}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        run_url = COALESCE(EXCLUDED.run_url, background_runs.run_url),
        completed_at = EXCLUDED.completed_at
    `;
  }

  const rows = await sql`
    INSERT INTO background_events (user_id, action_script, action_args, status, run_url)
    VALUES (${userId}, ${actionScript}, ${actionArgs || null}, ${status}, ${runUrl || null})
    RETURNING id, created_at
  `;

  return NextResponse.json({ ok: true, id: rows[0]?.id, created_at: rows[0]?.created_at, run_id: runId || null });
}

