import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { isAdminEmail } from '@/lib/admin';
import { ensureBillingSchema } from '@/lib/billing/schema';

export const dynamic = 'force-dynamic';

function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/** Admin: active Pro subscriptions + UPI revenue summary. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  await ensureBillingSchema(sql);

  const summaryRows = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM user_subscriptions
        WHERE status IN ('active', 'trialing')
          AND (current_period_end IS NULL OR current_period_end > NOW())
      ) AS active_pro,
      (SELECT COUNT(*)::int FROM upi_payment_claims WHERE status = 'pending') AS pending_upi,
      (SELECT COUNT(*)::int FROM upi_payment_claims WHERE status = 'approved') AS approved_upi,
      (SELECT COALESCE(SUM(amount_inr), 0)::float FROM upi_payment_claims WHERE status = 'approved') AS total_inr,
      (SELECT COUNT(*)::int FROM upi_payment_claims
        WHERE status = 'approved'
          AND reviewed_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
      ) AS approved_this_month,
      (SELECT COALESCE(SUM(amount_inr), 0)::float FROM upi_payment_claims
        WHERE status = 'approved'
          AND reviewed_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
      ) AS inr_this_month
  `;

  const summaryRaw = summaryRows[0] || {};
  const totalInr = Number(summaryRaw.total_inr || 0);
  const inrThisMonth = Number(summaryRaw.inr_this_month || 0);

  const subs = await sql`
    SELECT
      s.user_id,
      s.status,
      s.plan,
      s.provider,
      s.country_code,
      s.currency,
      s.amount_minor,
      s.current_period_end,
      s.external_subscription_id,
      s.updated_at,
      u.email AS user_email,
      u.name AS user_name
    FROM user_subscriptions s
    LEFT JOIN users u ON u.id::text = s.user_id
    WHERE s.status IN ('active', 'trialing')
      AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
    ORDER BY s.updated_at DESC NULLS LAST
    LIMIT 200
  `;

  const recentApproved = await sql`
    SELECT id, user_email, amount_inr, utr, reviewed_at, reviewed_by
    FROM upi_payment_claims
    WHERE status = 'approved'
    ORDER BY reviewed_at DESC NULLS LAST
    LIMIT 20
  `;

  return NextResponse.json({
    summary: {
      activePro: Number(summaryRaw.active_pro || 0),
      pendingUpi: Number(summaryRaw.pending_upi || 0),
      approvedUpi: Number(summaryRaw.approved_upi || 0),
      totalInrCollected: totalInr,
      totalInrDisplay: formatInr(totalInr),
      inrThisMonth,
      inrThisMonthDisplay: formatInr(inrThisMonth),
      approvedThisMonth: Number(summaryRaw.approved_this_month || 0),
    },
    subscriptions: subs.map((r) => ({
      userId: String(r.user_id),
      userEmail: r.user_email ? String(r.user_email) : null,
      userName: r.user_name ? String(r.user_name) : null,
      status: String(r.status),
      plan: String(r.plan),
      provider: r.provider ? String(r.provider) : null,
      countryCode: r.country_code ? String(r.country_code) : null,
      currency: r.currency ? String(r.currency) : null,
      amountMinor: r.amount_minor != null ? Number(r.amount_minor) : null,
      currentPeriodEnd: r.current_period_end,
      externalRef: r.external_subscription_id ? String(r.external_subscription_id) : null,
      updatedAt: r.updated_at,
    })),
    recentUpiApproved: recentApproved.map((r) => ({
      id: r.id,
      userEmail: String(r.user_email),
      amountInr: Number(r.amount_inr),
      utr: String(r.utr),
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by ? String(r.reviewed_by) : null,
    })),
  });
}
