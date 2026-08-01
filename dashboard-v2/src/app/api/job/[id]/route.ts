import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';
import {
  ensureJobPostingDateColumns,
  fetchJobPostingDate,
  analyzePostingHistory,
  formatPostingGateMessage,
} from '@/lib/job-posting-date';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Re-check posting date at most once per day when previously unknown. */
const RECHECK_AFTER_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await ctx.params;
    const jobId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(jobId)) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
    }

    const forceRefresh = new URL(req.url).searchParams.get('refresh') === '1';

    try {
      await ensureJobPostingDateColumns(sql);
    } catch {
      // Column ensure is best-effort; SELECT may still work on older schemas via fallback.
    }

    let job: any = null;
    try {
      const rows = await sql`
        SELECT
          id,
          company,
          title,
          url,
          canonical_url,
          source,
          score,
          jd_text,
          created_at,
          posted_at,
          posted_confidence,
          posted_reason,
          posted_checked_at
        FROM jobs
        WHERE id = ${jobId} AND user_id = ${userId}
        LIMIT 1
      `;
      job = rows[0] || null;
    } catch {
      const rows = await sql`
        SELECT
          id,
          company,
          title,
          url,
          source,
          score,
          created_at
        FROM jobs
        WHERE id = ${jobId} AND user_id = ${userId}
        LIMIT 1
      `;
      const row: any = rows[0] || null;
      job = row
        ? {
            ...row,
            canonical_url: row.url,
            jd_text: null,
            posted_at: null,
            posted_confidence: null,
            posted_reason: null,
            posted_checked_at: null,
          }
        : null;
    }
    if (!job) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const jobUrl = String(job.canonical_url || job.url || '');
    const checkedAt = job.posted_checked_at ? new Date(job.posted_checked_at).getTime() : 0;
    // Lazy enrich when missing date, daily retry for unknowns, or explicit refresh (tailor gate)
    const needsEnrich =
      Boolean(jobUrl)
      && (
        forceRefresh
        || !job.posted_at
        || !checkedAt
        || Date.now() - checkedAt > RECHECK_AFTER_MS
      );

    let analysis = null;
    let gateMessage = '';

    if (needsEnrich) {
      const enrich = await fetchJobPostingDate(jobUrl);
      const now = new Date();
      analysis = enrich.analysis || analyzePostingHistory(enrich.raw || {});
      gateMessage = formatPostingGateMessage({
        company: job.company,
        title: job.title,
        url: jobUrl,
        analysis,
      });
      try {
        await sql`
          UPDATE jobs
          SET
            posted_at = ${enrich.posted_at},
            posted_confidence = ${enrich.confidence},
            posted_reason = ${enrich.reason},
            posted_checked_at = ${now.toISOString()}
          WHERE id = ${jobId} AND user_id = ${userId}
        `;
        job.posted_at = enrich.posted_at;
        job.posted_confidence = enrich.confidence;
        job.posted_reason = enrich.reason;
        job.posted_checked_at = now.toISOString();
      } catch {
        job.posted_at = enrich.posted_at ?? job.posted_at;
        job.posted_confidence = enrich.confidence ?? job.posted_confidence;
        job.posted_reason = enrich.reason ?? job.posted_reason;
        job.posted_checked_at = now.toISOString();
      }
    } else if (job.posted_at) {
      analysis = analyzePostingHistory({
        most_probable_date: job.posted_at,
        confidence: job.posted_confidence,
        reason: job.posted_reason,
      });
      gateMessage = formatPostingGateMessage({
        company: job.company,
        title: job.title,
        url: jobUrl,
        analysis,
      });
    }

    return NextResponse.json({
      id: job.id,
      company: job.company,
      title: job.title,
      url: job.canonical_url || job.url,
      source: job.source,
      score: job.score,
      jd_text: job.jd_text || null,
      created_at: job.created_at,
      updated_at: job.created_at,
      posted_at: job.posted_at || null,
      posted_confidence: job.posted_confidence || null,
      posted_reason: job.posted_reason || null,
      posted_checked_at: job.posted_checked_at || null,
      posting_analysis: analysis,
      posting_gate_message: gateMessage,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
