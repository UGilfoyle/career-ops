import { createHmac, timingSafeEqual } from 'crypto';

function secret(): string {
  return (
    process.env.BILLING_ACCESS_SECRET
    || process.env.AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
  );
}

export function createProApproveToken(claimId: string): string {
  const s = secret();
  if (!s) throw new Error('BILLING_ACCESS_SECRET or AUTH_SECRET required');
  const sig = createHmac('sha256', s).update(`upi-approve.${claimId}`).digest('hex').slice(0, 24);
  return sig;
}

export function verifyProApproveToken(claimId: string, token: string): boolean {
  try {
    const expected = createProApproveToken(claimId);
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
