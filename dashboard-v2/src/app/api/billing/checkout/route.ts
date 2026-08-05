import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { appBaseUrl } from '@/lib/newsletter';
import { countryFromRequest } from '@/lib/billing/geo';
import { resolvePlanForCountry } from '@/lib/billing/plans';
import { upiConfigFromEnv } from '@/lib/billing/upi';

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

  // India: direct UPI to your VPA — zero fees, link never expires (skip CIT-style short-lived pages).
  const upiConfig = upiConfigFromEnv();
  if (country === 'IN' && upiConfig) {
    return NextResponse.json({
      provider: 'upi',
      url: `${base}/billing/upi`,
    });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (stripeKey) {
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
    stripeKeyPresent: Boolean(stripeKey),
    stripePriceIdPresent: Boolean(plan.stripePriceId),
    hint: 'Set UPI_VPA for India or STRIPE_SECRET_KEY for international localized checkout.',
  });

  return NextResponse.json({ error: 'billing_not_configured', message }, { status: 503 });
}
