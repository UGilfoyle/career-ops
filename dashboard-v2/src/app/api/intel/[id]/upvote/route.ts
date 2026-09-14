import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { ensureInterviewIntelSchema } from '@/lib/ops-schema';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id || session?.user?.email || 'anon';

    const { id } = await params;
    const intelId = Number(id);
    if (!intelId || !Number.isFinite(intelId)) {
      return NextResponse.json({ error: 'Invalid intel ID' }, { status: 400 });
    }

    // Rate limiting: 20 upvotes per minute
    const rlKey = `intel:upvote:${userId}`;
    const rl = await rateLimit(rlKey, { windowMs: 60 * 1000, max: 20 });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await ensureInterviewIntelSchema(sql);

    const [updated] = await sql`
      UPDATE interview_intel
      SET upvotes = upvotes + 1
      WHERE id = ${intelId}
      RETURNING id, upvotes
    `;

    if (!updated) {
      return NextResponse.json({ error: 'Interview intel item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, upvotes: updated.upvotes });
  } catch (error) {
    console.error('Failed to upvote intel:', error);
    return NextResponse.json({ error: 'Failed to upvote' }, { status: 500 });
  }
}
