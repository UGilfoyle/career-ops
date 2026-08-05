import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import sql from '@/lib/db';
import { activateProSubscription } from '@/lib/billing/entitlements';
import { ensureBillingSchema } from '@/lib/billing/schema';
import { resolvePlanForCountry } from '@/lib/billing/plans';
import { proAccessUrl } from '@/lib/billing/access-token';
import { sendProAccessEmail } from '@/lib/mail';

export const dynamic = 'force-dynamic';

function verifyStripeSignature(payload: string, sigHeader: string, secret: string): boolean {
  const parts = sigHeader.split(',').reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const signed = `${ts}.${payload}`;
  const expected = createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  try {
    return timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function grantProFromCheckout(userId: string, country?: string, customerId?: string, subId?: string) {
  const plan = resolvePlanForCountry(country);
  await activateProSubscription({
    userId,
    countryCode: country,
    currency: plan.currency,
    amountMinor: plan.amountMinor,
    provider: 'stripe',
    externalCustomerId: customerId,
    externalSubscriptionId: subId,
  });

  await ensureBillingSchema(sql);
  const users = await sql`SELECT email, name FROM users WHERE id = ${userId} LIMIT 1`;
  const email = users[0]?.email as string | undefined;
  if (email) {
    const sent = await sql`
      SELECT access_email_sent_at FROM user_subscriptions WHERE user_id = ${userId} LIMIT 1
    `;
    const already = sent[0]?.access_email_sent_at;
    if (!already) {
      const link = proAccessUrl(userId);
      await sendProAccessEmail(email, String(users[0]?.name || ''), link, plan.display);
      await sql`
        UPDATE user_subscriptions SET access_email_sent_at = NOW(), updated_at = NOW()
        WHERE user_id = ${userId}
      `;
    }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') || '';
  if (!verifyStripeSignature(payload, sig, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = (event.data?.object || {}) as Record<string, unknown>;
    const metadata = (session.metadata || {}) as Record<string, string>;
    const userId = String(session.client_reference_id || metadata.user_id || '').trim();
    const country = String(metadata.country || 'US');
    if (userId) {
      await grantProFromCheckout(
        userId,
        country,
        String(session.customer || ''),
        String(session.subscription || ''),
      );
    }
  }

  return NextResponse.json({ received: true });
}
