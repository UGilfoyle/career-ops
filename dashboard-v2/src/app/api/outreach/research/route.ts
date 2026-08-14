import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { checkCopilotRateLimit } from '@/lib/billing/entitlements';
import { formatRetryHint, getClientIp, rateLimit } from '@/lib/rate-limit';
import { countryFromRequest } from '@/lib/billing/geo';
import { resolvePlanForCountry, planSubtitle } from '@/lib/billing/plans';
import { researchCompany } from '@/lib/outreach/research';
import { draftOutreach } from '@/lib/outreach/draft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sessionUserId = session.user.id;
    const userId = Number.parseInt(String(sessionUserId), 10);
    const clientIp = getClientIp(req);

    // Burst / IP first so parallel spam cannot burn Copilot + Jina/GitHub quota.
    const ipLimit = await rateLimit(`outreach:ip:${clientIp}`, { windowMs: 60_000, max: 10 });
    if (!ipLimit.ok) {
      return NextResponse.json(
        {
          error: 'rate_limit',
          message: `Too many outreach drafts from this network. ${formatRetryHint(ipLimit.retryAfterSec)}`,
          retryAfterSec: ipLimit.retryAfterSec,
        },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSec) } },
      );
    }
    const burst = await rateLimit(`outreach-burst:${sessionUserId}`, { windowMs: 60_000, max: 3 });
    if (!burst.ok) {
      return NextResponse.json(
        {
          error: 'rate_limit',
          message: `Slow down — max 3 drafts per minute. ${formatRetryHint(burst.retryAfterSec)}`,
          retryAfterSec: burst.retryAfterSec,
        },
        { status: 429, headers: { 'Retry-After': String(burst.retryAfterSec) } },
      );
    }
    const hourly = await rateLimit(`outreach:${sessionUserId}`, { windowMs: 60 * 60_000, max: 20 });
    if (!hourly.ok) {
      return NextResponse.json(
        {
          error: 'rate_limit',
          message: `Hourly outreach limit reached. ${formatRetryHint(hourly.retryAfterSec)}`,
          retryAfterSec: hourly.retryAfterSec,
        },
        { status: 429, headers: { 'Retry-After': String(hourly.retryAfterSec) } },
      );
    }

    const copilotLimit = await checkCopilotRateLimit(userId, session.user.email);
    if (!copilotLimit.ok) {
      const country = countryFromRequest(req);
      const plan = resolvePlanForCountry(country);
      return NextResponse.json(
        {
          error: 'copilot_rate_limit',
          message: copilotLimit.pro
            ? `Draft limit reached. ${formatRetryHint(copilotLimit.retryAfterSec)}`
            : `Free Copilot limit: 10 every 2 hours. ${formatRetryHint(copilotLimit.retryAfterSec)}`,
          retryAfterSec: copilotLimit.retryAfterSec,
          remaining: copilotLimit.remaining,
          upgrade: !copilotLimit.pro,
          plan: { display: plan.display, subtitle: planSubtitle(plan) },
        },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const jobId = Number(body.jobId || body.pipeline_id || 0);
    let company = String(body.company || '').trim();
    let role = String(body.role || body.title || '').trim();
    let jobUrl = String(body.url || body.jobUrl || '').trim();
    let jdText = String(body.jdText || '').trim();

    if (jobId > 0) {
      const rows = await sql`
        SELECT id, company, title, url
        FROM jobs
        WHERE id = ${jobId} AND user_id = ${sessionUserId}
        LIMIT 1
      `;
      const job = rows[0];
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      company = company || String(job.company || '');
      role = role || String(job.title || '');
      jobUrl = jobUrl || String(job.url || '');
    }

    if (!company && !jobUrl) {
      return NextResponse.json({ error: 'Company or job URL required' }, { status: 400 });
    }

    const profileRows = await sql`
      SELECT resume_context
      FROM user_profiles
      WHERE user_id = ${sessionUserId}
      LIMIT 1
    `.catch(() => [] as Array<Record<string, unknown>>);

    const profile = profileRows[0] || {};
    const resumeContext = (profile.resume_context || {}) as Record<string, unknown>;
    const candidate = (resumeContext.candidate || {}) as Record<string, unknown>;
    const candidateName =
      String(candidate.full_name || session.user.name || '')
        .trim()
        .split(/\s+/)[0] || '';

    const research = await researchCompany({
      company,
      role,
      jobUrl,
      jdText,
      candidateCountry: String(
        (resumeContext.location as { country?: string } | undefined)?.country ||
          candidate.location ||
          '',
      ),
      githubToken:
        String(
          (resumeContext.github_settings as { pat?: string } | undefined)?.pat || '',
        ).trim() || null,
    });
    const { draft, llm } = await draftOutreach({
      research,
      resumeContext,
      candidateName,
    });

    return NextResponse.json({
      company: research.company,
      role: research.role,
      region: research.region,
      domain: research.domain,
      emails: research.emails,
      people: research.people,
      notes: research.notes,
      sources: research.sources.map((s) => ({
        id: s.id,
        ok: s.ok,
        skipped: Boolean(s.skipped),
        summary: s.summary,
        url: s.url,
      })),
      searchLinks: research.searchLinks,
      githubAuth: research.githubAuth,
      draft,
      llm,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
