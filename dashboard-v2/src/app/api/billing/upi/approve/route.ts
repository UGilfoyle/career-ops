import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';
import { isAdminEmail } from '@/lib/admin';
import { ensureBillingSchema } from '@/lib/billing/schema';
import { activateProSubscription } from '@/lib/billing/entitlements';
import { verifyProApproveToken } from '@/lib/billing/upi-approve-token';
import { proAccessUrl } from '@/lib/billing/access-token';
import { sendProAccessEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

async function approveClaim(claimId: number, reviewedBy: string) {
  await ensureBillingSchema(sql);
  const rows = await sql`
    SELECT id, user_id, user_email, amount_inr, utr, status
    FROM upi_payment_claims WHERE id = ${claimId} LIMIT 1
  `;
  const claim = rows[0];
  if (!claim) return { ok: false as const, error: 'Claim not found', status: 404 };
  if (claim.status === 'approved') {
    return { ok: true as const, already: true, userId: String(claim.user_id) };
  }

  await sql`
    UPDATE upi_payment_claims
    SET status = 'approved', reviewed_at = NOW(), reviewed_by = ${reviewedBy}
    WHERE id = ${claimId}
  `;

  const userId = String(claim.user_id);
  await activateProSubscription({
    userId,
    countryCode: 'IN',
    currency: 'inr',
    amountMinor: Math.round(Number(claim.amount_inr) * 100),
    provider: 'upi_direct',
    externalSubscriptionId: String(claim.utr),
  });

  const email = String(claim.user_email || '');
  if (email) {
    const link = proAccessUrl(userId);
    await sendProAccessEmail(email, '', link, `₹${claim.amount_inr}`);
    await sql`
      UPDATE user_subscriptions SET access_email_sent_at = NOW(), updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  }

  return { ok: true as const, userId, email, action: 'approved' as const };
}

async function rejectClaim(claimId: number, reviewedBy: string) {
  await ensureBillingSchema(sql);
  const rows = await sql`
    SELECT id, status FROM upi_payment_claims WHERE id = ${claimId} LIMIT 1
  `;
  const claim = rows[0];
  if (!claim) return { ok: false as const, error: 'Claim not found', status: 404 };
  if (claim.status === 'approved') {
    return { ok: false as const, error: 'Already approved — cannot reject', status: 409 };
  }
  if (claim.status === 'rejected') {
    return { ok: true as const, already: true, action: 'rejected' as const };
  }

  await sql`
    UPDATE upi_payment_claims
    SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ${reviewedBy}
    WHERE id = ${claimId}
  `;
  return { ok: true as const, action: 'rejected' as const };
}

/** Admin: approve UPI claim via signed link (from email) or logged-in admin. */
export async function GET(req: NextRequest) {
  const claimId = Number(req.nextUrl.searchParams.get('claimId'));
  const token = String(req.nextUrl.searchParams.get('token') || '');

  if (!Number.isFinite(claimId) || !token) {
    return NextResponse.json({ error: 'claimId and token required' }, { status: 400 });
  }
  if (!verifyProApproveToken(String(claimId), token)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const session = await auth();
  const reviewer = session?.user?.email && isAdminEmail(session.user.email)
    ? session.user.email
    : 'link-approve';

  const result = await approveClaim(claimId, reviewer);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const base = req.nextUrl.origin;
  return NextResponse.redirect(`${base}/?tab=resume-studio&pro=activated`);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json();
  const id = Number(body.claimId);
  const action = String(body.action || 'approve').toLowerCase();
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'claimId required' }, { status: 400 });
  }

  if (action === 'reject') {
    const result = await rejectClaim(id, session.user.email);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  }

  const result = await approveClaim(id, session.user.email);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
