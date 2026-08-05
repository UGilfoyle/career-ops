import { createHmac, timingSafeEqual } from 'crypto';
import { appBaseUrl } from '@/lib/newsletter';

function secret(): string {
  return (
    process.env.BILLING_ACCESS_SECRET
    || process.env.AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
  );
}

/** Signed link for post-payment Pro access (email CTA). Valid 7 days. */
export function createProAccessToken(userId: string | number): string {
  const s = secret();
  if (!s) throw new Error('BILLING_ACCESS_SECRET or AUTH_SECRET required');
  const payload = `pro.${userId}.${Date.now()}`;
  const sig = createHmac('sha256', s).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyProAccessToken(token: string): string | null {
  try {
    const s = secret();
    if (!s || !token) return null;
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 4 || parts[0] !== 'pro') return null;
    const [, userId, ts, sig] = parts;
    if (!userId || !ts || !sig) return null;
    const ageMs = Date.now() - Number(ts);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 7 * 24 * 60 * 60 * 1000) return null;
    const payload = `pro.${userId}.${ts}`;
    const expected = createHmac('sha256', s).update(payload).digest('hex').slice(0, 32);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return String(userId);
  } catch {
    return null;
  }
}

export function proAccessUrl(userId: string | number): string {
  const token = createProAccessToken(userId);
  return `${appBaseUrl()}/auth/access?token=${encodeURIComponent(token)}`;
}
