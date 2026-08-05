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
  if (country === 'IN' && upiConfigFromEnv()) {
    return NextResponse.json({
      provider: 'upi',
      url: `${base}/billing/upi`,
    });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (stripeKey && plan.stripePriceId) {
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('customer_email', email);
    params.set('client_reference_id', userId);
    params.set('success_url', `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${base}/?billing=cancel`);
    params.set('line_items[0][price]', plan.stripePriceId);
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

  return NextResponse.json(
    {
      error: 'billing_not_configured',
      message: 'Set STRIPE_SECRET_KEY + STRIPE_PRICE_USD / STRIPE_PRICE_INR or BILLING_CHECKOUT_URL_* env vars.',
    },
    { status: 503 },
  );
}
