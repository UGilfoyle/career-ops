/**
 * DuckDuckGo HTML discovery — shared by scratch-scan and gcc-scan.
 */

const JOB_BOARD_HOSTS = new Set([
  'indeed', 'linkedin', 'naukri', 'instahyre', 'flexiple', 'cutshort',
  'weworkremotely', 'remoteok', 'remotive', 'wellfound', 'ycombinator', 'workatastartup',
]);

function titleCaseCompany(name) {
  return String(name || '')
    .replace(/\b(careers|jobs|hiring|corporation|corp|inc|ltd|solutions|technologies|tech|group)\b/gi, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractCompanyFromResult(url, title, portalName) {
  let company = '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').replace(/^(in|uk|ca|au|de|fr)\./, '').toLowerCase();

    if (host.includes('greenhouse.io')) {
      const segments = parsed.pathname.split('/').filter(Boolean);
      company = segments[0] === 'embed' || segments[0] === 'xyz' ? segments[1] : segments[0];
    } else if (host.includes('lever.co') || host.includes('ashbyhq.com') || host.includes('workable.com')) {
      company = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host.includes('wellfound.com')) {
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments[0] === 'company' && segments[1]) company = segments[1];
    } else if (host.includes('workday.com') || host.includes('myworkdayjobs.com')) {
      company = parsed.pathname.split('/').filter(Boolean)[0] || '';
    }

    if (!company && title) {
      const atMatch = title.match(/\s+(?:at|@)\s+([A-Za-z0-9\s\-_&.]+)/i);
      if (atMatch) {
        const cleanComp = atMatch[1].trim().split(/\s*[-–|]/)[0].trim();
        if (cleanComp && !/^(?:remote|hybrid|onsite|europe|us|india|pune|bengaluru|london|berlin|singapore|tokyo|toronto|sydney)$/i.test(cleanComp)) {
          company = cleanComp;
        }
      }

      if (!company) {
        const delimiters = [/\s*\|\s*/, /\s+-\s+/, /\s+—\s+/, /\s+:\s+/];
        for (const delim of delimiters) {
          const parts = title.split(delim).map((p) => p.trim()).filter(Boolean);
          if (parts.length > 1) {
            const jobKeywords = /engineer|developer|architect|designer|manager|director|lead|senior|junior|staff|principal|head|vp|intern|specialist|expert/i;
            const isJobPart = parts.map((p) => jobKeywords.test(p));
            if (isJobPart.includes(true)) {
              const companyIndex = isJobPart.indexOf(false);
              if (companyIndex !== -1 && parts[companyIndex]) {
                const compCandidate = parts[companyIndex];
                if (!/^(?:remote|hybrid|onsite|europe|us|india|pune|bengaluru|london|berlin|singapore|tokyo|toronto|sydney|linkedin|indeed|naukri|workable|lever|greenhouse|ashby)$/i.test(compCandidate)) {
                  company = compCandidate;
                  break;
                }
              }
            }
            const lastPart = parts[parts.length - 1];
            if (!/^(?:remote|hybrid|onsite|europe|us|india|pune|bengaluru|london|berlin|singapore|tokyo|toronto|sydney|linkedin|indeed|naukri|workable|lever|greenhouse|ashby)$/i.test(lastPart)) {
              company = lastPart;
              break;
            }
          }
        }
      }
    }

    if (!company) {
      const domainName = host.split('.')[0];
      if (domainName && !JOB_BOARD_HOSTS.has(domainName)) {
        company = domainName;
      }
    }
  } catch {
    // ignore
  }

  if (!company) {
    company = portalName.split(/\s*[-–—|:]/)[0].trim();
  }

  return titleCaseCompany(company);
}

