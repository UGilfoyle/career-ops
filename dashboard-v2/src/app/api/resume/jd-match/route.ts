import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { runJdMatch } from '@/lib/resume/jd-match';
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
        SELECT jd_text FROM jobs
        WHERE id = ${jobId} AND user_id = ${userId}
        LIMIT 1
      `;
      jdText = String(rows[0]?.jd_text || '').trim();
    }

    if (!jdText || jdText.length < 40) {
      return NextResponse.json(
        {
          error: 'No JD text available. Run Evaluate/Tailor on a pipeline job to capture the description.',
          hasJd: false,
        },
        { status: 400 }
      );
    }

    let profile = (body.resume_context || body.profile) as ResumeContext | undefined;
    if (!profile) {
      const rows = await sql`
        SELECT resume_context FROM user_profiles WHERE user_id = ${userId} LIMIT 1
      `;
      profile = (rows[0]?.resume_context || {}) as ResumeContext;
    }

    const result = await runJdMatch(profile, jdText);
    return NextResponse.json({
      ok: true,
      hasJd: true,
      jobId: Number.isFinite(jobId) ? jobId : null,
      ...result,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'JD match failed';
    console.error('jd-match error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
