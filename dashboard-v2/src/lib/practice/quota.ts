import sql from '@/lib/db';
import { hasProAccess } from '@/lib/billing/entitlements';
import { PRACTICE_FREE_WINDOW_MS } from '@/lib/billing/plans';
import { ensurePracticeSchema } from './schema';
import { evaluatePracticeQuota, type PracticeQuotaResult } from './quota-math';

export type { PracticeQuotaResult };
export { evaluatePracticeQuota };

/**
 * Free: 1 pack generation per rolling 7 days (counted from practice_packs rows).
 * Pro / lifetime / admin: unlimited.
 */
export async function checkPracticeQuota(
  userId: string | number,
  email?: string | null,
  githubLogin?: string | null,
): Promise<PracticeQuotaResult> {
  const pro = await hasProAccess(userId, email, githubLogin);
  if (pro) {
    return evaluatePracticeQuota({ pro: true, packsInWindow: 0, oldestPackAt: null });
  }

  await ensurePracticeSchema(sql);
  const uid = String(userId);
  const windowStart = new Date(Date.now() - PRACTICE_FREE_WINDOW_MS);

  const rows = await sql`
    SELECT COUNT(*)::int AS c, MIN(created_at) AS oldest
    FROM practice_packs
    WHERE user_id = ${uid}
      AND created_at > ${windowStart}
  `;

  const packsInWindow = Number(rows[0]?.c || 0);
  const oldestRaw = rows[0]?.oldest;
  const oldestPackAt = oldestRaw ? new Date(oldestRaw) : null;

  return evaluatePracticeQuota({
    pro: false,
    packsInWindow,
    oldestPackAt,
  });
}
