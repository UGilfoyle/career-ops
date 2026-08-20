import { NextRequest, NextResponse, after } from 'next/server';
import sql from '@/lib/db';
import { ensureApplicationTelemetrySchema } from '@/lib/ops-schema';
import { getPrivacySafeHash } from '@/lib/telemetry/hash';
import { clientIpFromHeaders, isBotUserAgent, isPrefetchRequest } from '@/lib/telemetry/bot';
import { isValidDestination } from '@/lib/telemetry/urls';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; target: string }> }
) {
  await ensureApplicationTelemetrySchema(sql);

  const { slug, target } = await params;

  const [track] = await sql`
    SELECT id, github_url, linkedin_url, portfolio_url
    FROM application_tracking
    WHERE slug = ${slug}
    LIMIT 1
  `;

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

  if (!isPrefetch && !isBotUserAgent(ua)) {
    after(async () => {
      try {
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
