import crypto from 'crypto';

/**
 * GDPR-compliant rotating one-way hash.
 * Raw IP is never persisted. Salt rotates daily (YYYY-MM-DD).
 */
export function getPrivacySafeHash(ip: string, ua: string): string {
  const dailySalt = new Date().toISOString().slice(0, 10);
  const secret = process.env.AUTH_SECRET || 'career-ops-telemetry-salt';

  return crypto
    .createHmac('sha256', secret)
    .update(`${ip}|${ua}|${dailySalt}`)
    .digest('hex')
    .slice(0, 24);
}
