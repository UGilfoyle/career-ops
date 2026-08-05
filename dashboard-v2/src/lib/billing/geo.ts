import type { NextRequest } from 'next/server';

/** Vercel / Cloudflare country header (ISO 3166-1 alpha-2). */
export function countryFromRequest(req: NextRequest | Request): string {
  const h = req.headers;
  return (
    h.get('x-vercel-ip-country')
    || h.get('cf-ipcountry')
    || h.get('x-country-code')
    || 'US'
  )
    .trim()
    .toUpperCase()
    .slice(0, 2);
}