function shouldSkipJobUrl(url) {
  const lowerUrl = url.toLowerCase();
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const pathSegments = parsed.pathname.split('/').filter(Boolean);

    if (pathSegments.length === 0) return true;
    if (host.includes('greenhouse.io') && !path.includes('/jobs/')) return true;
    if (host.includes('lever.co') && pathSegments.length < 2) return true;
    if (host.includes('ashbyhq.com') && pathSegments.length < 2) return true;
    if (host.includes('workable.com') && !path.includes('/j/')) return true;
    if (host.includes('indeed.com') && !lowerUrl.includes('/viewjob') && !lowerUrl.includes('/rc/clk') && !lowerUrl.includes('/job/')) return true;
    if (host.includes('naukri.com') && !lowerUrl.includes('-job-') && !lowerUrl.includes('/job-listings')) return true;
    if (host.includes('linkedin.com') && !path.includes('/jobs/view/')) return true;
    if (host.includes('wellfound.com') && (!path.includes('/jobs/') || pathSegments.length < 3)) return true;
    if ((host.includes('workatastartup.com') || host.includes('ycombinator.com')) && !path.match(/\/jobs\/\d/)) return true;

    if (parsed.searchParams.has('q') || parsed.searchParams.has('query') || parsed.searchParams.has('keywords')) return true;
    const listingPatterns = [
      '/search?', '/q-', '/jobs-in-', '/jobs-at-',
      '/category/', '/categories/', '/tag/', '/tags/',
      '/department/', '/departments/', '/team/', '/teams/',
      '/location/', '/locations/',
    ];
    if (listingPatterns.some((pat) => lowerUrl.includes(pat))) return true;
    if (path.match(/\/(jobs|careers|openings|vacancies|positions)\/?$/)) return true;
    const lastSegment = pathSegments[pathSegments.length - 1]?.toLowerCase() || '';
    if (lastSegment.endsWith('-jobs') || lastSegment.endsWith('-careers')) return true;
    const genericCategories = [
      'software-dev', 'engineering', 'design', 'marketing', 'sales',
      'product', 'data', 'devops', 'qa', 'finance', 'operations',
      'customer-service', 'hr', 'legal', 'all', 'featured',
    ];
    if (genericCategories.includes(lastSegment)) return true;
    return false;
  } catch {
    return lowerUrl.length < 25;
  }
}

/**
 * @param {string} query
 * @param {string} [portalName]
 * @param {{ expectedCompany?: string }} [options]
 */
export async function discoverJobsWithoutBrowser(query, portalName = 'General', options = {}) {
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const jobs = [];
  const seen = new Set();
  const expectedCompany = options.expectedCompany ? titleCaseCompany(options.expectedCompany) : '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`    ⚠ DuckDuckGo returned ${res.status} for ${portalName}`);
      return jobs;
    }

    const html = await res.text();
    const linkRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let rawUrl = match[1];
      const titleHtml = match[2] || '';

      rawUrl = rawUrl.replace(/&amp;/g, '&');
      if (rawUrl.includes('duckduckgo.com/l/')) {
        try {
          const ddgUrl = new URL(rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl);
          const realUrl = ddgUrl.searchParams.get('uddg');
          if (realUrl) rawUrl = decodeURIComponent(realUrl);
        } catch { /* keep rawUrl */ }
      }

      const url = rawUrl;
      if (!url || seen.has(url) || shouldSkipJobUrl(url)) continue;

      seen.add(url);
      const title = titleHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!title) continue;

      let company = extractCompanyFromResult(url, title, portalName);
      if (expectedCompany) {
        const lower = company.toLowerCase();
        const looksLikeBoard = JOB_BOARD_HOSTS.has(lower) || lower.includes('naukri') || lower.includes('linkedin') || lower.includes('indeed');
        if (looksLikeBoard || !lower.includes(expectedCompany.toLowerCase().split(' ')[0])) {
          company = expectedCompany;
        }
      }

      jobs.push({
        url,
        title,
        company,
        source: `Discovery - ${portalName}`,
      });
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.log(`    ⏱ Timeout searching ${portalName} (15s exceeded)`);
    }
  }
  return jobs;
}
