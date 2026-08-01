/**
 * job-posting-gate.mjs — Check posting age/history before resume generation.
 * Uses WhenThisJobWasPosted REST API (wayback + ATS sources for repost signals).
 */

import readline from 'node:readline';

export const STALE_POSTING_DAYS = 90; // 3 months — Yes/No before tailor
export const ANCIENT_POSTING_DAYS = 365;
export const REPOST_GAP_DAYS = 60;

const CHECK_URL = 'https://mcp.whenthisjobwasposted.com/api/v1/check';
const DEFAULT_TIMEOUT_MS = 120_000;

function parseDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  // ATS source object: { name, date }
  if (typeof value === 'object' && value.date) return parseDate(value.date);
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}

export function daysSincePosted(postedAt, now = new Date()) {
  const then = parseDate(postedAt);
  if (!then) return null;
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function pickBestDate(data) {
  const candidates = [
    data.posted_date,
    data.most_probable_date,
    data.date,
    data.sources?.ats_api,
    data.sources?.json_ld,
    data.sources?.open_graph,
    data.sources?.regex,
  ];
  for (const c of candidates) {
    const d = parseDate(c);
    if (d) return d.toISOString();
  }
  return null;
}

function collectSourceDates(sources = {}) {
  const out = {};
  for (const [key, val] of Object.entries(sources || {})) {
    const d = parseDate(val);
    if (d) out[key] = d.toISOString();
  }
  return out;
}

function oldestIso(isos) {
  let best = null;
  for (const iso of isos) {
    const d = parseDate(iso);
    if (!d) continue;
    if (!best || d < parseDate(best)) best = d.toISOString();
  }
  return best;
}

/**
 * Analyze API payload → age + possible repost (wayback/first-seen older than advertised).
 */
export function analyzePostingHistory(raw = {}, now = new Date()) {
  const sources = collectSourceDates(raw.sources || {});
  const postedAt = pickBestDate(raw);
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
  const gapDays =
    firstSeen && postedAt
      ? Math.floor((parseDate(postedAt).getTime() - parseDate(firstSeen).getTime()) / (1000 * 60 * 60 * 24))
      : null;

  const possibleRepost =
    gapDays != null
    && gapDays >= REPOST_GAP_DAYS
    && firstSeenDays != null
    && firstSeenDays >= STALE_POSTING_DAYS;

  const ancient = ageDays != null && ageDays >= ANCIENT_POSTING_DAYS;
  const stale = ageDays != null && ageDays >= STALE_POSTING_DAYS;
  const historyOld = firstSeenDays != null && firstSeenDays >= STALE_POSTING_DAYS;
  const repostWithinYear =
    possibleRepost
    && firstSeenDays != null
    && firstSeenDays <= ANCIENT_POSTING_DAYS;
  const unknown = postedAt == null;
  // Unknown date = confirm too (MCP/REST couldn't read age — don't silently tailor)
  const needsConfirm = Boolean(
    stale || ancient || historyOld || repostWithinYear || possibleRepost || unknown,
  );

  let severity = 'fresh';
  if (ancient || (possibleRepost && (firstSeenDays ?? 0) >= ANCIENT_POSTING_DAYS)) severity = 'ancient';
  else if (possibleRepost || repostWithinYear) severity = 'repost';
  else if (stale || historyOld) severity = 'stale';
  else if (unknown) severity = 'unknown';

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
    reason: raw.reason != null
      ? String(raw.reason)
      : (raw.explanation != null ? String(raw.explanation) : null),
    sources,
    company: raw.company != null ? String(raw.company) : null,
    job_title: raw.job_title != null ? String(raw.job_title) : null,
  };
}

export async function fetchJobPostingHistory(jobUrl, opts = {}) {
  const url = String(jobUrl || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return {
      posted_at: null,
      confidence: null,
      reason: 'invalid_url',
      analysis: analyzePostingHistory({}),
      raw: null,
    };
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const attempt = async () => {
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
          raw: null,
        };
      }
      const data = await res.json();
      const analysis = analyzePostingHistory(data);
      return {
        posted_at: analysis.posted_at,
        confidence: analysis.confidence,
        reason: analysis.reason,
        analysis,
        raw: data,
      };
    } catch (err) {
      const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message || 'fetch_failed');
      return {
        posted_at: null,
        confidence: null,
        reason: msg,
        analysis: analyzePostingHistory({}),
        raw: null,
      };
    } finally {
      clearTimeout(timer);
    }
  };

  let result = await attempt();
  // One retry when MCP/REST network flakes (common on Actions runners)
  if (!result.posted_at && /fetch_failed|timeout|http_5\d\d/i.test(String(result.reason || ''))) {
    await new Promise((r) => setTimeout(r, 1500));
    result = await attempt();
  }
  return result;
}

function fmtDay(iso) {
  if (!iso) return 'unknown';
  const d = parseDate(iso);
  if (!d) return 'unknown';
  return d.toISOString().slice(0, 10);
}

