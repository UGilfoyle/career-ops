/**
 * Shared GCC scan helpers — Greenhouse/Lever APIs + trusted employer tagging.
 */

export function titleCaseCompany(name) {
  return String(name || '')
    .replace(/\b(careers|jobs|hiring|corporation|corp|inc|ltd|solutions|technologies|tech|group)\b/gi, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function boardSlugs(company) {
  const raw = String(company).toLowerCase().trim();
  const stripped = raw
    .replace(/\b(labs|india|technologies|technology|software|global|inc|corp|corporation|limited|ltd|group|bank)\b/g, '')
    .replace(/\s+/g, '')
    .trim();
  const compact = raw.replace(/[^a-z0-9]/g, '');
  const hyphen = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [...new Set([compact, stripped, hyphen, raw.replace(/\s+/g, '')].filter((s) => s.length >= 2))];
}

export function locationMatchesIndia(text) {
  return /india|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|gurgaon|gurugram|noida|chennai|remote|wfh|work from home/i.test(
    String(text || '')
  );
}

export async function fetchGreenhouseJobs(company, matchesFilter) {
  const out = [];
  for (const slug of boardSlugs(company)) {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
      if (jobs.length === 0) continue;

      for (const job of jobs) {
        const title = String(job.title || '').trim();
        const url = String(job.absolute_url || '').trim();
        if (!title || !url) continue;
        const loc = String(job.location?.name || '').trim();
        if (!matchesFilter(title)) continue;
        const locOk = !loc || locationMatchesIndia(loc) || locationMatchesIndia(title) || /remote/i.test(loc);
        if (!locOk) continue;
        out.push({
          url,
          title,
          company: titleCaseCompany(company),
          source: `GCC Scan - Greenhouse (${slug})`,
        });
      }
      if (out.length > 0) break;
    } catch {
      // try next slug
    }
  }
  return out;
}

export async function fetchLeverJobs(company, matchesFilter) {
  const out = [];
  for (const slug of boardSlugs(company)) {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json&limit=100`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const jobs = await res.json();
      if (!Array.isArray(jobs) || jobs.length === 0) continue;

      for (const job of jobs) {
        const title = String(job.text || '').trim();
        const url = String(job.hostedUrl || job.applyUrl || '').trim();
        if (!title || !url) continue;
        const loc = String(job.categories?.location || '').trim();
        if (!matchesFilter(title)) continue;
        const locOk = !loc || locationMatchesIndia(loc) || locationMatchesIndia(title) || /remote/i.test(loc);
        if (!locOk) continue;
        out.push({
          url,
          title,
          company: titleCaseCompany(company),
          source: `GCC Scan - Lever (${slug})`,
        });
      }
      if (out.length > 0) break;
    } catch {
      // try next slug
    }
  }
  return out;
}
