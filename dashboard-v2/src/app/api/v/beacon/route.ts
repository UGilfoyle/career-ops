import { NextRequest, NextResponse, after } from 'next/server';
import sql from '@/lib/db';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import { getPrivacySafeHash } from '@/lib/telemetry/hash';
import { clientIpFromHeaders, isBotUserAgent, isPrefetchRequest } from '@/lib/telemetry/bot';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await ensureApplicationTelemetrySchema(sql);

    const body = await req.json().catch(() => ({}));
    const slug = typeof body.slug === 'string' ? body.slug.slice(0, 100) : null;
    const dwellSeconds = Number.isInteger(body.dwellSeconds) ? body.dwellSeconds : 0;

    if (!slug || dwellSeconds < 4 || dwellSeconds > 7200) {
      return NextResponse.json({ ok: true });
    }

    const [track] = await sql`
      SELECT id FROM application_tracking WHERE slug = ${slug} LIMIT 1
    `;

    if (!track) {
      return NextResponse.json({ ok: true });
    }

    const ua = req.headers.get('user-agent') || 'unknown';
    if (isPrefetchRequest(req.headers) || isBotUserAgent(ua)) {
      return NextResponse.json({ ok: true });
    }

    const ip = clientIpFromHeaders(req.headers);
    const country = req.headers.get('x-vercel-ip-country') || null;

    after(async () => {
      try {
        const ipHash = getPrivacySafeHash(ip, ua);
        await sql`
          INSERT INTO application_events (
            tracking_id, event_type, target, ip_hash, user_agent, dwell_seconds, country
          )
          VALUES (
            ${track.id}, 'PAGE_VIEW', 'full_page', ${ipHash}, ${ua.slice(0, 500)},
            ${dwellSeconds}, ${country}
          )
        `;
        await sql`
          UPDATE application_tracking
          SET
            view_count = view_count + 1,
            total_dwell_sec = total_dwell_sec + ${dwellSeconds},
            last_engaged_at = NOW()
          WHERE id = ${track.id}
        `;
      } catch (err) {
        console.error('[Telemetry] Background beacon logging error:', err);
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
