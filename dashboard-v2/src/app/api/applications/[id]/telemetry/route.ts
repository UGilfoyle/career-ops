import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import { appOrigin } from '@/lib/telemetry/urls';
import { buildEngagementFollowup } from '@/lib/telemetry/followup';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
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

    const [track] = await sql`
      SELECT
        t.id,
        t.slug,
        t.company,
        t.role,
        t.github_url,
        t.linkedin_url,
        t.portfolio_url,
        t.view_count,
        t.click_count,
        t.total_dwell_sec,
        t.last_engaged_at,
        t.created_at,
        a.status AS application_status,
        a.applied_at,
        a.job_id
      FROM application_tracking t
      JOIN applications a ON a.id = t.application_id
      WHERE t.application_id = ${applicationId} AND t.user_id = ${userId}
      LIMIT 1
    `;

    if (!track) {
      return NextResponse.json({
        ok: true,
        has_tracking: false,
        tracking: null,
        breakdown: null,
        events: [],
        followup: null,
      });
    }

    const events = await sql`
      SELECT
        event_type,
        target,
        dwell_seconds,
        country,
        created_at
      FROM application_events
      WHERE tracking_id = ${track.id}
      ORDER BY created_at DESC
      LIMIT 40
    `;

    const [agg] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'PAGE_VIEW')::int AS page_views,
        COUNT(*) FILTER (WHERE event_type = 'OUTBOUND_CLICK' AND target = 'gh')::int AS clicks_gh,
        COUNT(*) FILTER (WHERE event_type = 'OUTBOUND_CLICK' AND target = 'li')::int AS clicks_li,
        COUNT(*) FILTER (WHERE event_type = 'OUTBOUND_CLICK' AND target = 'portfolio')::int AS clicks_portfolio
      FROM application_events
      WHERE tracking_id = ${track.id}
    `;

    const countries = await sql`
      SELECT
        COALESCE(country, 'Unknown') AS country,
        COUNT(*)::int AS count
      FROM application_events
      WHERE tracking_id = ${track.id}
      GROUP BY COALESCE(country, 'Unknown')
      ORDER BY count DESC
      LIMIT 8
    `;

    const viewCount = Number(track.view_count || 0);
    const clickCount = Number(track.click_count || 0);
    const dwellSec = Number(track.total_dwell_sec || 0);
    const engaged = viewCount > 0 || clickCount > 0 || Boolean(track.last_engaged_at);

    const followup = engaged
      ? buildEngagementFollowup({
          company: String(track.company || 'the team'),
          role: String(track.role || 'the role'),
          viewCount,
          clickCount,
          dwellSec,
          clicksGh: Number(agg?.clicks_gh || 0),
          clicksLi: Number(agg?.clicks_li || 0),
          lastEngagedAt: track.last_engaged_at ? new Date(track.last_engaged_at) : null,
          appliedAt: track.applied_at ? new Date(track.applied_at) : null,
        })
      : null;

    return NextResponse.json({
      ok: true,
      has_tracking: true,
      tracking: {
        id: track.id,
        slug: track.slug,
        url: `${appOrigin()}/v/${track.slug}`,
        company: track.company,
        role: track.role,
        view_count: viewCount,
        click_count: clickCount,
        total_dwell_sec: dwellSec,
        last_engaged_at: track.last_engaged_at,
        created_at: track.created_at,
        application_status: track.application_status,
        applied_at: track.applied_at,
        job_id: track.job_id,
      },
      breakdown: {
        page_views: Number(agg?.page_views || 0),
        clicks_gh: Number(agg?.clicks_gh || 0),
        clicks_li: Number(agg?.clicks_li || 0),
        clicks_portfolio: Number(agg?.clicks_portfolio || 0),
        countries: countries.map((c) => ({
          country: String(c.country),
          count: Number(c.count),
        })),
      },
      events: events.map((e) => ({
        event_type: e.event_type,
        target: e.target,
        dwell_seconds: e.dwell_seconds ?? 0,
        country: e.country,
        created_at: e.created_at,
      })),
      followup,
    });
  } catch (error: unknown) {
    console.error('[telemetry intel]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load telemetry' },
      { status: 500 }
    );
  }
}
