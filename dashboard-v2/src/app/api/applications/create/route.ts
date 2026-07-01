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

    // Check if the application already exists
    const existing = await sql`
      SELECT id FROM applications 
      WHERE job_id = ${jobId} AND user_id = ${userId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Application already exists for this job' }, { status: 400 });
    }

    // Insert new application record
    const rows = await sql`
      INSERT INTO applications (job_id, user_id, status, applied_at)
      VALUES (${jobId}, ${userId}, ${appStatus}, CURRENT_TIMESTAMP)
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
