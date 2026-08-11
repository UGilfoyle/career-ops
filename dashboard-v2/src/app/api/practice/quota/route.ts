import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { assertPracticeBetaAccess, checkPracticeQuota } from '@/lib/practice';
import { PRACTICE_FREE_LIMIT, PRACTICE_FREE_WINDOW_MS } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const betaBlock = assertPracticeBetaAccess(session.user.email);
    if (betaBlock) return betaBlock;
    const quota = await checkPracticeQuota(
      session.user.id,
      session.user.email,
      session.user.githubLogin,
    );

    return NextResponse.json({
      ok: true,
      allowed: quota.allowed,
      remaining: quota.remaining,
      resetAt: quota.resetAt?.toISOString() || null,
      pro: quota.pro,
      freeLimit: PRACTICE_FREE_LIMIT,
      windowMs: PRACTICE_FREE_WINDOW_MS,
      usedInWindow: quota.usedInWindow,
      banner: quota.pro
        ? 'Pro · unlimited practice packs'
        : quota.remaining > 0
          ? '1 JD practice pack / week · Pro unlocks unlimited'
          : '0 free packs left this week · Pro unlocks unlimited',
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to load practice quota';
    console.error('practice/quota error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
