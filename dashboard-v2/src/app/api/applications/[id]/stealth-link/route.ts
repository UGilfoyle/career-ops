import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import type { ResumeContext } from '@/lib/resume/types';
import {
  appOrigin,
  buildTrackingSlug,
  normalizeExternalUrl,
} from '@/lib/telemetry/urls';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Ensure a stealth companion link exists for an application and return its URL.
 * Idempotent: reuses existing application_tracking row when present.
 */
export async function POST(_req: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = String(session.user.id);
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

    const [existing] = await sql`
      SELECT slug, view_count, click_count, total_dwell_sec, last_engaged_at
      FROM application_tracking
      WHERE application_id = ${applicationId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (existing) {
      const url = `${appOrigin()}/v/${existing.slug}`;
      return NextResponse.json({
        ok: true,
        slug: existing.slug,
        url,
        view_count: existing.view_count ?? 0,
        click_count: existing.click_count ?? 0,
        total_dwell_sec: existing.total_dwell_sec ?? 0,
        last_engaged_at: existing.last_engaged_at ?? null,
        created: false,
      });
    }

    const [profileRow] = await sql`
      SELECT resume_context FROM user_profiles WHERE user_id = ${Number(userId)} LIMIT 1
    `;
    const ctx = (profileRow?.resume_context || {}) as ResumeContext;
    const candidate = ctx.candidate || {};

    const githubUrl = normalizeExternalUrl(candidate.github);
    const linkedinUrl = normalizeExternalUrl(candidate.linkedin);
    const portfolioUrl = normalizeExternalUrl(candidate.portfolio_url);

    let slug = buildTrackingSlug(String(app.company || 'company'), String(app.role || 'role'));
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await sql`
          INSERT INTO application_tracking (
            user_id, application_id, slug, company, role,
            github_url, linkedin_url, portfolio_url
          )
          VALUES (
            ${userId}, ${applicationId}, ${slug},
            ${String(app.company || 'Company')}, ${String(app.role || '')},
            ${githubUrl}, ${linkedinUrl}, ${portfolioUrl}
          )
        `;
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

    const url = `${appOrigin()}/v/${slug}`;
    return NextResponse.json({
      ok: true,
      slug,
      url,
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

export async function GET(_req: Request, context: RouteContext) {
  return POST(_req, context);
}
