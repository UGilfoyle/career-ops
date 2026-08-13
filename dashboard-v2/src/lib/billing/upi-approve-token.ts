import { createHmac, timingSafeEqual } from 'crypto';

/** Signed UPI approve links expire after 24h so a leaked email is not a permanent grant. */
export const UPI_APPROVE_TTL_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  return (
    process.env.BILLING_ACCESS_SECRET
    || process.env.AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
  );
}

function sign(claimId: string, expMs: number): string {
  const s = secret();
  if (!s) throw new Error('BILLING_ACCESS_SECRET or AUTH_SECRET required');
  return createHmac('sha256', s).update(`upi-approve.${claimId}.${expMs}`).digest('hex').slice(0, 24);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createProApproveToken(claimId: string, nowMs = Date.now()): string {
  const expMs = nowMs + UPI_APPROVE_TTL_MS;
  return `${expMs}.${sign(claimId, expMs)}`;
}

export function verifyProApproveToken(claimId: string, token: string, nowMs = Date.now()): boolean {
  try {
    const raw = String(token || '');
    const dot = raw.indexOf('.');
    if (dot <= 0) return false;
    const expMs = Number(raw.slice(0, dot));
    const sig = raw.slice(dot + 1);
    if (!Number.isFinite(expMs) || !sig || nowMs > expMs) return false;
    return safeEqual(sig, sign(claimId, expMs));
  } catch {
    return false;
  }
}
