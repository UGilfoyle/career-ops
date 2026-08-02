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
          j.id,
          j.company,
          j.title,
          j.url,
          j.canonical_url,
          j.source,
          j.score,
          j.jd_text,
          j.created_at,
          j.posted_at,
          j.posted_confidence,
          j.posted_reason,
          j.posted_checked_at,
          j.ats_content_score,
          (j.resume_html IS NOT NULL) AS has_resume_html,
          (j.resume_pdf_key IS NOT NULL OR j.resume_pdf IS NOT NULL) AS has_resume_pdf,
          a.id AS app_id,
          a.status AS application_status,
          a.applied_at,
          (a.id IS NOT NULL) AS is_applied
        FROM jobs j
        LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = ${userId}
        WHERE j.id = ${jobId} AND j.user_id = ${userId}
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
      app_id: job.app_id ?? null,
      application_status: job.application_status ?? null,
      applied_at: job.applied_at ?? null,
      is_applied: Boolean(job.is_applied ?? job.app_id),
      has_resume_html: Boolean(job.has_resume_html),
      has_resume_pdf: Boolean(job.has_resume_pdf),
      ats_content_score: job.ats_content_score ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
