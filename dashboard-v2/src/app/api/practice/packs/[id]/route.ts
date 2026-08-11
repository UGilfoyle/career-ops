import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { assertPracticeBetaAccess, ensurePracticeSchema } from '@/lib/practice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const betaBlock = assertPracticeBetaAccess(session.user.email);
    if (betaBlock) return betaBlock;
    const userId = String(session.user.id);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid pack id' }, { status: 400 });
    }

    await ensurePracticeSchema(sql);
    const rows = await sql`
      SELECT id, user_id, job_id, company, role, jd_hash, pack_json, created_at
      FROM practice_packs
      WHERE id = ${id} AND user_id = ${userId}
      LIMIT 1
    `;
    if (!rows[0]) {
      return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
    }
    const row = rows[0];
    return NextResponse.json({
      ok: true,
      pack: {
        id: row.id,
        userId: String(row.user_id),
        jobId: row.job_id != null ? Number(row.job_id) : null,
        company: row.company,
        role: row.role,
        jdHash: row.jd_hash,
        content: row.pack_json,
        pack: row.pack_json,
        createdAt: row.created_at,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load practice pack';
    console.error('practice/packs/[id] error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
