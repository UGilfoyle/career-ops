import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import type { ResumeContext } from '@/lib/resume/types';
import {
  appOriginFromRequest,
  buildTrackingSlug,
  normalizeExternalUrl,
} from '@/lib/telemetry/urls';
import { invalidateTrackingCache, setCachedTracking } from '@/lib/telemetry/cache';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

async function loadProfileUrls(userId: string) {
  const [profileRow] = await sql`
    SELECT resume_context FROM user_profiles WHERE user_id = ${Number(userId)} LIMIT 1
  `;
  const ctx = (profileRow?.resume_context || {}) as ResumeContext;
  const candidate = ctx.candidate || {};
  return {
    githubUrl: normalizeExternalUrl(candidate.github),
    linkedinUrl: normalizeExternalUrl(candidate.linkedin),
    portfolioUrl: normalizeExternalUrl(candidate.portfolio_url),
  };
}

/**
 * Ensure a stealth companion link exists for an application and return its URL.
 * Idempotent: reuses existing application_tracking row when present.
 * Always refreshes destination URLs from the candidate profile + busts KV cache.
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = String(session.user.id);
    const origin = appOriginFromRequest(req);
    const { id } = await context.params;
    const applicationId = Number(id);
    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
    }

    await ensureApplicationTelemetrySchema(sql);

    const [app] = await sql`
      SELECT
        a.id AS app_id,
        a.user_id,
        j.company,
        j.title AS role
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE a.id = ${applicationId} AND a.user_id = ${userId}
      LIMIT 1
    `;

    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const { githubUrl, linkedinUrl, portfolioUrl } = await loadProfileUrls(userId);

    const [existing] = await sql`
      SELECT id, slug, view_count, click_count, total_dwell_sec, last_engaged_at
      FROM application_tracking
      WHERE application_id = ${applicationId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (existing) {
      await sql`
        UPDATE application_tracking
        SET
          github_url = ${githubUrl},
          linkedin_url = ${linkedinUrl},
          portfolio_url = ${portfolioUrl},
          company = ${String(app.company || 'Company')},
          role = ${String(app.role || '')}
        WHERE id = ${existing.id}
      `;
      await invalidateTrackingCache(String(existing.slug));
      void setCachedTracking(String(existing.slug), {
        id: Number(existing.id),
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        portfolio_url: portfolioUrl,
      });
      return NextResponse.json({
        ok: true,
        slug: existing.slug,
        url: `${origin}/v/${existing.slug}`,
        view_count: existing.view_count ?? 0,
        click_count: existing.click_count ?? 0,
        total_dwell_sec: existing.total_dwell_sec ?? 0,
        last_engaged_at: existing.last_engaged_at ?? null,
        created: false,
      });
    }

    let slug = buildTrackingSlug(String(app.company || 'company'), String(app.role || 'role'));
    let insertedId: number | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const rows = await sql`
          INSERT INTO application_tracking (
            user_id, application_id, slug, company, role,
            github_url, linkedin_url, portfolio_url
          )
          VALUES (
            ${userId}, ${applicationId}, ${slug},
            ${String(app.company || 'Company')}, ${String(app.role || '')},
            ${githubUrl}, ${linkedinUrl}, ${portfolioUrl}
          )
          RETURNING id
        `;
        insertedId = Number(rows[0]?.id);
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('unique') || msg.includes('duplicate')) {
          slug = buildTrackingSlug(String(app.company || 'company'), String(app.role || 'role'));
          continue;
        }
        throw err;
      }
    }

    if (insertedId) {
      await invalidateTrackingCache(slug);
      void setCachedTracking(slug, {
        id: insertedId,
        github_url: githubUrl,
        linkedin_url: linkedinUrl,
        portfolio_url: portfolioUrl,
      });
    }

    return NextResponse.json({
      ok: true,
      slug,
      url: `${origin}/v/${slug}`,
      view_count: 0,
      click_count: 0,
      total_dwell_sec: 0,
      last_engaged_at: null,
      created: true,
    });
  } catch (error: unknown) {
    console.error('[stealth-link]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create stealth link' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request, context: RouteContext) {
  return POST(req, context);
}
