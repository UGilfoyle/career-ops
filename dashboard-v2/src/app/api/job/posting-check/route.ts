import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  fetchJobPostingDate,
  formatPostingGateMessage,
  analyzePostingHistory,
} from '@/lib/job-posting-date';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Check posting age/history for any job URL (used by terminal: tailor <url> --deep).
 * GET /api/job/posting-check?url=https://...
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url).searchParams.get('url')?.trim() || '';
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Valid url query param required' }, { status: 400 });
    }

    const enrich = await fetchJobPostingDate(url);
    const analysis = enrich.analysis || analyzePostingHistory(enrich.raw || {});
    const gateMessage = formatPostingGateMessage({
      company: enrich.raw?.company != null ? String(enrich.raw.company) : null,
      title: enrich.raw?.job_title != null ? String(enrich.raw.job_title) : null,
      url,
      analysis,
    });

    return NextResponse.json({
      url,
      company: enrich.raw?.company ?? null,
      title: enrich.raw?.job_title ?? null,
      posted_at: enrich.posted_at,
      posted_confidence: enrich.confidence,
      posted_reason: enrich.reason,
      posting_analysis: analysis,
      posting_gate_message: gateMessage,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'check_failed' }, { status: 500 });
  }
}
