import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  buildUpiPayUri,
  maskVpa,
  qrCodeImageUrl,
  upiConfigFromEnv,
  upiTransactionRef,
} from '@/lib/billing/upi';
import { getLatestUpiClaim, hasProAccess } from '@/lib/billing/entitlements';
import { blocksNewPayment, claimMessage } from '@/lib/billing/claims';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = upiConfigFromEnv();
  if (!cfg) {
    return NextResponse.json({ error: 'UPI billing not configured' }, { status: 503 });
  }

  const pro = await hasProAccess(session.user.id, session.user.email, session.user.githubLogin);
  if (pro) {
    return NextResponse.json({ hasPro: true, amountInr: cfg.amountInr, display: `₹${cfg.amountInr}` });
  }

  const claim = await getLatestUpiClaim(session.user.id);
  const transactionRef = upiTransactionRef(session.user.id);
  const upiUri = buildUpiPayUri(cfg, transactionRef);

  return NextResponse.json({
    hasPro: false,
    claim: claim
      ? {
          id: claim.id,
          status: claim.status,
          utr: claim.utr,
          submittedAt: claim.createdAt,
          message: claimMessage(claim.status),
        }
      : null,
    awaitingReview: blocksNewPayment(claim?.status),
    // Only the masked handle is exposed; the real VPA travels inside the QR /
    // deep link straight into the payer's UPI app.
    vpaMasked: maskVpa(cfg.vpa),
    payeeName: cfg.payeeName,
    amountInr: cfg.amountInr,
    display: `₹${cfg.amountInr}`,
    note: cfg.note,
    upiUri,
    qrUrl: qrCodeImageUrl(upiUri),
    transactionRef,
    zeroFees: true,
  });
}
