/**
 * WhenThisJobWasPosted — REST client for real job posting dates + history.
 * Docs: https://whenthisjobwasposted.com/connect.md
 * Endpoint: GET https://mcp.whenthisjobwasposted.com/api/v1/check?url=...
 */

export type JobPostingSources = {
  wayback?: string | null;
  sitemap?: string | null;
  json_ld?: string | null;
  open_graph?: string | null;
  regex?: string | null;
  updated?: string | null;
  ats_api?: string | null;
};

export type JobPostingAnalysis = {
  posted_at: string | null;
  first_seen_at: string | null;
  updated_at: string | null;
  age_days: number | null;
  first_seen_days: number | null;
  repost_gap_days: number | null;
  possible_repost: boolean;
  ancient: boolean;
  stale: boolean;
  needs_confirm: boolean;
  severity: 'fresh' | 'stale' | 'repost' | 'ancient' | 'unknown';
  confidence: string | null;
  reason: string | null;
  sources: Record<string, string>;
};

export type JobPostingDateResult = {
  posted_at: string | null;
  confidence: string | null;
  reason: string | null;
  analysis?: JobPostingAnalysis;
  raw?: Record<string, unknown>;
};

/** Days after which tailor prompts before generating resume/cover. */
export const STALE_POSTING_DAYS = 30;
export const ANCIENT_POSTING_DAYS = 365;
export const REPOST_GAP_DAYS = 60;

const CHECK_URL = 'https://mcp.whenthisjobwasposted.com/api/v1/check';
const DEFAULT_TIMEOUT_MS = 120_000;

function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === 'object' && value !== null && 'date' in value) {
    return parseDate((value as { date?: unknown }).date);
  }
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Whole days since posting (floor). Null when date is missing/invalid.
 */
export function daysSincePosted(
  postedAt: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  const then = parseDate(postedAt ?? null);
  if (!then) return null;
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
  const sources = (data.sources || {}) as Record<string, unknown>;
  const candidates = [
    data.posted_date,
    data.most_probable_date,
    data.date,
    sources.ats_api,
    sources.json_ld,
    sources.open_graph,
    sources.regex,
  ];
  for (const c of candidates) {
    const d = parseDate(c);
    if (d) return d.toISOString();
  }
  return null;
}

function collectSourceDates(sources: Record<string, unknown> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(sources)) {
    const d = parseDate(val);
    if (d) out[key] = d.toISOString();
  }
  return out;
}

function oldestIso(isos: Array<string | null | undefined>): string | null {
  let best: Date | null = null;
  for (const iso of isos) {
    const d = parseDate(iso ?? null);
    if (!d) continue;
    if (!best || d < best) best = d;
  }
  return best ? best.toISOString() : null;
}

export function analyzePostingHistory(
  raw: Record<string, unknown> = {},
  now: Date = new Date(),
): JobPostingAnalysis {
  const sources = collectSourceDates((raw.sources || {}) as Record<string, unknown>);
  const postedAt = pickDate(raw);
  const firstSeen = oldestIso([
    sources.wayback,
    sources.sitemap,
    sources.json_ld,
    sources.open_graph,
    sources.regex,
    sources.ats_api,
    postedAt,
  ]);
  const updatedAt = sources.updated || null;
  const ageDays = daysSincePosted(postedAt, now);
  const firstSeenDays = daysSincePosted(firstSeen, now);
  const postedD = parseDate(postedAt);
  const firstD = parseDate(firstSeen);
  const gapDays =
    postedD && firstD
      ? Math.floor((postedD.getTime() - firstD.getTime()) / (1000 * 60 * 60 * 24))
      : null;

  const possibleRepost =
    gapDays != null
    && gapDays >= REPOST_GAP_DAYS
    && firstSeenDays != null
    && firstSeenDays >= STALE_POSTING_DAYS;

  const ancient = ageDays != null && ageDays >= ANCIENT_POSTING_DAYS;
  const stale = ageDays != null && ageDays >= STALE_POSTING_DAYS;
  const needsConfirm = Boolean(stale || ancient || possibleRepost);

  let severity: JobPostingAnalysis['severity'] = 'fresh';
  if (ancient || (possibleRepost && (firstSeenDays ?? 0) >= ANCIENT_POSTING_DAYS)) severity = 'ancient';
  else if (possibleRepost) severity = 'repost';
  else if (stale) severity = 'stale';
  else if (postedAt == null) severity = 'unknown';

  return {
    posted_at: postedAt,
    first_seen_at: firstSeen,
    updated_at: updatedAt,
    age_days: ageDays,
    first_seen_days: firstSeenDays,
    repost_gap_days: gapDays,
    possible_repost: possibleRepost,
    ancient,
    stale,
    needs_confirm: needsConfirm,
    severity,
    confidence: raw.confidence != null ? String(raw.confidence) : null,
    reason:
      raw.reason != null
        ? String(raw.reason)
        : raw.explanation != null
          ? String(raw.explanation)
          : null,
    sources,
  };
}

