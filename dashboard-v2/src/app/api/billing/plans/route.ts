import { NextRequest, NextResponse } from 'next/server';
import { countryFromRequest } from '@/lib/billing/geo';
import { resolvePlanForCountry, planSubtitle } from '@/lib/billing/plans';
import { upiConfigFromEnv } from '@/lib/billing/upi';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const country = countryFromRequest(req);
  const plan = resolvePlanForCountry(country);
  return NextResponse.json({
    country,
    display: plan.display,
    currency: plan.currency,
    subtitle: planSubtitle(plan),
    providers: {
      upi: Boolean(upiConfigFromEnv()),
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    },
  });
}
