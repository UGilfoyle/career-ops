import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { countryFromRequest } from '@/lib/billing/geo';
import { resolvePlanForCountry, planSubtitle, PRACTICE_FREE_LIMIT } from '@/lib/billing/plans';
import { formatRetryHint } from '@/lib/rate-limit';
import {
  assertPracticeBetaAccess,
  checkPracticeQuota,
  ensurePracticeSchema,
  generatePracticePack,
} from '@/lib/practice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const betaBlock = assertPracticeBetaAccess(session.user.email);
    if (betaBlock) return betaBlock;
    const userId = String(session.user.id);
    const quota = await checkPracticeQuota(
      userId,
      session.user.email,
      session.user.githubLogin,
    );

    if (!quota.allowed) {
      const country = countryFromRequest(req);
      const plan = resolvePlanForCountry(country);
      const resetSec = quota.resetAt
        ? Math.max(1, Math.ceil((quota.resetAt.getTime() - Date.now()) / 1000))
        : 7 * 24 * 3600;
      return NextResponse.json(
        {
          error: 'quota_exceeded',
          message: `Free plan: ${PRACTICE_FREE_LIMIT} practice pack every 7 days. ${formatRetryHint(resetSec)} Upgrade to Pro for unlimited Interview Practice.`,
          remaining: 0,
          resetAt: quota.resetAt?.toISOString() || null,
          upgrade: true,
          plan: { display: plan.display, subtitle: planSubtitle(plan) },
        },
        { status: 402 },
      );
    }

    const body = await req.json().catch(() => ({}));
    let jdText = String(body.jdText || body.jd_text || '').trim();
    const jobId = body.jobId != null ? Number(body.jobId) : null;
    let company = String(body.company || '').trim();
    let role = String(body.role || body.title || '').trim();

    if ((!jdText || jdText.length < 40) && Number.isFinite(jobId)) {
      const rows = await sql`
        SELECT jd_text, company, title
        FROM jobs
        WHERE id = ${jobId} AND user_id = ${userId}
        LIMIT 1
      `;
      if (!rows[0]) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      jdText = String(rows[0].jd_text || '').trim();
      if (!company) company = String(rows[0].company || '').trim();
      if (!role) role = String(rows[0].title || '').trim();
    }

    if (!jdText || jdText.length < 40) {
      return NextResponse.json(
        {
          error: 'jd_required',
          message:
            'Paste a job description (40+ chars) or pick a pipeline job that already has JD text from Evaluate/Tailor.',
        },
        { status: 400 },
      );
    }

    const profileRows = await sql`
      SELECT resume_context, targeting_keywords
      FROM user_profiles
      WHERE user_id = ${userId}
      LIMIT 1
    `;
    const resumeContext = (profileRows[0]?.resume_context || {}) as {
      narrative?: { headline?: string; superpowers?: string[] };
    };
    const targeting = (profileRows[0]?.targeting_keywords || {}) as {
      positive?: string[];
    };

    const generated = await generatePracticePack({
      jdText,
      company,
      role,
      profileHints: {
        headline: resumeContext.narrative?.headline,
        superpowers: resumeContext.narrative?.superpowers,
        targetingPositive: targeting.positive,
      },
    });

    await ensurePracticeSchema(sql);
    const inserted = await sql`
      INSERT INTO practice_packs (user_id, job_id, company, role, jd_hash, pack_json)
      VALUES (
        ${userId},
        ${Number.isFinite(jobId) ? jobId : null},
        ${company || generated.pack.company || null},
        ${role || generated.pack.role || null},
        ${generated.jdHash},
        ${sql.json(generated.pack as never)}
      )
      RETURNING id, user_id, job_id, company, role, jd_hash, pack_json, created_at
    `;

    const row = inserted[0];
    const nextQuota = await checkPracticeQuota(
      userId,
      session.user.email,
      session.user.githubLogin,
    );

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
      quota: {
        allowed: nextQuota.allowed,
        remaining: nextQuota.remaining,
        resetAt: nextQuota.resetAt?.toISOString() || null,
        pro: nextQuota.pro,
        freeLimit: nextQuota.freeLimit,
        usedInWindow: nextQuota.usedInWindow,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Practice pack generation failed';
    console.error('practice/generate error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
