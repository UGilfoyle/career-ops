/**
 * Ashby JD fetch — public posting-api, no Playwright.
 * Covers jobs.ashbyhq.com/{slug}/{id} and custom boards like
 * https://jobs.bureau.id/?ashby_jid=<uuid>
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function parseAshbyJobRef(url) {
  const raw = String(url || '').trim();
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }

  const ashbyJid = u.searchParams.get('ashby_jid') || u.searchParams.get('ashbyJobId') || null;
  const pathParts = u.pathname.split('/').filter(Boolean);
  const host = u.hostname.replace(/^www\./i, '').toLowerCase();

  if (host.includes('ashbyhq.com')) {
    const slug = pathParts[0] && !UUID_RE.test(pathParts[0]) ? pathParts[0] : null;
    const pathId = pathParts.find((p) => UUID_RE.test(p)) || null;
    const jobId = pathId || ashbyJid;
    if (slug && jobId) return { slug, jobId };
    return null;
  }

  if (ashbyJid) {
    const labels = host.split('.');
    let slug = labels[0];
    if (['jobs', 'careers', 'apply', 'job'].includes(slug) && labels[1]) {
      slug = labels[1];
    }
    if (slug && slug !== 'www') return { slug, jobId: ashbyJid };
  }

  return null;
}

export function htmlToPlainJd(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function formatAshbyJobText(job) {
  const title = job?.title || '';
  const location = job?.location || '';
  const desc = htmlToPlainJd(job?.descriptionHtml || '');
  const parts = [];
  if (title) parts.push(`Job Title: ${title}`);
  if (location) parts.push(`Location: ${location}`);
  if (desc) parts.push(`\nDescription:\n${desc}`);
  return parts.join('\n').trim();
}

export async function fetchAshbyJobDescription(url, fetchImpl = fetch) {
  const ref = parseAshbyJobRef(url);
  if (!ref) return null;

  const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(ref.slug)}?includeCompensation=true`;
  const res = await fetchImpl(apiUrl, {
    headers: {
      'User-Agent': 'career-ops-tailor/1.0',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Ashby board API HTTP ${res.status} for slug=${ref.slug}`);
  }
  const data = await res.json();
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  const job = jobs.find((j) => {
    const id = String(j?.id || '');
    return id === ref.jobId || String(j?.jobUrl || '').includes(ref.jobId);
  });
  if (!job) {
    throw new Error(`Ashby job ${ref.jobId} not found on board ${ref.slug}`);
  }
  const text = formatAshbyJobText(job);
  if (text.length < 120) {
    throw new Error('Ashby API returned insufficient job text');
  }
  return { text, job, slug: ref.slug };
}
