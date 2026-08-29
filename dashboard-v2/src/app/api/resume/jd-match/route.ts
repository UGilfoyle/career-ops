import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { runJdMatch } from '@/lib/resume/jd-match';
import type { ResumeContext } from '@/lib/resume/types';
import { assertProAccess } from '@/lib/billing/entitlements';
import { countryFromRequest } from '@/lib/billing/geo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const proBlock = await assertProAccess(userId, session.user.email, countryFromRequest(req), session.user.githubLogin);
    if (proBlock) return proBlock;
    const body = await req.json().catch(() => ({}));
    let jdText = String(body.jdText || body.jd_text || '').trim();
    const jobId = body.jobId != null ? Number(body.jobId) : null;

    if (!jdText && Number.isFinite(jobId)) {
      try {
        const rows = await sql`
          SELECT jd_text, notes, description, title, company FROM jobs
          WHERE id = ${jobId} AND user_id = ${userId}
          LIMIT 1
        `;
        const row = rows[0];
        jdText = String(row?.jd_text || row?.description || row?.notes || '').trim();
        if (!jdText && (row?.title || row?.company)) {
          jdText = `Position: ${row?.title || 'Software Engineer'}\nCompany: ${row?.company || 'Company'}\nResponsibilities: Software architecture, backend engineering, cloud systems, testing, and distributed platform development.`;
        }
      } catch {
        const rows = await sql`
          SELECT jd_text FROM jobs
          WHERE id = ${jobId} AND user_id = ${userId}
          LIMIT 1
        `;
        jdText = String(rows[0]?.jd_text || '').trim();
      }
    }

    if (!jdText || jdText.length < 20) {
      return NextResponse.json({
        ok: true,
        hasJd: false,
        coveragePct: 0,
        honest: [],
        gaps: [],
        partial: [],
        suggestions: [],
        message: 'No JD text available yet for this role. Paste description or evaluate posting.',
      });
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
