import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { ensureBillingSchema } from '@/lib/billing/schema';
import { upiConfigFromEnv } from '@/lib/billing/upi';
import {
  getClaimByUtr,
  getLatestUpiClaim,
  hasProAccess,
} from '@/lib/billing/entitlements';
import {
  claimMessage,
  decideClaimSubmission,
  normalizeUtr,
} from '@/lib/billing/claims';
import { createProApproveToken } from '@/lib/billing/upi-approve-token';
import { appBaseUrl } from '@/lib/newsletter';
import { adminEmails } from '@/lib/admin';
import { sendUpiClaimAdminEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = upiConfigFromEnv();
  if (!cfg) {
    return NextResponse.json({ error: 'UPI billing not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const utr = normalizeUtr(body.utr);
  const transactionRef = String(body.transactionRef || '').trim() || null;

  await ensureBillingSchema(sql);

  const decision = decideClaimSubmission({
    userId: session.user.id,
    hasPro: await hasProAccess(session.user.id, session.user.email, session.user.githubLogin),
    utr,
    sameUtrClaim: utr ? await getClaimByUtr(utr) : null,
    openClaim: await getLatestUpiClaim(session.user.id),
  });

  if (decision.action === 'already_pro') {
    return NextResponse.json({ ok: true, hasPro: true, message: 'Pro is already active.' });
  }

  if (decision.action === 'invalid_utr') {
    return NextResponse.json(
      { error: 'Enter the 12-digit UPI transaction ID (UTR) from your payment app or bank SMS.' },
      { status: 400 },
    );
  }

  if (decision.action === 'utr_taken_by_other_user') {
    return NextResponse.json({ error: 'This UTR was already submitted.' }, { status: 409 });
  }

  if (decision.action === 'reuse_own_claim' || decision.action === 'awaiting_review') {
    return NextResponse.json({
      ok: true,
      claimId: decision.claim.id,
      status: decision.claim.status,
      duplicate: true,
      message: claimMessage(decision.claim.status),
    });
  }

  const rows = await sql`
    INSERT INTO upi_payment_claims (
      user_id, user_email, amount_inr, upi_vpa, transaction_ref, utr, status
    ) VALUES (
      ${String(session.user.id)},
      ${session.user.email},
      ${cfg.amountInr},
      ${cfg.vpa},
      ${transactionRef},
      ${utr},
      'pending'
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  const claimId = rows[0]?.id;

  // Lost a concurrent double-submit race: reuse the row that won instead of erroring.
  if (!claimId) {
    const existing = (await getClaimByUtr(utr)) || (await getLatestUpiClaim(session.user.id));
    return NextResponse.json({
      ok: true,
      claimId: existing?.id ?? null,
      status: existing?.status ?? 'pending',
      duplicate: true,
      message: claimMessage(existing?.status ?? 'pending'),
    });
  }

  const approveUrl = claimId
    ? `${appBaseUrl()}/api/billing/upi/approve?claimId=${claimId}&token=${encodeURIComponent(createProApproveToken(String(claimId)))}`
    : '';

  console.log('[UPI claim]', {
    claimId,
    userId: session.user.id,
    email: session.user.email,
    utr,
    transactionRef,
  });

  if (claimId && approveUrl) {
    for (const adminEmail of adminEmails()) {
      void sendUpiClaimAdminEmail(adminEmail, {
        userEmail: session.user.email,
        amountInr: cfg.amountInr,
        utr,
        transactionRef,
        approveUrl,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    claimId,
    status: 'pending',
    message:
      'Payment received for verification. Pro activates after we confirm the UTR (usually within a few hours). You will get the access email once approved.',
  });
}
