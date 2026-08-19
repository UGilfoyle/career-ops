import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { isAdminEmail } from '@/lib/admin';
import { ensureBackgroundSchema } from '@/lib/ops-schema';
import { fetchProductAnalytics } from '@/lib/analytics/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await ensureBackgroundSchema(sql);
    const data = await fetchProductAnalytics();

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      ...data,
      notes: {
        tailored_jobs:
          'Jobs with resume_html, cover_letter_html, resume_pdf_key, or legacy PDF bytes — source of truth for deliverables.',
        github_runs:
          'Queued GitHub Actions runs from background_runs (scan, tailor, apply, add-job).',
        tailor_output_rate:
          'Platform-wide tailored_jobs / tailor_runs — approximate; one run may touch multiple jobs over time.',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Admin analytics failed';
    console.error('[admin/analytics]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
