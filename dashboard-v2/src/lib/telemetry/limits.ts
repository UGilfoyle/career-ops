import { rateLimit } from '@/lib/rate-limit';

/** Soft limits — over quota still serves UX; callers skip telemetry writes. */
export const TELEMETRY_REDIRECT_LIMIT = { windowMs: 60_000, max: 60 } as const;
export const TELEMETRY_BEACON_LIMIT = { windowMs: 60_000, max: 30 } as const;

export async function allowTelemetryRedirectLog(ip: string): Promise<boolean> {
  const result = await rateLimit(`tel:redir:${ip || 'unknown'}`, TELEMETRY_REDIRECT_LIMIT);
  return result.ok;
}

export async function allowTelemetryBeaconLog(ip: string): Promise<boolean> {
  const result = await rateLimit(`tel:beacon:${ip || 'unknown'}`, TELEMETRY_BEACON_LIMIT);
  return result.ok;
}
