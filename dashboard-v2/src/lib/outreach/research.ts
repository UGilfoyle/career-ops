import {
  extractEmails,
  githubOrgGuess,
  inferCompanyDomain,
  inferResearchRegion,
  isPublicHttpUrl,
  newsQueryForRegion,
  shouldUseSec,
  type ResearchRegion,
  type SearchLink,
  buildSearchLinks,
} from './parse';

export type ResearchSource = {
  id: string;
  ok: boolean;
  skipped?: boolean;
  summary: string;
  url?: string;
};

export type ResearchBundle = {
  company: string;
  role: string;
  region: ResearchRegion;
  domain: string | null;
  notes: string[];
  sources: ResearchSource[];
  emails: string[];
  people: string[];
  searchLinks: SearchLink[];
  jdSnippet: string;
  githubAuth: boolean;
};

const UA = 'Career-Ops/1.0 (outreach-research; +https://careerops.dpdns.org)';
const TIMEOUT_MS = 8000;

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...(init.headers || {}) },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function clip(s: string, n = 900): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function companyMatchesTitle(company: string, title: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const c = norm(company);
  const t = norm(title);
  if (!c || !t) return false;
  if (t.includes(c) || c.includes(t)) return true;
  const tokens = c.split(' ').filter((x) => x.length > 3);
  return tokens.length > 0 && tokens.every((tok) => t.includes(tok));
}

async function jinaRead(url: string): Promise<string> {
  if (!isPublicHttpUrl(url)) return '';
  const text = await fetchText(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
  });
  return clip(text, 4000);
}

function resolveGithubToken(explicit?: string | null): string {
  return String(
    explicit ||
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_PAT ||
      '',
  ).trim();
}

function githubHeaders(token?: string | null): Record<string, string> {
  const resolved = resolveGithubToken(token);
  const h: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': UA };
  if (resolved) h.Authorization = `Bearer ${resolved}`;
  return h;
}

async function wikipedia(company: string): Promise<ResearchSource> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(company)}&limit=5&namespace=0&format=json`;
  const search = (await fetchJson(searchUrl)) as unknown[];
  const titles = Array.isArray(search?.[1]) ? (search[1] as unknown[]).map((x) => String(x || '')) : [];
  const title = titles.find((t) => companyMatchesTitle(company, t)) || '';
  if (!title) return { id: 'wikipedia', ok: false, summary: `No Wikipedia page matching ${company}` };
  const slug = encodeURIComponent(title.replace(/ /g, '_'));
  const page = (await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`)) as {
    extract?: string;
    content_urls?: { desktop?: { page?: string } };
  };
  const extract = String(page.extract || '').trim();
  return {
    id: 'wikipedia',
    ok: Boolean(extract),
    summary: extract ? clip(extract, 700) : 'Empty summary',
    url: page.content_urls?.desktop?.page,
  };
}

async function wikidata(company: string): Promise<ResearchSource & { homepage?: string; people?: string[] }> {
  const search = (await fetchJson(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(company)}&language=en&format=json&limit=1&type=item`,
  )) as { search?: Array<{ id: string; description?: string }> };
  const id = search.search?.[0]?.id;
  if (!id) return { id: 'wikidata', ok: false, summary: 'No Wikidata entity' };
  const data = (await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`)) as {
    entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>; labels?: { en?: { value?: string } } }>;
  };
  const entity = data.entities?.[id];
  const claims = entity?.claims || {};
  const people: string[] = [];
  let homepage = '';

  const snak = (prop: string) => claims[prop]?.[0]?.mainsnak?.datavalue?.value;
  const site = snak('P856');
  if (typeof site === 'string') homepage = site;
  const inception = snak('P571');
  const founded =
    inception && typeof inception === 'object' && 'time' in inception
      ? String((inception as { time?: string }).time || '').slice(1, 11)
      : '';

  const summaryBits = [
    search.search?.[0]?.description,
    founded ? `Founded ${founded}` : '',
    homepage ? `Site ${homepage}` : '',
  ].filter(Boolean);

  return {
    id: 'wikidata',
    ok: true,
    summary: clip(summaryBits.join('. ') || id, 400),
    url: `https://www.wikidata.org/wiki/${id}`,
    homepage,
    people,
  };
}

