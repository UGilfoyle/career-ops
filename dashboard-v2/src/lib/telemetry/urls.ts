import { randomBytes } from 'crypto';

/** Normalize profile links that may omit https:// */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
}

export function isValidDestination(urlStr: string | null | undefined): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    return !blockedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

export function appOrigin(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://careerops.dpdns.org'
  ).replace(/\/$/, '');
}

/**
 * Prefer the request host when local (localhost / 127.0.0.1) so Copy Stealth Link
 * works against `next dev` even if NEXTAUTH_URL points at production.
 */
export function appOriginFromRequest(req: Request): string {
  const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const host = rawHost.split(',')[0]?.trim() || '';
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  if (isLocal) {
    const proto = (req.headers.get('x-forwarded-proto') || 'http').split(',')[0]?.trim() || 'http';
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return appOrigin();
}

export function slugifySegment(raw: string, max = 40): string {
  return (
    String(raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/, '') || 'role'
  );
}

export function buildTrackingSlug(company: string, role: string): string {
  const base = `${slugifySegment(company, 28)}-${slugifySegment(role, 28)}`.replace(/-+$/, '');
  const suffix = randomBytes(2).toString('hex');
  return `${base}-${suffix}`.slice(0, 80);
}
