import sql from '@/lib/db';
import { isAdminEmail } from '@/lib/admin';
import { isLifetimeProEmail, isLifetimeProGithub } from '@/lib/lifetime-access';
import { rateLimit } from '@/lib/rate-limit';
import { COPILOT_FREE_LIMIT, COPILOT_FREE_WINDOW_MS, resolvePlanForCountry } from './plans';
import { ensureBillingSchema } from './schema';
import type { ClaimRow } from './claims';

export async function getSubscriptionRow(userId: string | number) {
  await ensureBillingSchema(sql);
  const rows = await sql`
    SELECT user_id, status, plan, country_code, currency, amount_minor, current_period_end
    FROM user_subscriptions
    WHERE user_id = ${String(userId)}
    LIMIT 1
  `;
  return rows[0] || null;
}

/** Latest UPI claim for a user — drives "already submitted" UI instead of re-asking for payment. */
export async function getLatestUpiClaim(userId: string | number): Promise<ClaimRow | null> {
  await ensureBillingSchema(sql);
  const rows = await sql`
    SELECT id, user_id, status, utr, created_at, reviewed_at
    FROM upi_payment_claims
    WHERE user_id = ${String(userId)}
    ORDER BY
      CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      created_at DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: String(row.user_id),
    status: String(row.status),
    utr: String(row.utr),
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export async function getClaimByUtr(utr: string): Promise<ClaimRow | null> {
  await ensureBillingSchema(sql);
  const rows = await sql`
    SELECT id, user_id, status, utr, created_at FROM upi_payment_claims
    WHERE utr = ${utr} LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    userId: String(row.user_id),
    status: String(row.status),
    utr: String(row.utr),
    createdAt: row.created_at,
  };
}

async function getStoredGithubLogin(userId: string | number): Promise<string | null> {
  try {
    const rows = await sql`
      SELECT github_login FROM users WHERE id = ${String(userId)} LIMIT 1
    `;
    const login = rows[0]?.github_login;
    return login ? String(login) : null;
  } catch {
    return null;
  }
}

export async function hasProAccess(
  userId: string | number,
  email?: string | null,
  githubLogin?: string | null,
): Promise<boolean> {
  if (email && isAdminEmail(email)) return true;
  if (isLifetimeProEmail(email)) return true;
  if (isLifetimeProGithub(githubLogin)) return true;
  const storedLogin = githubLogin ? null : await getStoredGithubLogin(userId);
  if (isLifetimeProGithub(storedLogin)) return true;
  const row = await getSubscriptionRow(userId);
  if (!row) return false;
  if (row.status !== 'active' && row.status !== 'trialing') return false;
  if (row.current_period_end && new Date(row.current_period_end).getTime() < Date.now()) {
    return false;
  }
  return true;
}

export async function activateProSubscription(opts: {
  userId: string | number;
  countryCode?: string;
  currency?: string;
  amountMinor?: number;
  provider?: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  periodEnd?: Date;
}) {
  await ensureBillingSchema(sql);
  const uid = String(opts.userId);
  const periodEnd = opts.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO user_subscriptions (
      user_id, status, plan, country_code, currency, amount_minor,
      provider, external_customer_id, external_subscription_id, current_period_end, updated_at
    ) VALUES (
      ${uid}, 'active', 'pro_monthly',
      ${opts.countryCode || null}, ${opts.currency || null}, ${opts.amountMinor ?? null},
      ${opts.provider || 'stripe'}, ${opts.externalCustomerId || null},
      ${opts.externalSubscriptionId || null}, ${periodEnd}, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      status = 'active',
      country_code = COALESCE(EXCLUDED.country_code, user_subscriptions.country_code),
      currency = COALESCE(EXCLUDED.currency, user_subscriptions.currency),
      amount_minor = COALESCE(EXCLUDED.amount_minor, user_subscriptions.amount_minor),
      provider = COALESCE(EXCLUDED.provider, user_subscriptions.provider),
      external_customer_id = COALESCE(EXCLUDED.external_customer_id, user_subscriptions.external_customer_id),
      external_subscription_id = COALESCE(EXCLUDED.external_subscription_id, user_subscriptions.external_subscription_id),
      current_period_end = EXCLUDED.current_period_end,
      updated_at = NOW()
  `;
}

/** Free tier: 10 Copilot messages per 2 hours. Pro: 200 / 2hr. */
export async function checkCopilotRateLimit(
  userId: string | number,
  email?: string | null,
  githubLogin?: string | null,
) {
  const pro = await hasProAccess(userId, email, githubLogin);
  const max = pro ? 200 : COPILOT_FREE_LIMIT;
  const key = pro ? `chat:pro:2hr:${userId}` : `chat:free:2hr:${userId}`;
  const result = await rateLimit(key, { windowMs: COPILOT_FREE_WINDOW_MS, max });
  return { ...result, pro, max };
}

export function requireProResponse(priceDisplay?: string) {
  return Response.json(
    {
      error: 'pro_required',
      message: 'Resume Studio is part of Career-Ops Pro.',
      priceDisplay: priceDisplay || '$0.99/month',
      upgrade: true,
    },
    { status: 402 },
  );
}

/** Returns 402 Response when user lacks Pro; null when allowed. */
export async function assertProAccess(
  userId: string | number,
  email?: string | null,
  countryCode?: string | null,
  githubLogin?: string | null,
): Promise<Response | null> {
  if (await hasProAccess(userId, email, githubLogin)) return null;
  const plan = resolvePlanForCountry(countryCode);
  return requireProResponse(`${plan.display}/month`);
}
