import { NextRequest, NextResponse, after } from 'next/server';
import sql from '@/lib/db';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import { getPrivacySafeHash } from '@/lib/telemetry/hash';
import { clientIpFromHeaders, isBotUserAgent, isPrefetchRequest } from '@/lib/telemetry/bot';
import { getCachedTracking, setCachedTracking } from '@/lib/telemetry/cache';
import { allowTelemetryBeaconLog } from '@/lib/telemetry/limits';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = typeof body.slug === 'string' ? body.slug.slice(0, 100) : null;
    const dwellSeconds = Number.isInteger(body.dwellSeconds) ? body.dwellSeconds : 0;

    if (!slug || dwellSeconds < 4 || dwellSeconds > 7200) {
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    const ua = req.headers.get('user-agent') || 'unknown';
    if (isPrefetchRequest(req.headers) || isBotUserAgent(ua)) {
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    const ip = clientIpFromHeaders(req.headers);
    if (!(await allowTelemetryBeaconLog(ip))) {
      // Soft: acknowledge, skip write under abuse pressure
      return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
    }

    let trackingId: number | null = null;
    const cached = await getCachedTracking(slug);
    if (cached) {
      trackingId = cached.id;
    } else {
      await ensureApplicationTelemetrySchema(sql);
      const [track] = await sql`
        SELECT id, github_url, linkedin_url, portfolio_url
        FROM application_tracking WHERE slug = ${slug} LIMIT 1
      `;
      if (!track) {
        return NextResponse.json({ ok: true });
      }
      trackingId = Number(track.id);
      void setCachedTracking(slug, {
        id: trackingId,
        github_url: track.github_url ?? null,
        linkedin_url: track.linkedin_url ?? null,
        portfolio_url: track.portfolio_url ?? null,
      });
    }

    const country = req.headers.get('x-vercel-ip-country') || null;

    after(async () => {
      try {
        await ensureApplicationTelemetrySchema(sql);
        const ipHash = getPrivacySafeHash(ip, ua);
        await sql`
          INSERT INTO application_events (
            tracking_id, event_type, target, ip_hash, user_agent, dwell_seconds, country
          )
          VALUES (
            ${trackingId}, 'PAGE_VIEW', 'full_page', ${ipHash}, ${ua.slice(0, 500)},
            ${dwellSeconds}, ${country}
          )
        `;
        await sql`
          UPDATE application_tracking
          SET
            view_count = view_count + 1,
            total_dwell_sec = total_dwell_sec + ${dwellSeconds},
            last_engaged_at = NOW()
          WHERE id = ${trackingId}
        `;
      } catch (err) {
        console.error('[Telemetry] Background beacon logging error:', err);
      }
    });

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch {
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  }
}
