/**
 * WhenThisJobWasPosted — REST client for real job posting dates.
 * Docs: https://whenthisjobwasposted.com/connect.md
 * Endpoint: GET https://mcp.whenthisjobwasposted.com/api/v1/check?url=...
 */

export type JobPostingDateResult = {
  posted_at: string | null;
  confidence: string | null;
  reason: string | null;
  raw?: Record<string, unknown>;
};

/** Days after which tailor prompts before generating resume/cover. */
export const STALE_POSTING_DAYS = 30;

const CHECK_URL = 'https://mcp.whenthisjobwasposted.com/api/v1/check';
const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Whole days since posting (floor). Null when date is missing/invalid.
 */
export function daysSincePosted(
  postedAt: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (postedAt == null || postedAt === '') return null;
  const then = postedAt instanceof Date ? postedAt : new Date(postedAt);
  if (!Number.isFinite(then.getTime())) return null;
  const ms = now.getTime() - then.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** True when posting age is known and >= threshold (default 30 days). */
export function isStalePosting(
  postedAt: string | Date | null | undefined,
  thresholdDays: number = STALE_POSTING_DAYS,
  now: Date = new Date(),
): boolean {
  const days = daysSincePosted(postedAt, now);
  return days != null && days >= thresholdDays;
}

function pickDate(data: Record<string, unknown>): string | null {
  const candidates = [data.posted_date, data.most_probable_date, data.date];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      const d = new Date(c);
      if (Number.isFinite(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

/**
 * Fetch posting date for a job URL. Never throws — returns nulls on failure.
 */
export async function fetchJobPostingDate(
  jobUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<JobPostingDateResult> {
  const url = String(jobUrl || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return { posted_at: null, confidence: null, reason: 'invalid_url' };
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = new URL(CHECK_URL);
    endpoint.searchParams.set('url', url);
    const res = await fetch(endpoint.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        posted_at: null,
        confidence: null,
        reason: `http_${res.status}`,
      };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      posted_at: pickDate(data),
      confidence: data.confidence != null ? String(data.confidence) : null,
      reason: data.reason != null ? String(data.reason) : (data.explanation != null ? String(data.explanation) : null),
      raw: data,
    };
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'fetch_failed');
    return { posted_at: null, confidence: null, reason: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Ensure posting-date columns exist (idempotent). */
export async function ensureJobPostingDateColumns(sql: any) {
  await sql`
    ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS posted_confidence TEXT,
      ADD COLUMN IF NOT EXISTS posted_reason TEXT,
      ADD COLUMN IF NOT EXISTS posted_checked_at TIMESTAMPTZ
  `;
}
