import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = [
  'EVALUATED',
  'APPLIED',
  'RESPONDED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'DISCARDED',
  'SKIP',
  'PENDING'
];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    
    const { id } = await ctx.params;
    const appId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(appId)) {
      return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
    }

    const { status } = await req.json();
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const statusUpper = status.toUpperCase();
    if (!VALID_STATUSES.includes(statusUpper)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }

    // Update the application status
    // If status is changed to APPLIED, initialize applied_at if not set
    const rows = await sql`
      UPDATE applications
      SET 
        status = ${statusUpper},
        applied_at = CASE 
          WHEN ${statusUpper} = 'APPLIED' AND applied_at IS NULL THEN CURRENT_TIMESTAMP 
          ELSE applied_at 
        END
      WHERE id = ${appId} AND user_id = ${userId}
      RETURNING id, status, applied_at
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Application not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Application status updated successfully',
      application: rows[0]
    });

  } catch (error: any) {
    console.error('Update application status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
