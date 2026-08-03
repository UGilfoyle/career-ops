/**
 * Rate limiting — in-memory fallback + optional Upstash Redis (serverless-safe).
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN on Vercel for shared limits.
 */

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

export type RateLimitResult = {
  ok: boolean;
  retryAfterSec: number;
  remaining: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function pruneExpired(key: string, bucket: Bucket): Bucket {
  if (Date.now() > bucket.resetAt) {
    buckets.delete(key);
    return { count: 0, resetAt: Date.now() };
  }
  return bucket;
}

function memoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key) ?? { count: 0, resetAt: now + config.windowMs };
  bucket = pruneExpired(key, bucket);

  if (bucket.count === 0) {
    bucket.resetAt = now + config.windowMs;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  const remaining = Math.max(0, config.max - bucket.count);

  return {
    ok: bucket.count <= config.max,
    retryAfterSec,
    remaining,
  };
}

function memoryClear(key: string): void {
  buckets.delete(key);
}

async function upstashCommand<T>(command: unknown[]): Promise<T | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: T };
    return data.result ?? null;
  } catch {
    return null;
  }
}

async function redisRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult | null> {
  const windowSec = Math.max(1, Math.ceil(config.windowMs / 1000));
  const redisKey = `rl:${key}`;

  const count = await upstashCommand<number>(["INCR", redisKey]);
  if (count === null) return null;

  if (count === 1) {
    await upstashCommand(["EXPIRE", redisKey, windowSec]);
  }

  const ttl = await upstashCommand<number>(["TTL", redisKey]);
  const retryAfterSec = ttl && ttl > 0 ? ttl : windowSec;
  const remaining = Math.max(0, config.max - count);

  return {
    ok: count <= config.max,
    retryAfterSec,
    remaining,
  };
}

async function redisClear(key: string): Promise<boolean> {
  const deleted = await upstashCommand<number>(["DEL", `rl:${key}`]);
  return deleted !== null;
}

/** Fixed-window rate limit (Redis when configured, else in-memory). */
export async function rateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const redis = await redisRateLimit(key, config);
  if (redis) return redis;
  return memoryRateLimit(key, config);
}

export async function clearRateLimit(key: string): Promise<void> {
  const cleared = await redisClear(key);
  if (!cleared) memoryClear(key);
}

async function peekCount(key: string): Promise<number | null> {
  const redisKey = `rl:${key}`;
  const val = await upstashCommand<string>(["GET", redisKey]);
  if (val !== null) return parseInt(val, 10) || 0;

  const bucket = buckets.get(key);
  if (!bucket) return null;
  if (Date.now() > bucket.resetAt) {
    buckets.delete(key);
    return 0;
  }
  return bucket.count;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "unknown";
}

export async function getClientIpFromHeaders(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
    return h.get("x-real-ip") || h.get("cf-connecting-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Login: IP + email attempt caps before password check. */
export async function checkLoginAttemptLimits(email: string, ip: string): Promise<RateLimitResult> {
  const normalized = normalizeEmail(email);

  const ipLimit = await rateLimit(`login:ip:${ip}`, { windowMs: 60_000, max: 20 });
  if (!ipLimit.ok) return ipLimit;

  const emailLimit = await rateLimit(`login:email:${normalized}`, { windowMs: 60_000, max: 10 });
  if (!emailLimit.ok) return emailLimit;

  const failCount = (await peekCount(`login-fail:email:${normalized}`)) ?? 0;
  if (failCount >= 5) {
    return { ok: false, retryAfterSec: 15 * 60, remaining: 0 };
  }

  return { ok: true, retryAfterSec: 0, remaining: Math.min(ipLimit.remaining, emailLimit.remaining) };
}

export async function recordLoginFailure(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await rateLimit(`login-fail:email:${normalized}`, { windowMs: 15 * 60_000, max: 5 });
}

export async function clearLoginFailures(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await clearRateLimit(`login-fail:email:${normalized}`);
}

/** OTP verify: per-email wrong-code cap. */
export async function checkOtpVerifyLimits(email: string, ip: string): Promise<RateLimitResult> {
  const normalized = normalizeEmail(email);

  const ipLimit = await rateLimit(`verify:ip:${ip}`, { windowMs: 60_000, max: 15 });
  if (!ipLimit.ok) return ipLimit;

  const emailLimit = await rateLimit(`verify:email:${normalized}`, { windowMs: 15 * 60_000, max: 8 });
  return emailLimit;
}

export async function recordOtpFailure(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await rateLimit(`verify-fail:email:${normalized}`, { windowMs: 15 * 60_000, max: 5 });
}

export async function isOtpLockedOut(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const failCount = (await peekCount(`verify-fail:email:${normalized}`)) ?? 0;
  return failCount >= 5;
}

export function formatRetryHint(retryAfterSec: number): string {
  if (retryAfterSec >= 3600) {
    const hours = Math.ceil(retryAfterSec / 3600);
    return `Try again in ~${hours} hour${hours === 1 ? '' : 's'}.`;
  }
  if (retryAfterSec >= 60) {
    const mins = Math.ceil(retryAfterSec / 60);
    return `Try again in ~${mins} minute${mins === 1 ? '' : 's'}.`;
  }
  return `Try again in ${Math.max(1, retryAfterSec)}s.`;
}

export function rateLimitResponse(result: RateLimitResult, message = "Too many requests. Try again later."): Response {
  return Response.json(
    { error: message, retryAfterSec: result.retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    }
  );
}
