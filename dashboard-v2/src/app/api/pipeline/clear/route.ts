import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const MAX_IDS = 5000;

/** Same pipeline rows as GET /api/data: jobs not linked to Applications for this user, excluding those with generated resumes or cover letters. */
function pipelineSubquery(tx: any, userId: string | number) {
  return tx`
    SELECT j.id
    FROM jobs j
    WHERE j.user_id = ${userId}
      AND (j.score IS NULL OR COALESCE(j.score, 0) >= 0)
      AND j.resume_html IS NULL
      AND j.cover_letter_html IS NULL
      AND j.resume_pdf_key IS NULL
      AND j.cover_letter_pdf_key IS NULL
      AND j.resume_pdf IS NULL
      AND j.cover_letter_pdf IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM applications a
        WHERE a.user_id = ${userId} AND a.job_id = j.id
      )
  `;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    let body: { scope?: string; ids?: number[] } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const scope = body.scope === 'ids' ? 'ids' : 'all';
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    const ids = rawIds
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, MAX_IDS);

    if (scope === 'ids' && ids.length === 0) {
      return NextResponse.json({ error: 'No job ids provided' }, { status: 400 });
    }

    const deleted = await sql.begin(async (tx) => {
      if (scope === 'all') {
        await tx`
          DELETE FROM applications
          WHERE user_id = ${userId}
            AND job_id IN (${pipelineSubquery(tx, userId)})
        `;
        return await tx`
          DELETE FROM jobs
          WHERE user_id = ${userId}
            AND id IN (${pipelineSubquery(tx, userId)})
          RETURNING id
        `;
      }

      await tx`
        DELETE FROM applications
        WHERE user_id = ${userId}
          AND job_id IN (
            SELECT j.id
            FROM jobs j
            WHERE j.user_id = ${userId}
              AND (j.score IS NULL OR COALESCE(j.score, 0) >= 0)
              AND NOT EXISTS (
                SELECT 1 FROM applications a
                WHERE a.user_id = ${userId} AND a.job_id = j.id
              )
              AND j.id = ANY(${ids}::int[])
          )
      `;
      return await tx`
        DELETE FROM jobs
        WHERE user_id = ${userId}
          AND id IN (
            SELECT j.id
            FROM jobs j
            WHERE j.user_id = ${userId}
              AND (j.score IS NULL OR COALESCE(j.score, 0) >= 0)
              AND NOT EXISTS (
                SELECT 1 FROM applications a
                WHERE a.user_id = ${userId} AND a.job_id = j.id
              )
              AND j.id = ANY(${ids}::int[])
          )
        RETURNING id
      `;
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.length,
      scope,
    });
  } catch (error: any) {
    console.error('Pipeline clear error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
