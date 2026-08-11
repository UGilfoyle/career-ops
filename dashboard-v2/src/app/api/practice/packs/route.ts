import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { assertPracticeBetaAccess, ensurePracticeSchema } from '@/lib/practice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const betaBlock = assertPracticeBetaAccess(session.user.email);
    if (betaBlock) return betaBlock;
    const userId = String(session.user.id);
    await ensurePracticeSchema(sql);

    const rows = await sql`
      SELECT id, user_id, job_id, company, role, jd_hash, pack_json, created_at
      FROM practice_packs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return NextResponse.json({
      ok: true,
      packs: rows.map((row) => {
        const content = row.pack_json || {};
        const coding = Array.isArray(content.coding) ? content.coding.length : 0;
        const systemDesign = Array.isArray(content.systemDesign)
          ? content.systemDesign.length
          : 0;
        const behavioral = Array.isArray(content.behavioral) ? content.behavioral.length : 0;
        return {
          id: row.id,
          userId: String(row.user_id),
          jobId: row.job_id != null ? Number(row.job_id) : null,
          company: row.company,
          role: row.role,
          jdHash: row.jd_hash,
          pack: content,
          content,
          createdAt: row.created_at,
          counts: { coding, systemDesign, behavioral },
          summary: {
            coding,
            systemDesign,
            behavioral,
            fitTier: content?.fit?.tier || null,
          },
        };
      }),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to list practice packs';
    console.error('practice/packs error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
