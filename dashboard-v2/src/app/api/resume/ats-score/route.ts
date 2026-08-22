import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import {
  mirrorJdKeywordsIntoProfile,
  scoreMasterAgainstJd,
  structureAtsScore,
} from '@/lib/resume/ats-score';
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
    const proBlock = await assertProAccess(
      userId,
      session.user.email,
      countryFromRequest(req),
      session.user.githubLogin,
    );
    if (proBlock) return proBlock;
    const body = await req.json().catch(() => ({}));
    let jdText = String(body.jdText || body.jd_text || '').trim();
    const jobId = body.jobId != null ? Number(body.jobId) : null;
    const mirror = Boolean(body.mirror || body.applyMirror);
    const preferTailored = body.preferTailored !== false;

    let resumeHtml: string | null = null;
    let storedJdAlign: number | null = null;

    if (!jdText && Number.isFinite(jobId)) {
      try {
        const rows = await sql`
          SELECT jd_text, resume_html, jd_alignment_score
          FROM jobs
          WHERE id = ${jobId} AND user_id = ${userId}
          LIMIT 1
        `;
        jdText = String(rows[0]?.jd_text || '').trim();
        resumeHtml = rows[0]?.resume_html ? String(rows[0].resume_html) : null;
        storedJdAlign =
          rows[0]?.jd_alignment_score != null ? Number(rows[0].jd_alignment_score) : null;
      } catch {
        const rows = await sql`
          SELECT jd_text, resume_html
          FROM jobs
          WHERE id = ${jobId} AND user_id = ${userId}
          LIMIT 1
        `;
        jdText = String(rows[0]?.jd_text || '').trim();
        resumeHtml = rows[0]?.resume_html ? String(rows[0].resume_html) : null;
      }
    } else if (Number.isFinite(jobId)) {
      try {
        const rows = await sql`
          SELECT resume_html, jd_alignment_score
          FROM jobs
          WHERE id = ${jobId} AND user_id = ${userId}
          LIMIT 1
        `;
        resumeHtml = rows[0]?.resume_html ? String(rows[0].resume_html) : null;
        storedJdAlign =
          rows[0]?.jd_alignment_score != null ? Number(rows[0].jd_alignment_score) : null;
      } catch {
        /* column may be missing on older DBs */
      }
    }

    const scoreTailoredHtml =
      preferTailored && resumeHtml && resumeHtml.length > 80;

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

    if (mirror) {
      const result = await mirrorJdKeywordsIntoProfile(profile, jdText);
      return NextResponse.json({
        ok: true,
        jobId: Number.isFinite(jobId) ? jobId : null,
        mirrored: true,
        ...result,
      });
    }

    const result = await scoreMasterAgainstJd(profile, jdText, {
      resumeHtml: scoreTailoredHtml ? resumeHtml : null,
      preferTailored: scoreTailoredHtml,
    });

    return NextResponse.json({
      ok: true,
      jobId: Number.isFinite(jobId) ? jobId : null,
      stored_jd_alignment_score: storedJdAlign,
      scored_document: scoreTailoredHtml ? 'tailored' : 'draft',
      ...result,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'ATS score failed';
    console.error('ats-score error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
