import {
  PRACTICE_FREE_LIMIT,
  PRACTICE_FREE_WINDOW_MS,
} from '@/lib/billing/plans';

export type PracticeQuotaResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
  pro: boolean;
  usedInWindow: number;
  freeLimit: number;
  windowMs: number;
};

/** Pure quota math — unit-tested without DB. */
export function evaluatePracticeQuota(opts: {
  pro: boolean;
  packsInWindow: number;
  oldestPackAt: Date | null;
  now?: Date;
  freeLimit?: number;
  windowMs?: number;
}): PracticeQuotaResult {
  const freeLimit = opts.freeLimit ?? PRACTICE_FREE_LIMIT;
  const windowMs = opts.windowMs ?? PRACTICE_FREE_WINDOW_MS;
  const now = opts.now ?? new Date();
  const used = Math.max(0, opts.packsInWindow);

  if (opts.pro) {
    return {
      allowed: true,
      remaining: -1,
      resetAt: null,
      pro: true,
      usedInWindow: used,
      freeLimit,
      windowMs,
    };
  }

  const remaining = Math.max(0, freeLimit - used);
  const allowed = used < freeLimit;
  let resetAt: Date | null = null;
  if (!allowed && opts.oldestPackAt) {
    resetAt = new Date(opts.oldestPackAt.getTime() + windowMs);
    if (resetAt.getTime() <= now.getTime()) {
      return {
        allowed: true,
        remaining: freeLimit,
        resetAt: null,
        pro: false,
        usedInWindow: 0,
        freeLimit,
        windowMs,
      };
    }
  }

  return {
    allowed,
    remaining,
    resetAt,
    pro: false,
    usedInWindow: used,
    freeLimit,
    windowMs,
  };
}
