/**
 * Soft-fail Upstash Redis REST helpers for telemetry caching.
 * Same env as rate-limit: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 * Missing/failed Redis → null/false (callers fall back to Neon).
 */

async function upstashCommand<T>(command: unknown[]): Promise<T | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: T };
    return (data.result ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function kvGet(key: string): Promise<string | null> {
  const result = await upstashCommand<string | null>(['GET', key]);
  return result == null ? null : String(result);
}

export async function kvSet(key: string, value: string, ttlSec: number): Promise<boolean> {
  const ttl = Math.max(1, Math.floor(ttlSec));
  const result = await upstashCommand<string>(['SET', key, value, 'EX', ttl]);
  return result === 'OK';
}

export async function kvDel(key: string): Promise<boolean> {
  const result = await upstashCommand<number>(['DEL', key]);
  return result !== null;
}
