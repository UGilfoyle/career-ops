import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { appBaseUrl } from '@/lib/newsletter';
import { countryFromRequest } from '@/lib/billing/geo';
import { resolvePlanForCountry } from '@/lib/billing/plans';
import { shouldUseUpiCheckout, stripeBillingEnabled } from '@/lib/billing/provider';
import { getLatestUpiClaim, hasProAccess } from '@/lib/billing/entitlements';
import { blocksNewPayment, claimMessage } from '@/lib/billing/claims';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const country = countryFromRequest(req);
  const plan = resolvePlanForCountry(country);
  const base = appBaseUrl();
  const userId = session.user.id;
  const email = session.user.email;

  // Never charge twice: an active subscription short-circuits before any provider call.
  if (await hasProAccess(userId, email, session.user.githubLogin)) {
    return NextResponse.json({ hasPro: true, provider: 'none', message: 'Pro is already active.' });
  }

  const claim = await getLatestUpiClaim(userId);
  if (blocksNewPayment(claim?.status)) {
    return NextResponse.json({
      provider: 'upi',
      url: `${base}/billing/upi`,
      status: claim!.status,
      awaitingReview: true,
      message: claimMessage(claim!.status),
    });
  }

  // Path 1: direct UPI — zero fees, link never expires (skip CIT-style short-lived pages).
  if (shouldUseUpiCheckout(country)) {
    return NextResponse.json({
      provider: 'upi',
      url: `${base}/billing/upi`,
    });
  }

  if (stripeBillingEnabled()) {
    const stripeKey = process.env.STRIPE_SECRET_KEY!.trim();
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('customer_email', email);
    params.set('client_reference_id', userId);
    params.set('success_url', `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${base}/?billing=cancel`);
    if (plan.stripePriceId) {
      params.set('line_items[0][price]', plan.stripePriceId);
    } else {
      // Inline recurring price lets geo currencies work without creating a
      // separate Stripe Price object for every supported country.
      params.set('line_items[0][price_data][currency]', plan.currency);
      params.set('line_items[0][price_data][unit_amount]', String(plan.amountMinor));
      params.set('line_items[0][price_data][recurring][interval]', 'month');
      params.set('line_items[0][price_data][product_data][name]', 'Career-Ops Pro');
    }
    params.set('line_items[0][quantity]', '1');
    params.set('metadata[user_id]', userId);
    params.set('metadata[country]', country);
    params.set('subscription_data[metadata][user_id]', userId);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Stripe checkout error', data);
      return NextResponse.json({ error: data.error?.message || 'Stripe checkout failed' }, { status: 502 });
    }
    return NextResponse.json({ url: data.url, provider: 'stripe' });
  }

  if (plan.manualCheckoutUrl) {
    const sep = plan.manualCheckoutUrl.includes('?') ? '&' : '?';
    const url = `${plan.manualCheckoutUrl}${sep}client_reference_id=${encodeURIComponent(userId)}&prefilled_email=${encodeURIComponent(email)}`;
    return NextResponse.json({ url, provider: 'manual' });
  }

  const message = process.env.UPI_VPA
    ? 'Payment temporarily unavailable. Please try again shortly.'
    : 'Payments are being set up. Please try again shortly or email support.';

  console.error('[billing/checkout] not configured', {
    country,
    upiVpaPresent: Boolean(process.env.UPI_VPA),
    upiEnabled: process.env.BILLING_UPI_ENABLED !== '0',
    stripeEnabled: stripeBillingEnabled(),
    stripeKeyPresent: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    stripePriceIdPresent: Boolean(plan.stripePriceId),
    hint: 'Set UPI_VPA for India (Path 1). Stripe only when BILLING_STRIPE_ENABLED=1.',
  });

  return NextResponse.json({ error: 'billing_not_configured', message }, { status: 503 });
}
