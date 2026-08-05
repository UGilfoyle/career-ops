import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { ensureBillingSchema } from '@/lib/billing/schema';
import { upiConfigFromEnv } from '@/lib/billing/upi';
import { hasProAccess } from '@/lib/billing/entitlements';
import { createProApproveToken } from '@/lib/billing/upi-approve-token';
import { appBaseUrl } from '@/lib/newsletter';
import { adminEmails } from '@/lib/admin';
import { sendUpiClaimAdminEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

function normalizeUtr(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = upiConfigFromEnv();
  if (!cfg) {
    return NextResponse.json({ error: 'UPI billing not configured' }, { status: 503 });
  }

  if (await hasProAccess(session.user.id, session.user.email)) {
    return NextResponse.json({ ok: true, hasPro: true, message: 'Pro already active' });
  }

  const body = await req.json().catch(() => ({}));
  const utr = normalizeUtr(String(body.utr || ''));
  const transactionRef = String(body.transactionRef || '').trim() || null;

  if (!/^[0-9A-Z]{8,22}$/.test(utr)) {
    return NextResponse.json(
      { error: 'Enter the 12-digit UPI transaction ID (UTR) from your payment app or bank SMS.' },
      { status: 400 },
    );
  }

  await ensureBillingSchema(sql);

  const existing = await sql`
    SELECT id, user_id, status FROM upi_payment_claims WHERE utr = ${utr} LIMIT 1
  `;
  if (existing[0]) {
    if (String(existing[0].user_id) === String(session.user.id)) {
      return NextResponse.json({
        ok: true,
        status: existing[0].status,
        message: existing[0].status === 'approved'
          ? 'Payment verified. Pro is active.'
          : 'We already received this UTR. Verification usually takes a few hours.',
      });
    }
    return NextResponse.json({ error: 'This UTR was already submitted.' }, { status: 409 });
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
    RETURNING id
  `;
  const claimId = rows[0]?.id;

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
    status: 'pending',
    message:
      'Payment received for verification. Pro activates after we confirm the UTR (usually within a few hours). You will get the access email once approved.',
  });
}