async function githubOrg(
  company: string,
  token?: string | null,
): Promise<ResearchSource & { people?: string[] }> {
  const headers = githubHeaders(token);
  const guess = githubOrgGuess(company);
  const search = (await fetchJson(
    `https://api.github.com/search/users?q=${encodeURIComponent(`${company} type:org`)}&per_page=1`,
    { headers },
  )) as { items?: Array<{ login: string }> };
  const login = search.items?.[0]?.login || guess;
  const org = (await fetchJson(`https://api.github.com/orgs/${encodeURIComponent(login)}`, {
    headers,
  }).catch(() => null)) as {
    login?: string;
    description?: string;
    blog?: string;
    html_url?: string;
    public_repos?: number;
  } | null;
  if (!org?.login) return { id: 'github', ok: false, summary: `No GitHub org for ${company}` };

  const repos = (await fetchJson(
    `https://api.github.com/orgs/${org.login}/repos?sort=updated&per_page=5`,
    { headers },
  ).catch(() => [])) as Array<{ name?: string; language?: string; stargazers_count?: number }>;
  const members = (await fetchJson(
    `https://api.github.com/orgs/${org.login}/public_members?per_page=8`,
    { headers },
  ).catch(() => [])) as Array<{ login?: string }>;
  const repoBits = (Array.isArray(repos) ? repos : [])
    .slice(0, 5)
    .map((r) => `${r.name}${r.language ? ` (${r.language})` : ''}`)
    .join(', ');
  const people = (Array.isArray(members) ? members : []).map((m) => m.login).filter(Boolean) as string[];
  return {
    id: 'github',
    ok: true,
    summary: clip(
      `${org.login}: ${org.description || 'GitHub org'}. Repos ${org.public_repos ?? 0}. Recent: ${repoBits || 'n/a'}`,
      500,
    ),
    url: org.html_url,
    people: people.map((p) => `@${p} (GitHub)`),
  };
}

async function duckNews(company: string, region: ResearchRegion): Promise<ResearchSource> {
  const html = await fetchText(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(newsQueryForRegion(company, region))}`,
    { headers: { Accept: 'text/html' } },
  );
  const titles = [...html.matchAll(/class="result__a"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
    .filter((t) => t.length > 12 && !/duckduckgo/i.test(t))
    .slice(0, 5);
  if (!titles.length) return { id: 'news', ok: false, summary: 'No DuckDuckGo headlines' };
  return { id: 'news', ok: true, summary: titles.join(' · '), url: 'https://html.duckduckgo.com' };
}

async function dnsMx(domain: string): Promise<ResearchSource> {
  const data = (await fetchJson(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
    { headers: { Accept: 'application/dns-json' } },
  )) as { Answer?: Array<{ data?: string }> };
  const mx = (data.Answer || []).map((a) => String(a.data || '').replace(/\.$/, '')).filter(Boolean);
  if (!mx.length) return { id: 'dns', ok: false, summary: `No MX for ${domain}` };
  const provider = mx.join(', ');
  let hint = '';
  const blob = provider.toLowerCase();
  if (blob.includes('google') || blob.includes('googlemail')) hint = 'Google Workspace';
  else if (blob.includes('outlook') || blob.includes('microsoft')) hint = 'Microsoft 365';
  else if (blob.includes('proofpoint') || blob.includes('mimecast')) hint = 'filtered corp mail';
  return {
    id: 'dns',
    ok: true,
    summary: `Mail for ${domain}: ${hint || 'MX'} — ${clip(provider, 180)}`,
  };
}

async function secEdgar(company: string): Promise<ResearchSource> {
  const atom = await fetchText(
    `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(company)}&owner=exclude&action=getcompany&output=atom&count=5`,
    { headers: { Accept: 'application/atom+xml,application/xml,text/xml' } },
  );
  const entries = atom.split('<entry').slice(1);
  let best: { cik: string; city: string; state: string; sic: string; last: string } | null = null;
  for (const entry of entries) {
    const cik = (entry.match(/<cik>(\d+)<\/cik>/i) || [])[1];
    if (!cik) continue;
    const city = (entry.match(/<city>([^<]+)<\/city>/i) || [])[1] || '';
    const state = (entry.match(/<state>([^<]+)<\/state>/i) || [])[1] || '';
    const sic = (entry.match(/<sic>([^<]+)<\/sic>/i) || [])[1] || '';
    const last = (entry.match(/<last-date>([^<]+)<\/last-date>/i) || [])[1] || '';
    const score = (sic ? 2 : 0) + (last ? 1 : 0);
    const prev = best ? (best.sic ? 2 : 0) + (best.last ? 1 : 0) : -1;
    if (!best || score > prev || (score === prev && last > best.last)) {
      best = { cik, city, state, sic, last };
    }
  }
  if (!best) return { id: 'sec', ok: false, summary: 'No SEC filings (private or non-US)' };
  const bits = [
    `CIK ${best.cik}`,
    best.city && best.state ? `${best.city}, ${best.state}` : '',
    best.sic ? `SIC ${best.sic}` : '',
    best.last ? `last filing ${best.last}` : '',
  ].filter(Boolean);
  return {
    id: 'sec',
    ok: true,
    summary: clip(bits.join(' · '), 400),
    url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${best.cik}&owner=exclude`,
  };
}

function aboutCandidates(homepage: string): string[] {
  try {
    const u = new URL(homepage);
    const origin = u.origin;
    return [`${origin}/about`, `${origin}/about-us`, `${origin}/company`, `${origin}/team`];
  } catch {
    return [];
  }
}

