import { kvDel, kvGet, kvSet } from './kv';

export const TRACKING_CACHE_TTL_SEC = 15 * 60; // 15 min — short enough for profile link edits

export type TrackingDestCache = {
  id: number;
  github_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
};

export function trackingCacheKey(slug: string): string {
  return `tel:slug:${String(slug || '').slice(0, 100)}`;
}

export async function getCachedTracking(slug: string): Promise<TrackingDestCache | null> {
  const raw = await kvGet(trackingCacheKey(slug));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TrackingDestCache;
    if (!parsed || typeof parsed.id !== 'number') return null;
    return {
      id: parsed.id,
      github_url: parsed.github_url ?? null,
      linkedin_url: parsed.linkedin_url ?? null,
      portfolio_url: parsed.portfolio_url ?? null,
    };
  } catch {
    return null;
  }
}

export async function setCachedTracking(
  slug: string,
  data: TrackingDestCache,
  ttlSec = TRACKING_CACHE_TTL_SEC
): Promise<void> {
  await kvSet(
    trackingCacheKey(slug),
    JSON.stringify({
      id: data.id,
      github_url: data.github_url ?? null,
      linkedin_url: data.linkedin_url ?? null,
      portfolio_url: data.portfolio_url ?? null,
    }),
    ttlSec
  );
}

export async function invalidateTrackingCache(slug: string): Promise<void> {
  await kvDel(trackingCacheKey(slug));
}
