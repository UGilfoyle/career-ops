import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { appOriginFromRequest } from '@/lib/telemetry/urls';
import { ensureStealthLinkForJob } from '@/lib/telemetry/ensure-stealth-link';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Create/copy stealth companion link for a job BEFORE marking Applied.
 * Ensures an EVALUATED application exists (does not set applied_at), then tracking slug.
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
    const jobId = Number(id);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
    }

    const result = await ensureStealthLinkForJob(sql, { userId, jobId, origin });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      slug: result.slug,
      url: result.url,
      application_id: result.applicationId,
      view_count: result.view_count,
      click_count: result.click_count,
      total_dwell_sec: result.total_dwell_sec,
      last_engaged_at: result.last_engaged_at,
      created: result.created,
      application_created: result.applicationCreated,
      profile_name: result.profile_name,
    });
  } catch (error: unknown) {
    console.error('[job/stealth-link]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create stealth link' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request, context: RouteContext) {
  return POST(req, context);
}
