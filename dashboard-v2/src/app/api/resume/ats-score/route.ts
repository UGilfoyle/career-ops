import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { scoreMasterAgainstJd, structureAtsScore } from '@/lib/resume/ats-score';
import type { ResumeContext } from '@/lib/resume/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await req.json().catch(() => ({}));
    let jdText = String(body.jdText || body.jd_text || '').trim();
    const jobId = body.jobId != null ? Number(body.jobId) : null;

    if (!jdText && Number.isFinite(jobId)) {
      const rows = await sql`
        SELECT jd_text, ats_content_score FROM jobs
        WHERE id = ${jobId} AND user_id = ${userId}
        LIMIT 1
      `;
      jdText = String(rows[0]?.jd_text || '').trim();
    }

    let profile = (body.resume_context || body.profile) as ResumeContext | undefined;
    if (!profile) {
      const rows = await sql`
        SELECT resume_context FROM user_profiles WHERE user_id = ${userId} LIMIT 1
      `;
      profile = (rows[0]?.resume_context || {}) as ResumeContext;
    }

    if (!jdText || jdText.length < 40) {
      return NextResponse.json({
        ok: true,
        ...structureAtsScore(profile),
        message: 'No JD selected — showing profile completeness score.',
      });
    }

    const result = await scoreMasterAgainstJd(profile, jdText);
    return NextResponse.json({
      ok: true,
      jobId: Number.isFinite(jobId) ? jobId : null,
      ...result,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'ATS score failed';
    console.error('ats-score error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
