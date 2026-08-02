import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type postgres from 'postgres';

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += REF_ALPHABET[bytes[i]! % REF_ALPHABET.length];
  }
  return out;
}

function unsubSecret(): string {
  return (
    process.env.NEWSLETTER_UNSUB_SECRET
    || process.env.AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
  );
}

export function appBaseUrl(): string {
  const raw =
    process.env.APP_URL
    || process.env.NEXTAUTH_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || 'https://career-ops.vercel.app';
  return raw.replace(/\/$/, '');
}

export function createUnsubscribeToken(userId: string | number): string {
  const secret = unsubSecret();
  if (!secret) throw new Error('NEWSLETTER_UNSUB_SECRET or AUTH_SECRET required');
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const secret = unsubSecret();
    if (!secret || !token) return null;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    if (!userId || !ts || !sig) return null;
    const ageMs = Date.now() - Number(ts);
    // Tokens valid for 180 days
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 180 * 24 * 60 * 60 * 1000) return null;
    const payload = `${userId}.${ts}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return String(userId);
  } catch {
    return null;
  }
}

export function referralSignupUrl(code: string): string {
  return `${appBaseUrl()}/signup?ref=${encodeURIComponent(code)}`;
}

export function unsubscribeUrl(userId: string | number): string {
  const token = createUnsubscribeToken(userId);
  return `${appBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Idempotent DDL for newsletter + referral columns. */
export async function ensureNewsletterSchema(sql: postgres.Sql): Promise<void> {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN DEFAULT true`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_unsubscribed_at TIMESTAMPTZ`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uidx
    ON users (referral_code)
    WHERE referral_code IS NOT NULL
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_sends (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      kind TEXT NOT NULL DEFAULT 'monthly',
      month_key TEXT NOT NULL,
      UNIQUE (user_id, month_key, kind)
    )
  `;
}

/** Ensure user has a unique referral_code; returns the code. */
export async function ensureUserReferralCode(
  sql: postgres.Sql,
  userId: string | number
): Promise<string> {
  const [row] = await sql`
    SELECT referral_code FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (row?.referral_code) return String(row.referral_code);

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    try {
      const [updated] = await sql`
        UPDATE users
        SET referral_code = ${code}
        WHERE id = ${userId}
          AND (referral_code IS NULL OR referral_code = '')
        RETURNING referral_code
      `;
      if (updated?.referral_code) return String(updated.referral_code);
      const [again] = await sql`SELECT referral_code FROM users WHERE id = ${userId} LIMIT 1`;
      if (again?.referral_code) return String(again.referral_code);
    } catch {
      // unique collision — retry
    }
  }
  throw new Error(`Could not allocate referral_code for user ${userId}`);
}
