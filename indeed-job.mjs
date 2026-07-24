/**
 * indeed-job.mjs — Parse / fetch Indeed job postings.
 *
 * Desktop /viewjob is Cloudflare-gated. The mobile embedded endpoint
 * (`/m/basecamp/viewjob?viewtype=embedded&jk=`) returns window._initialData
 * with title, company, and full description.
 */

const INDEED_HOST_RE = /(^|\.)indeed\.com$/i;
const JK_RE = /^[a-f0-9]{16}$/i;

export function isIndeedUrl(url) {
  try {
    return INDEED_HOST_RE.test(new URL(String(url).trim()).hostname);
  } catch {
    return /indeed\.com/i.test(String(url || ''));
  }
}

/** Extract 16-char hex job key from common Indeed URL shapes. */
export function extractIndeedJobKey(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;

  try {
    const u = new URL(raw.startsWith('//') ? `https:${raw}` : raw.includes('://') ? raw : `https://${raw}`);
    if (!INDEED_HOST_RE.test(u.hostname)) return null;

    for (const key of ['jk', 'fromjk', 'vjk']) {
      const val = u.searchParams.get(key);
      if (val && JK_RE.test(val)) return val.toLowerCase();
    }

    const pathMatch = u.pathname.match(/(?:\/|^)(?:viewjob|job)\/(?:[^/]*-)?([a-f0-9]{16})(?:\/|$)/i)
      || u.pathname.match(/([a-f0-9]{16})(?:\/|$)/i);
    if (pathMatch && JK_RE.test(pathMatch[1])) return pathMatch[1].toLowerCase();

    const hashMatch = u.hash.match(/(?:jk|fromjk|vjk)=([a-f0-9]{16})/i);
    if (hashMatch) return hashMatch[1].toLowerCase();
  } catch {
    // fall through to loose regex
  }

  const loose = raw.match(/(?:[?&#](?:jk|fromjk|vjk)=|\/)([a-f0-9]{16})\b/i);
  return loose ? loose[1].toLowerCase() : null;
}

/** Stable viewjob URL (strip tracking; keep country host when present). */
export function canonicalIndeedUrl(url) {
  const jk = extractIndeedJobKey(url);
  if (!jk) return String(url || '').trim();

  let host = 'www.indeed.com';
  try {
    const u = new URL(String(url).trim().startsWith('//')
      ? `https:${String(url).trim()}`
      : String(url).includes('://')
        ? String(url).trim()
        : `https://${String(url).trim()}`);
    if (INDEED_HOST_RE.test(u.hostname)) host = u.hostname.replace(/^m\./i, 'www.');
  } catch {
    // keep default host
  }
  return `https://${host}/viewjob?jk=${jk}`;
}

export function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Extract balanced JSON object starting at `start` (`{` index). */
export function extractBalancedJson(source, start) {
  if (start < 0 || source[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return null;
}

export function parseIndeedInitialData(html) {
  const marker = 'window._initialData=';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const brace = html.indexOf('{', idx + marker.length);
  const jsonStr = extractBalancedJson(html, brace);
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function jobFromIndeedInitialData(data, { jk, canonicalUrl } = {}) {
  if (!data || typeof data !== 'object') return null;

  const wrapper = data.jobInfoWrapperModel?.jobInfoModel;
  const header = wrapper?.jobInfoHeaderModel;
  const gqlJob = data.hostQueryExecutionResult?.data?.jobData?.results?.[0]?.job;

  const title = header?.jobTitle || gqlJob?.title || data.jobTitle || null;
  const company = header?.companyName || gqlJob?.sourceEmployerName || null;
  const location =
    header?.formattedLocation ||
    gqlJob?.location?.formatted?.long ||
    data.jobLocation ||
    null;

  let descriptionHtml =
    wrapper?.sanitizedJobDescription ||
    gqlJob?.description?.html ||
    '';
  let descriptionText = gqlJob?.description?.text || '';
  if (!descriptionText && descriptionHtml) {
    descriptionText = htmlToPlainText(descriptionHtml);
  }

  if (!descriptionText || descriptionText.length < 80) return null;

  const parts = [];
  if (title) parts.push(`Job Title: ${title}`);
  if (company) parts.push(`Company: ${company}`);
  if (location) parts.push(`Location: ${location}`);
  parts.push(`\nDescription:\n${descriptionText}`);

  return {
    jk: jk || data.jobKey || null,
    canonicalUrl: canonicalUrl || null,
    title: title || 'Unknown Role',
    company: company || 'Unknown Company',
    location,
    text: parts.join('\n').slice(0, 25000),
    expired: Boolean(gqlJob?.expired || wrapper?.jobDescriptionSectionModel?.jobDetailsSection?.isJobExpired),
  };
}

function looksLikeIndeedBlock(html) {
  const lower = String(html || '').toLowerCase();
  return (
    lower.includes('additional verification required') ||
    lower.includes('security check - indeed') ||
    lower.includes('indeed_cloudflare_static_page') ||
    lower.includes('cf-challenge') ||
    (lower.includes('just a moment') && lower.includes('cloudflare'))
  );
}

/**
 * Fetch a single Indeed job via mobile embedded page (avoids desktop CF gate).
 * @returns {{ jk, canonicalUrl, title, company, location, text, expired }}
 */
export async function fetchIndeedJob(url, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available in this runtime');
  }

  const jk = extractIndeedJobKey(url);
  if (!jk) {
    throw new Error(
      'Could not extract Indeed job key (jk) from URL. Expected …/viewjob?jk=… or …/rc/clk?jk=…'
    );
  }

  const canonicalUrl = canonicalIndeedUrl(url);
  const endpoints = [
    `https://www.indeed.com/m/basecamp/viewjob?viewtype=embedded&jk=${jk}`,
    `https://www.indeed.com/m/viewjob?jk=${jk}`,
  ];

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'x-requested-with': 'com.indeed.android.jobsearch',
  };

  let lastErr = null;
  for (const endpoint of endpoints) {
    try {
      const res = await fetchImpl(endpoint, { headers, redirect: 'follow' });
      const html = await res.text();
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${endpoint}`);
        continue;
      }
      if (looksLikeIndeedBlock(html)) {
        lastErr = new Error('Indeed anti-bot / Cloudflare page returned');
        continue;
      }
      const data = parseIndeedInitialData(html);
      const job = jobFromIndeedInitialData(data, { jk, canonicalUrl });
      if (job) return job;
      lastErr = new Error('Indeed page loaded but job description missing from _initialData');
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(
    `Indeed fetch failed for jk=${jk}: ${lastErr?.message || 'unknown error'}. ` +
      `Paste the JD manually: node add-job.mjs "${canonicalUrl}" --file ./jd.txt`
  );
}
