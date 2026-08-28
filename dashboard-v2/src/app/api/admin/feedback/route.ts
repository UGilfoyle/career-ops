import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { isAdminEmail } from '@/lib/admin';
import { ensureFeedbackSchema } from '@/lib/feedback/schema';
import { FEEDBACK_SCORE_LABELS } from '@/lib/feedback/validate';

export const dynamic = 'force-dynamic';

/** Admin: product feedback summary + list. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  await ensureFeedbackSchema(sql);

  const minScore = Number(req.nextUrl.searchParams.get('minScore') || 0);
  const maxScore = Number(req.nextUrl.searchParams.get('maxScore') || 0);
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 100)));

  const hasMin = minScore >= 1 && minScore <= 5;
  const hasMax = maxScore >= 1 && maxScore <= 5;

  const summaryRows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(AVG(score), 0)::float AS avg_score,
      COUNT(*) FILTER (WHERE score >= 4)::int AS promoters,
      COUNT(*) FILTER (WHERE score <= 2)::int AS detractors
    FROM product_feedback
  `;

  const distRows = await sql`
    SELECT score, COUNT(*)::int AS c
    FROM product_feedback
    GROUP BY score
    ORDER BY score DESC
  `;

  const distribution: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
  for (const r of distRows) {
    distribution[String(r.score)] = Number(r.c);
  }

  const summary = summaryRows[0] || {};
  const total = Number(summary.total || 0);
  const avgScore = total ? Number(summary.avg_score) : 0;

  const rows = hasMin && hasMax
    ? await sql`
        SELECT id, user_id, user_email, score, comment, context, created_at, updated_at
        FROM product_feedback
        WHERE score >= ${minScore} AND score <= ${maxScore}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `
    : hasMin
      ? await sql`
          SELECT id, user_id, user_email, score, comment, context, created_at, updated_at
          FROM product_feedback
          WHERE score >= ${minScore}
          ORDER BY updated_at DESC
          LIMIT ${limit}
        `
      : hasMax
        ? await sql`
            SELECT id, user_id, user_email, score, comment, context, created_at, updated_at
            FROM product_feedback
            WHERE score <= ${maxScore}
            ORDER BY updated_at DESC
            LIMIT ${limit}
          `
        : await sql`
            SELECT id, user_id, user_email, score, comment, context, created_at, updated_at
            FROM product_feedback
            ORDER BY updated_at DESC
            LIMIT ${limit}
          `;

  return NextResponse.json({
    summary: {
      total,
      avgScore: Math.round(avgScore * 10) / 10,
      promoters: Number(summary.promoters || 0),
      detractors: Number(summary.detractors || 0),
      satisfiedPct: total ? Math.round((Number(summary.promoters || 0) / total) * 100) : 0,
      scoreLabels: FEEDBACK_SCORE_LABELS,
      distribution,
    },
    feedback: rows.map((r) => ({
      id: r.id,
      userId: String(r.user_id),
      userEmail: String(r.user_email),
      score: Number(r.score),
      scoreLabel: FEEDBACK_SCORE_LABELS[Number(r.score)] || String(r.score),
      comment: r.comment ? String(r.comment) : null,
      context: r.context ? String(r.context) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}
