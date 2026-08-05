import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { activateProSubscription } from '@/lib/billing/entitlements';
import { countryFromRequest } from '@/lib/billing/geo';
import { resolvePlanForCountry } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';

/** Confirm Stripe Checkout session after redirect (backup to webhook). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await req.json();
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message || 'Session lookup failed' }, { status: 502 });
  }

  if (data.payment_status !== 'paid' && data.status !== 'complete') {
    return NextResponse.json({ error: 'Payment not completed yet' }, { status: 402 });
  }

  const ref = String(data.client_reference_id || data.metadata?.user_id || '');
  if (ref !== String(session.user.id)) {
    return NextResponse.json({ error: 'Session user mismatch' }, { status: 403 });
  }

  const country = countryFromRequest(req);
  const plan = resolvePlanForCountry(String(data.metadata?.country || country));
  await activateProSubscription({
    userId: session.user.id,
    countryCode: String(data.metadata?.country || country),
    currency: plan.currency,
    amountMinor: plan.amountMinor,
    provider: 'stripe',
    externalCustomerId: String(data.customer || ''),
    externalSubscriptionId: String(data.subscription || ''),
  });

  return NextResponse.json({ ok: true, hasPro: true });
}
