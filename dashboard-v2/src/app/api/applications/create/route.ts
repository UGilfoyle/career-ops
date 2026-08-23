import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const { jobId, status } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const appStatus = (status || 'APPLIED').toUpperCase();
    const marksApplied = !['EVALUATED', 'PENDING', 'SKIP', 'DISCARDED'].includes(appStatus);

    // Check if the application already exists
    const existing = await sql`
      SELECT id FROM applications 
      WHERE job_id = ${jobId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      const rows = marksApplied
        ? await sql`
            UPDATE applications
            SET
              status = ${appStatus},
              applied_at = COALESCE(applied_at, CURRENT_TIMESTAMP)
            WHERE id = ${existing[0].id} AND user_id = ${userId}
            RETURNING id, status, applied_at
          `
        : await sql`
            UPDATE applications
            SET status = ${appStatus}
            WHERE id = ${existing[0].id} AND user_id = ${userId}
            RETURNING id, status, applied_at
          `;
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        applicationId: rows[0]?.id ?? existing[0].id,
        status: rows[0]?.status ?? appStatus,
      });
    }

    // Insert new application — only stamp applied_at when actually applying
    const rows = marksApplied
      ? await sql`
          INSERT INTO applications (job_id, user_id, status, applied_at)
          VALUES (${jobId}, ${userId}, ${appStatus}, CURRENT_TIMESTAMP)
          RETURNING id, status
        `
      : await sql`
          INSERT INTO applications (job_id, user_id, status)
          VALUES (${jobId}, ${userId}, ${appStatus})
          RETURNING id, status
        `;

    return NextResponse.json({
      success: true,
      applicationId: rows[0].id,
      status: rows[0].status,
    });
  } catch (error: any) {
    console.error('Create application error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
