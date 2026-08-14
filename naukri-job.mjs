/**
 * naukri-job.mjs — Naukri JD extract without "Similar jobs" pollution.
 * Desktop listing pages are Akamai-gated; Jina reader usually returns the real JD.
 */

const NAUKRI_HOST_RE = /(^|\.)naukri\.com$/i;

const CHROME_CUT_RE =
  /\n\s*#{0,6}\s*(?:Similar jobs|Jobs you might be interested|Beware of imposters|Salary insights|Resume Display|About company|Register to unlock)\b/i;

export function isNaukriUrl(url) {
  try {
    return NAUKRI_HOST_RE.test(new URL(String(url).trim()).hostname);
  } catch {
    return /naukri\.com/i.test(String(url || ''));
  }
}

export function canonicalNaukriUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw.startsWith('//') ? `https:${raw}` : raw.includes('://') ? raw : `https://${raw}`);
    u.hash = '';
    u.search = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return raw.split('?')[0];
  }
}

/** Drop Naukri widgets that leak other companies' stacks (Python fullstack, Nest, etc.). */
export function stripNaukriChrome(text) {
  let t = String(text || '').replace(/\r/g, '');
  const cut = t.search(CHROME_CUT_RE);
  if (cut > 80) t = t.slice(0, cut);
  const start = t.search(/Job description|Roles and Responsibilities|Job Requirements/i);
  if (start > 0 && start < t.length / 2) t = t.slice(start);
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

export function looksLikeNaukriPollution(text) {
  return /\b(similar jobs|jobs you might be interested)\b/i.test(String(text || ''));
}

export function naukriManualJdHint(url) {
  const canonical = canonicalNaukriUrl(url);
  return (
    'Naukri blocked a clean JD scrape (bot wall / similar-jobs chrome).\n' +
    'Do not tailor on that page dump — it mixes other listings (Python fullstack, Nest, etc.).\n' +
    'Paste the real JD (Roles and Responsibilities + Job Requirements only):\n' +
    `  1. Open ${canonical || url}\n` +
    '  2. Dashboard: paste into the job JD field, then tailor again\n' +
    `  3. CLI: node add-job.mjs "${canonical || url}" --file ./jd.txt`
  );
}

export class NaukriFetchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NaukriFetchError';
    this.naukriBlocked = true;
  }
}

/**
 * Fetch a Naukri listing via Jina (Akamai skips most bots).
 * @returns {Promise<string>} stripped JD text
 */
export async function fetchNaukriJob(url, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available in this runtime');
  }
  const canonical = canonicalNaukriUrl(url) || String(url || '').trim();
  const jinaUrl = `https://r.jina.ai/${canonical}`;
  const res = await fetchImpl(jinaUrl, {
    headers: { Accept: 'text/plain', 'User-Agent': 'career-ops-naukri/1.0' },
  });
  if (!res.ok) {
    throw new NaukriFetchError(`Naukri Jina fetch HTTP ${res.status}\n${naukriManualJdHint(canonical)}`);
  }
  const raw = await res.text();
  const text = stripNaukriChrome(raw);
  if (text.length < 180 || looksLikeNaukriPollution(text)) {
    throw new NaukriFetchError(naukriManualJdHint(canonical));
  }
  return text;
}
