import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { headers } from 'next/headers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Ensure the page_views table exists
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS page_views (
      id SERIAL PRIMARY KEY,
      visitor_hash TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '/',
      referrer TEXT,
      user_agent TEXT,
      country TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  // Index for fast unique visitor queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_page_views_visitor_hash ON page_views (visitor_hash);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views (created_at);
  `;
}

// Generate a privacy-safe visitor hash from IP + User-Agent (no raw IP stored)
function getVisitorHash(ip: string, ua: string): string {
  const daily = new Date().toISOString().slice(0, 10); // rotate daily
  return crypto
    .createHash('sha256')
    .update(`${ip}|${ua}|${daily}`)
    .digest('hex')
    .slice(0, 16);
}

// POST: Record a page view
export async function POST(request: Request) {
  try {
    await ensureTable();

    const headersList = await headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headersList.get('x-real-ip') ||
      'unknown';
    const ua = headersList.get('user-agent') || 'unknown';
    const country = headersList.get('x-vercel-ip-country') || null;

    const body = await request.json().catch(() => ({}));
    const path = String(body.path || '/').slice(0, 500);
    const referrer = body.referrer ? String(body.referrer).slice(0, 1000) : null;

    const visitorHash = getVisitorHash(ip, ua);

    await sql`
      INSERT INTO page_views (visitor_hash, path, referrer, user_agent, country)
      VALUES (${visitorHash}, ${path}, ${referrer}, ${ua.slice(0, 500)}, ${country})
    `;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Page view tracking error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// GET: Fetch visitor analytics (auth required)
export async function GET() {
  try {
    // Import auth dynamically to avoid circular deps
    const { auth } = await import('@/auth');
    const session = await auth();
    const isAdmin = session?.user?.email === "admin@career-ops.local";

    await ensureTable();

    // Today's stats (Publicly accessible)
    const todayRows = await sql`
      SELECT
        COUNT(*)::int AS total_views,
        COUNT(DISTINCT visitor_hash)::int AS unique_visitors
      FROM page_views
      WHERE created_at >= CURRENT_DATE
    `;

    // All time stats (Publicly accessible)
    const allTimeRows = await sql`
      SELECT
        COUNT(*)::int AS total_views,
        COUNT(DISTINCT visitor_hash)::int AS unique_visitors
      FROM page_views
    `;

    if (!isAdmin) {
      // Return limited stats for public landing page / non-admin users
      return NextResponse.json({
        today: todayRows[0] || { total_views: 0, unique_visitors: 0 },
        allTime: allTimeRows[0] || { total_views: 0, unique_visitors: 0 },
      });
    }

    // --- Authenticated Only Stats ---

    // Last 7 days stats
    const weekRows = await sql`
      SELECT
        COUNT(*)::int AS total_views,
        COUNT(DISTINCT visitor_hash)::int AS unique_visitors
      FROM page_views
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `;

    // Last 30 days stats
    const monthRows = await sql`
      SELECT
        COUNT(*)::int AS total_views,
        COUNT(DISTINCT visitor_hash)::int AS unique_visitors
      FROM page_views
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `;

    // Daily breakdown (last 14 days)
    const dailyRows = await sql`
      SELECT
        DATE(created_at) AS date,
        COUNT(*)::int AS views,
        COUNT(DISTINCT visitor_hash)::int AS unique_visitors
      FROM page_views
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Top pages
    const topPagesRows = await sql`
      SELECT
        path,
        COUNT(*)::int AS views,
        COUNT(DISTINCT visitor_hash)::int AS unique_visitors
      FROM page_views
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY path
      ORDER BY views DESC
      LIMIT 10
    `;

    // Top countries
    const topCountriesRows = await sql`
      SELECT
        COALESCE(country, 'Unknown') AS country,
        COUNT(DISTINCT visitor_hash)::int AS unique_visitors
      FROM page_views
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY country
      ORDER BY unique_visitors DESC
      LIMIT 10
    `;

    return NextResponse.json({
      today: todayRows[0] || { total_views: 0, unique_visitors: 0 },
      week: weekRows[0] || { total_views: 0, unique_visitors: 0 },
      month: monthRows[0] || { total_views: 0, unique_visitors: 0 },
      allTime: allTimeRows[0] || { total_views: 0, unique_visitors: 0 },
      daily: dailyRows,
      topPages: topPagesRows,
      topCountries: topCountriesRows,
    });
  } catch (error: any) {
    console.error('Analytics fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
