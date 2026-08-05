import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { countryFromRequest } from '@/lib/billing/geo';
import { hasProAccess, getSubscriptionRow, checkCopilotRateLimit } from '@/lib/billing/entitlements';
import { resolvePlanForCountry, planSubtitle, COPILOT_FREE_LIMIT } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const email = session.user.email;
  const country = countryFromRequest(req);
  const plan = resolvePlanForCountry(country);
  const pro = await hasProAccess(userId, email);
  const sub = await getSubscriptionRow(userId);
  const copilot = await checkCopilotRateLimit(userId, email);

  return NextResponse.json({
    hasPro: pro,
    country,
    plan: {
      display: plan.display,
      currency: plan.currency,
      subtitle: planSubtitle(plan),
    },
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
        }
      : null,
    copilot: {
      limit: pro ? copilot.max : COPILOT_FREE_LIMIT,
      remaining: copilot.remaining,
      windowHours: 2,
      pro,
    },
  });
}
