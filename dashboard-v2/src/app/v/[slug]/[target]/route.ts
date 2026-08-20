import { NextRequest, NextResponse, after } from 'next/server';
import sql from '@/lib/db';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import { getPrivacySafeHash } from '@/lib/telemetry/hash';
import { clientIpFromHeaders, isBotUserAgent, isPrefetchRequest } from '@/lib/telemetry/bot';
import { isValidDestination } from '@/lib/telemetry/urls';
import { getCachedTracking, setCachedTracking, type TrackingDestCache } from '@/lib/telemetry/cache';
import { allowTelemetryRedirectLog } from '@/lib/telemetry/limits';

export const dynamic = 'force-dynamic';

async function resolveTracking(slug: string): Promise<TrackingDestCache | null> {
  const cached = await getCachedTracking(slug);
  if (cached) return cached;

  await ensureApplicationTelemetrySchema(sql);
  const [track] = await sql`
    SELECT id, github_url, linkedin_url, portfolio_url
    FROM application_tracking
    WHERE slug = ${slug}
    LIMIT 1
  `;
  if (!track) return null;

  const row: TrackingDestCache = {
    id: Number(track.id),
    github_url: track.github_url ?? null,
    linkedin_url: track.linkedin_url ?? null,
    portfolio_url: track.portfolio_url ?? null,
  };
  void setCachedTracking(slug, row);
  return row;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; target: string }> }
) {
  const { slug, target } = await params;
  const track = await resolveTracking(slug);

  if (!track) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  let rawDestination: string | null = null;
  if (target === 'gh') rawDestination = track.github_url;
  else if (target === 'li') rawDestination = track.linkedin_url;
  else if (target === 'portfolio') rawDestination = track.portfolio_url;

  const destination = isValidDestination(rawDestination)
    ? (rawDestination as string)
    : isValidDestination(track.portfolio_url)
      ? (track.portfolio_url as string)
      : 'https://github.com';

  const ua = req.headers.get('user-agent') || 'unknown';
  const isPrefetch = isPrefetchRequest(req.headers);
  const ip = clientIpFromHeaders(req.headers);
  const country = req.headers.get('x-vercel-ip-country') || null;
  const allowLog =
    !isPrefetch && !isBotUserAgent(ua) && (await allowTelemetryRedirectLog(ip));

  if (allowLog) {
    after(async () => {
      try {
        await ensureApplicationTelemetrySchema(sql);
        const ipHash = getPrivacySafeHash(ip, ua);
        await sql`
          INSERT INTO application_events (tracking_id, event_type, target, ip_hash, user_agent, country)
          VALUES (${track.id}, 'OUTBOUND_CLICK', ${target}, ${ipHash}, ${ua.slice(0, 500)}, ${country})
        `;
        await sql`
          UPDATE application_tracking
          SET click_count = click_count + 1, last_engaged_at = NOW()
          WHERE id = ${track.id}
        `;
      } catch (err) {
        console.error('[Telemetry] Background click logging error:', err);
      }
    });
  }

  return NextResponse.redirect(destination, 302);
}