export async function researchCompany(opts: {
  company: string;
  role: string;
  jobUrl?: string | null;
  jdText?: string | null;
  candidateCountry?: string | null;
  githubToken?: string | null;
}): Promise<ResearchBundle> {
  const company = String(opts.company || '').trim() || 'Unknown';
  const role = String(opts.role || '').trim() || 'Role';
  const sources: ResearchSource[] = [];
  const notes: string[] = [];
  const people: string[] = [];
  let emails: string[] = [];
  let homepage: string | null = null;
  let jdSnippet = clip(String(opts.jdText || ''), 1800);
  const githubAuth = Boolean(resolveGithubToken(opts.githubToken));

  const region = inferResearchRegion({
    company,
    role,
    jobUrl: opts.jobUrl,
    jdText: opts.jdText,
    candidateCountry: opts.candidateCountry,
  });

  const secTask = shouldUseSec(region)
    ? secEdgar(company)
    : Promise.resolve({
        id: 'sec',
        ok: false,
        skipped: true,
        summary: `Skipped — SEC is US-listed only (this job looks ${region})`,
      } satisfies ResearchSource);

  const settled = await Promise.allSettled([
    opts.jobUrl && isPublicHttpUrl(opts.jobUrl) ? jinaRead(opts.jobUrl) : Promise.resolve(''),
    wikipedia(company),
    wikidata(company),
    githubOrg(company, opts.githubToken),
    duckNews(company, region),
    secTask,
  ]);

  const jobText = settled[0].status === 'fulfilled' ? settled[0].value : '';
  if (jobText) {
    sources.push({ id: 'job', ok: true, summary: clip(jobText, 800), url: opts.jobUrl || undefined });
    if (!jdSnippet) jdSnippet = clip(jobText, 1800);
    emails.push(...extractEmails(jobText));
  } else if (opts.jobUrl) {
    sources.push({ id: 'job', ok: false, summary: 'Could not read job URL (Jina)' });
  }

  const regionAfterJob = inferResearchRegion({
    company,
    role,
    jobUrl: opts.jobUrl,
    jdText: jdSnippet || opts.jdText,
    candidateCountry: opts.candidateCountry,
  });

  const wiki = settled[1].status === 'fulfilled' ? settled[1].value : null;
  if (wiki) sources.push(wiki);

  const wd = settled[2].status === 'fulfilled' ? settled[2].value : null;
  if (wd) {
    sources.push(wd);
    if (wd.homepage && isPublicHttpUrl(wd.homepage)) homepage = wd.homepage;
    people.push(...(wd.people || []));
  }

  const gh = settled[3].status === 'fulfilled' ? settled[3].value : null;
  if (gh) {
    sources.push(gh);
    people.push(...(gh.people || []));
  }

  const news = settled[4].status === 'fulfilled' ? settled[4].value : null;
  if (news) sources.push(news);

  let sec = settled[5].status === 'fulfilled' ? settled[5].value : null;
  if (sec?.skipped && shouldUseSec(regionAfterJob)) {
    sec = await secEdgar(company).catch(
      (): ResearchSource => ({ id: 'sec', ok: false, summary: 'SEC lookup failed' }),
    );
  }
  if (sec) sources.push(sec);

  const domain = inferCompanyDomain({ company, jobUrl: opts.jobUrl, homepage });
  if (domain) {
    const mx = await dnsMx(domain).catch(
      (): ResearchSource => ({ id: 'dns', ok: false, summary: 'DNS lookup failed' }),
    );
    sources.push(mx);
  }

  const site = homepage || (domain ? `https://${domain}` : '');
  if (site && isPublicHttpUrl(site)) {
    const pages = [site, ...aboutCandidates(site).slice(0, 2)];
    for (const page of pages) {
      try {
        const text = await jinaRead(page);
        if (!text) continue;
        sources.push({ id: 'site', ok: true, summary: clip(text, 700), url: page });
        emails.push(...extractEmails(text, domain));
        const nameHits = [...text.matchAll(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b(?:[,\s]+(?:CEO|CTO|Founder|VP|Director|Head of)[^\n.]{0,40})/g)]
          .slice(0, 6)
          .map((m) => m[0].replace(/\s+/g, ' ').trim());
        people.push(...nameHits);
        break;
      } catch {
        /* next page */
      }
    }
  }

  const refinedRegion = inferResearchRegion({
    company,
    role,
    jobUrl: opts.jobUrl,
    jdText: jdSnippet || opts.jdText,
    homepage,
    candidateCountry: opts.candidateCountry,
  });

  emails = [...new Set(emails.map((e) => e.toLowerCase()))].slice(0, 8);
  const uniqPeople = [...new Set(people)].slice(0, 10);

  for (const s of sources) {
    if (s.ok && s.summary) notes.push(`${s.id}: ${s.summary}`);
  }
  if (emails.length) notes.push(`public emails: ${emails.join(', ')}`);
  if (uniqPeople.length) notes.push(`people: ${uniqPeople.join('; ')}`);
  if (!notes.length) notes.push('Little public signal — draft from the job text only.');

  return {
    company,
    role,
    region: refinedRegion,
    domain,
    notes,
    sources,
    emails,
    people: uniqPeople,
    searchLinks: buildSearchLinks(company, role, refinedRegion),
    jdSnippet,
    githubAuth,
  };
}