function ageLabel(days) {
  if (days == null) return 'unknown age';
  if (days >= ANCIENT_POSTING_DAYS) {
    const years = (days / 365).toFixed(1).replace(/\.0$/, '');
    return `${days} days (~${years} year${Number(years) === 1 ? '' : 's'})`;
  }
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Human-readable terminal / log block for the posting check.
 */
export function formatPostingGateMessage({
  company,
  title,
  url,
  analysis,
  reason,
} = {}) {
  const a = analysis || analyzePostingHistory({});
  const lines = [
    '═══════════════════════════════════════════',
    '📅 JOB POSTING CHECK (before resume)',
    '═══════════════════════════════════════════',
    `Company: ${company || a.company || '—'}`,
    `Role:    ${title || a.job_title || '—'}`,
    `URL:     ${url || '—'}`,
    `Posted:  ${fmtDay(a.posted_at)} (${ageLabel(a.age_days)})`,
  ];
  if (a.first_seen_at && a.first_seen_at !== a.posted_at) {
    lines.push(`First seen (history): ${fmtDay(a.first_seen_at)} (${ageLabel(a.first_seen_days)})`);
  }
  if (a.updated_at) {
    lines.push(`Updated signal:       ${fmtDay(a.updated_at)}`);
  }
  if (a.confidence) lines.push(`Confidence: ${a.confidence}`);
  if (a.reason || reason) lines.push(`Reason: ${(a.reason || reason || '').slice(0, 200)}`);

  if (a.severity === 'ancient') {
    lines.push('⚠ This posting looks ~1 year old (or older). Applying may waste time.');
  } else if (a.possible_repost) {
    lines.push(
      `⚠ Possible REPOST: history is ${ageLabel(a.first_seen_days)} old,`
      + ` advertised date is newer (gap ${a.repost_gap_days} days).`,
    );
  } else if (a.stale) {
    lines.push(`⚠ Posting is ${STALE_POSTING_DAYS}+ days old (~3 months).`);
  } else if (a.severity === 'unknown') {
    lines.push('⚠ Could not determine posting date (MCP/API failed or no date). Confirm before resume.');
  } else {
    lines.push('✓ Posting looks relatively fresh.');
  }

  if (a.needs_confirm) {
    lines.push('Generate resume & cover letter anyway? Type Yes or No.');
  }
  lines.push('═══════════════════════════════════════════');
  return lines.join('\n');
}

async function promptYesNo(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await new Promise((resolve) => {
      rl.question(question, resolve);
    });
    return /^(y|yes)$/i.test(String(answer || '').trim());
  } finally {
    rl.close();
  }
}

/**
 * Gate resume generation on posting age/history.
 * Returns { ok, analysis, message, confirmed }.
 * - Always prints the check message.
 * - If needs_confirm: TTY → Yes/No; non-TTY → require --yes / CAREER_OPS_CONFIRM_STALE=1.
 */
export async function gateResumeOnPostingAge({
  url,
  company,
  title,
  forceYes = false,
  skip = false,
  log = console.log,
} = {}) {
  if (skip || process.env.CAREER_OPS_SKIP_POSTING_GATE === '1') {
    return { ok: true, skipped: true, analysis: null, message: '', confirmed: false };
  }

  const result = await fetchJobPostingHistory(url);
  const analysis = result.analysis;
  const message = formatPostingGateMessage({
    company,
    title,
    url,
    analysis,
    reason: result.reason,
  });
  log(message);

  if (!analysis.needs_confirm) {
    return { ok: true, analysis, message, confirmed: false, skipped: false };
  }

  const autoYes =
    forceYes
    || process.env.CAREER_OPS_CONFIRM_STALE === '1'
    || process.env.CAREER_OPS_CONFIRM_STALE === 'true';

  if (autoYes) {
    log('✓ User confirmed earlier (dashboard/--yes). Continuing tailor…');
    return { ok: true, analysis, message, confirmed: true, skipped: false };
  }

  if (process.stdin.isTTY && process.stdout.isTTY) {
    const yes = await promptYesNo('Continue with resume generation? [Yes/No]: ');
    if (!yes) {
      log('✗ Stopped — user chose No. No resume generated.');
      return { ok: false, analysis, message, confirmed: false, skipped: false };
    }
    log('✓ User chose Yes. Continuing tailor…');
    return { ok: true, analysis, message, confirmed: true, skipped: false };
  }

  log(
    '✗ Stale/old posting — confirmation required.\n'
    + '  Dashboard: click Yes on the posting-age dialog, or re-run with --yes\n'
    + '  CLI:       node agentic-tailor.mjs <url> --yes',
  );
  return { ok: false, analysis, message, confirmed: false, skipped: false };
}

export function argvHasYes(argv = process.argv) {
  return argv.some((a) => a === '--yes' || a === '-y' || a === '--confirm-stale');
}