export function formatPostingGateMessage(opts: {
  company?: string | null;
  title?: string | null;
  url?: string | null;
  analysis: JobPostingAnalysis;
}): string {
  const a = opts.analysis;
  const fmt = (iso: string | null) => (iso ? iso.slice(0, 10) : 'unknown');
  const ageLabel = (days: number | null) => {
    if (days == null) return 'unknown age';
    if (days >= ANCIENT_POSTING_DAYS) {
      const years = (days / 365).toFixed(1).replace(/\.0$/, '');
      return `${days} days (~${years} year${Number(years) === 1 ? '' : 's'})`;
    }
    return `${days} day${days === 1 ? '' : 's'}`;
  };

  const lines = [
    '═══════════════════════════════════════════',
    '📅 JOB POSTING CHECK (before resume)',
    '═══════════════════════════════════════════',
    `Company: ${opts.company || '—'}`,
    `Role:    ${opts.title || '—'}`,
    `URL:     ${opts.url || '—'}`,
    `Posted:  ${fmt(a.posted_at)} (${ageLabel(a.age_days)})`,
  ];
  if (a.first_seen_at && a.first_seen_at !== a.posted_at) {
    lines.push(`First seen (history): ${fmt(a.first_seen_at)} (${ageLabel(a.first_seen_days)})`);
  }
  if (a.updated_at) lines.push(`Updated signal:       ${fmt(a.updated_at)}`);
  if (a.confidence) lines.push(`Confidence: ${a.confidence}`);
  if (a.reason) lines.push(`Reason: ${a.reason.slice(0, 200)}`);

  if (a.severity === 'ancient') {
    lines.push('⚠ This posting looks ~1 year old (or older). Applying may waste time.');
  } else if (a.possible_repost) {
    lines.push(
      `⚠ Possible REPOST: history is ${ageLabel(a.first_seen_days)} old, advertised date is newer (gap ${a.repost_gap_days} days).`,
    );
  } else if (a.stale) {
    lines.push(`⚠ Posting is ${STALE_POSTING_DAYS}+ days old.`);
  } else if (a.severity === 'unknown') {
    lines.push('ℹ Could not determine posting date — proceed with caution.');
  } else {
    lines.push('✓ Posting looks relatively fresh.');
  }
  if (a.needs_confirm) {
    lines.push('Generate resume & cover letter anyway? Choose Yes or No.');
  }
  lines.push('═══════════════════════════════════════════');
  return lines.join('\n');
}

/**
 * Fetch posting date + history for a job URL. Never throws — returns nulls on failure.
 */
export async function fetchJobPostingDate(
  jobUrl: string,
  opts: { timeoutMs?: number } = {},
): Promise<JobPostingDateResult> {
  const url = String(jobUrl || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return {
      posted_at: null,
      confidence: null,
      reason: 'invalid_url',
      analysis: analyzePostingHistory({}),
    };
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
        analysis: analyzePostingHistory({}),
      };
    }
    const data = (await res.json()) as Record<string, unknown>;
    const analysis = analyzePostingHistory(data);
    return {
      posted_at: analysis.posted_at,
      confidence: analysis.confidence,
      reason: analysis.reason,
      analysis,
      raw: data,
    };
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'fetch_failed');
    return {
      posted_at: null,
      confidence: null,
      reason: msg,
      analysis: analyzePostingHistory({}),
    };
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
