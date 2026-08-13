import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { formatRetryHint, rateLimit, rateLimitResponse } from '@/lib/rate-limit';
import {
  assertPracticeBetaAccess,
  executePracticeRun,
  validatePracticeRunInput,
} from '@/lib/practice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 35;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const betaBlock = assertPracticeBetaAccess(session.user.email);
    if (betaBlock) return betaBlock;

    const userId = String(session.user.id);
    const burst = await rateLimit(`practice-run-burst:${userId}`, { windowMs: 60_000, max: 8 });
    if (!burst.ok) {
      return rateLimitResponse(burst, `Practice runner limit reached. ${formatRetryHint(burst.retryAfterSec)}`);
    }
    const hourly = await rateLimit(`practice-run:${userId}`, { windowMs: 60 * 60_000, max: 40 });
    if (!hourly.ok) {
      return rateLimitResponse(hourly, `Practice runner hourly limit reached. ${formatRetryHint(hourly.retryAfterSec)}`);
    }

    const body = await req.json().catch(() => ({}));
    const validated = validatePracticeRunInput(body);
    if (!validated.ok) {
      return NextResponse.json({ error: 'invalid_input', message: validated.error }, { status: 400 });
    }

    const result = await executePracticeRun(validated.req);

    if (result.status === 'misconfigured') {
      return NextResponse.json(
        {
          error: 'runner_misconfigured',
          message: result.error,
          result,
        },
        { status: 503 },
      );
    }
    if (result.status === 'rate_limited') {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: result.error || 'Runner is rate-limited. Try again in a moment.',
          result,
        },
        { status: 429 },
      );
    }
    if (result.status === 'network_error' || result.status === 'http_error') {
      return NextResponse.json(
        {
          error: 'runner_unavailable',
          message: result.error || 'Code runner unavailable.',
          result,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to run code';
    console.error('practice/run error:', e);
    return NextResponse.json({ error: 'run_failed', message }, { status: 500 });
  }
}
