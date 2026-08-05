import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { isAdminEmail } from '@/lib/admin';
import { ensureBillingSchema } from '@/lib/billing/schema';

export const dynamic = 'force-dynamic';

/** Admin: list UPI payment claims (pending first). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  await ensureBillingSchema(sql);
  const status = String(req.nextUrl.searchParams.get('status') || 'all').toLowerCase();

  const rows =
    status === 'pending' || status === 'approved' || status === 'rejected'
      ? await sql`
          SELECT id, user_id, user_email, amount_inr, upi_vpa, transaction_ref, utr, status,
                 created_at, reviewed_at, reviewed_by
          FROM upi_payment_claims
          WHERE status = ${status}
          ORDER BY created_at DESC
          LIMIT 100
        `
      : await sql`
          SELECT id, user_id, user_email, amount_inr, upi_vpa, transaction_ref, utr, status,
                 created_at, reviewed_at, reviewed_by
          FROM upi_payment_claims
          ORDER BY
            CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
            created_at DESC
          LIMIT 100
        `;

  const pendingCount = await sql`
    SELECT COUNT(*)::int AS c FROM upi_payment_claims WHERE status = 'pending'
  `;

  return NextResponse.json({
    pendingCount: pendingCount[0]?.c ?? 0,
    claims: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      amountInr: Number(r.amount_inr),
      upiVpa: r.upi_vpa,
      transactionRef: r.transaction_ref,
      utr: r.utr,
      status: r.status,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
    })),
  });
}
