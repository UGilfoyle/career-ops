import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { ensureFeedbackSchema } from '@/lib/feedback/schema';
import {
  parseFeedbackScore,
  sanitizeFeedbackComment,
  sanitizeFeedbackContext,
} from '@/lib/feedback/validate';

export const dynamic = 'force-dynamic';

/** Current user's feedback (if any). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureFeedbackSchema(sql);
  const rows = await sql`
    SELECT score, comment, context, created_at, updated_at
    FROM product_feedback
    WHERE user_id = ${String(session.user.id)}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ submitted: false });
  }

  return NextResponse.json({
    submitted: true,
    score: Number(row.score),
    comment: row.comment ? String(row.comment) : null,
    context: row.context ? String(row.context) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/** Submit or update product feedback (non-blocking for the rest of the app). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const score = parseFeedbackScore(body.score);
  if (score == null) {
    return NextResponse.json(
      { error: 'Pick a rating from 1 (not helpful) to 5 (love it).' },
      { status: 400 },
    );
  }

  const comment = sanitizeFeedbackComment(body.comment);
  const context = sanitizeFeedbackContext(body.context);

  await ensureFeedbackSchema(sql);
  const uid = String(session.user.id);
  const email = session.user.email;

  const rows = await sql`
    INSERT INTO product_feedback (user_id, user_email, score, comment, context, updated_at)
    VALUES (${uid}, ${email}, ${score}, ${comment}, ${context}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      user_email = EXCLUDED.user_email,
      score = EXCLUDED.score,
      comment = EXCLUDED.comment,
      context = COALESCE(EXCLUDED.context, product_feedback.context),
      updated_at = NOW()
    RETURNING score, comment, context, created_at, updated_at
  `;

  const row = rows[0];
  return NextResponse.json({
    ok: true,
    submitted: true,
    score: Number(row.score),
    comment: row.comment ? String(row.comment) : null,
    context: row.context ? String(row.context) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
