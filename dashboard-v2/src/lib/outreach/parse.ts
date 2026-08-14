/** Pure helpers for public-source company research (no Hunter, no LinkedIn scrape). */

export const JOB_BOARD_HOSTS = new Set([
  'indeed',
  'linkedin',
  'naukri',
  'instahyre',
  'flexiple',
  'cutshort',
  'weworkremotely',
  'remoteok',
  'remotive',
  'wellfound',
  'ycombinator',
  'workatastartup',
  'greenhouse',
  'lever',
  'ashbyhq',
  'workable',
  'myworkdayjobs',
  'workday',
  'smartrecruiters',
  'jobvite',
  'icims',
  'glassdoor',
  'angel',
  'otta',
  'builtin',
  'levels',
  'levels.fyi',
]);

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.0\.0\.0|\[::1\])/i;

export function isPublicHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    if (PRIVATE_HOST.test(u.hostname)) return false;
    if (u.hostname === '0.0.0.0') return false;
    return true;
  } catch {
    return false;
  }
}

export function stripWww(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase();
}

export function hostLooksLikeJobBoard(host: string): boolean {
  const h = stripWww(host);
  const first = h.split('.')[0];
  if (JOB_BOARD_HOSTS.has(first)) return true;
  return [...JOB_BOARD_HOSTS].some((b) => h.includes(b));
}

export function githubOrgGuess(company: string): string {
  return String(company || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

export function inferCompanyDomain(opts: {
  company?: string;
  jobUrl?: string | null;
  homepage?: string | null;
}): string | null {
  const fromHome = hostnameFromUrl(opts.homepage);
  if (fromHome && !hostLooksLikeJobBoard(fromHome)) return stripWww(fromHome);

  const fromJob = hostnameFromUrl(opts.jobUrl);
  if (fromJob && !hostLooksLikeJobBoard(fromJob)) return stripWww(fromJob);

  return null;
}

function hostnameFromUrl(raw?: string | null): string | null {
  if (!raw || !isPublicHttpUrl(raw)) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JUNK_EMAIL = /noreply|no-reply|donotreply|privacy|legal@|support@example|sentry\.io|wixpress|godaddy|wordpress/i;

export function extractEmails(text: string, domain?: string | null): string[] {
  const found = String(text || '').match(EMAIL_RE) || [];
  const uniq = [...new Set(found.map((e) => e.toLowerCase()))];
  const filtered = uniq.filter((e) => !JUNK_EMAIL.test(e) && e.length < 80);
  if (!domain) return filtered.slice(0, 8);
  const d = domain.toLowerCase();
  const same = filtered.filter((e) => e.endsWith(`@${d}`) || e.endsWith(`.${d}`));
  return (same.length ? same : filtered).slice(0, 8);
}

export type SearchLink = { label: string; url: string };

/** Job / company geography for which public sources to hit. */
export type ResearchRegion = 'india' | 'gcc' | 'eu' | 'us' | 'global';

const INDIA_RE =
  /\b(india|indian|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|noida|gurgaon|gurugram|chennai|kolkata|remote india|naukri|instahyre)\b/i;
const GCC_RE =
  /\b(uae|dubai|abu dhabi|saudi|riyadh|jeddah|qatar|doha|kuwait|bahrain|oman|muscat|gcc)\b/i;
const EU_RE =
  /\b(europe|european|germany|berlin|munich|france|paris|netherlands|amsterdam|ireland|dublin|sweden|stockholm|spain|madrid|italy|milan|poland|warsaw|united kingdom|england|london|uk-based|\buk\b)\b/i;
const US_RE =
  /\b(united states|\busa\b|\bu\.s\.a\b|\bus-based\b|san francisco|new york|seattle|austin|boston|chicago|nasdaq|nyse|sec filing)\b/i;

function tldRegion(host: string): ResearchRegion | null {
  const h = stripWww(host);
  if (/\.in$/i.test(h) || h.endsWith('.co.in')) return 'india';
  if (/\.(ae|sa|qa|kw|om|bh)$/i.test(h)) return 'gcc';
  if (/\.(uk|de|fr|nl|ie|eu|se|es|it|pl|be|at|ch)$/i.test(h)) return 'eu';
  if (/\.(us|gov)$/i.test(h)) return 'us';
  return null;
}

function textRegion(blob: string): ResearchRegion | null {
  if (INDIA_RE.test(blob)) return 'india';
  if (GCC_RE.test(blob)) return 'gcc';
  if (EU_RE.test(blob)) return 'eu';
  if (US_RE.test(blob)) return 'us';
  return null;
}

export function inferResearchRegion(opts: {
  company?: string;
  role?: string;
  jobUrl?: string | null;
  jdText?: string | null;
  homepage?: string | null;
  candidateCountry?: string | null;
}): ResearchRegion {
  const blob = [opts.company, opts.role, opts.jdText].filter(Boolean).join(' ');
  const fromText = textRegion(blob);
  if (fromText) return fromText;

  for (const raw of [opts.jobUrl, opts.homepage]) {
    if (!raw || !isPublicHttpUrl(raw)) continue;
    try {
      const host = new URL(raw).hostname;
      const fromTld = tldRegion(host);
      if (fromTld) return fromTld;
      if (/naukri|instahyre|foundit\.in/i.test(host)) return 'india';
    } catch {
      /* ignore */
    }
  }

  const country = String(opts.candidateCountry || '').toLowerCase();
  if (country.includes('india')) return 'india';
  if (/\b(uae|saudi|qatar|kuwait|bahrain|oman)\b/.test(country)) return 'gcc';
  if (/\b(us|usa|united states)\b/.test(country)) return 'us';
  if (/\b(uk|germany|france|netherlands|ireland|europe)\b/.test(country)) return 'eu';
  return 'global';
}

/** SEC EDGAR only for US-listed / US-region jobs. */
export function shouldUseSec(region: ResearchRegion): boolean {
  return region === 'us';
}

export function newsQueryForRegion(company: string, region: ResearchRegion): string {
  const c = String(company || '').trim();
  if (region === 'india') return `${c} company news India`;
  if (region === 'gcc') return `${c} company news UAE OR Saudi OR Dubai`;
  if (region === 'eu') return `${c} company news Europe OR UK`;
  if (region === 'us') return `${c} company news United States`;
  return `${c} company news`;
}

function googleGl(region: ResearchRegion): string {
  if (region === 'india') return 'in';
  if (region === 'gcc') return 'ae';
  if (region === 'eu') return 'uk';
  if (region === 'us') return 'us';
  return '';
}

export function buildSearchLinks(
  company: string,
  role: string,
  region: ResearchRegion = 'global',
): SearchLink[] {
  const q = (s: string) => encodeURIComponent(s);
  const c = String(company || '').trim() || 'company';
  const r = String(role || '').trim();
  const gl = googleGl(region);
  const geo = gl ? `&gl=${gl}&hl=en` : '';
  const locHint =
    region === 'india' ? ' India' : region === 'gcc' ? ' UAE OR Saudi' : region === 'eu' ? ' Europe' : '';
  return [
    {
      label: 'Company website',
      url: `https://www.google.com/search?q=${q(`${c} official website`)}${geo}`,
    },
    {
      label: 'Hiring manager (Google)',
      url: `https://www.google.com/search?q=${q(`${c} ${r} hiring manager OR "engineering manager"${locHint}`)}${geo}`,
    },
    {
      label: 'LinkedIn people (you click)',
      url: `https://www.google.com/search?q=${q(`site:linkedin.com/in ${c} ${r || 'engineering'}${locHint}`)}${geo}`,
    },
    {
      label: 'News',
      url: `https://www.google.com/search?q=${q(newsQueryForRegion(c, region))}&tbm=nws${geo}`,
    },
    {
      label: 'GitHub org',
      url: `https://github.com/search?q=${q(c)}&type=users`,
    },
  ];
}

export type OutreachDraft = {
  subject: string;
  body: string;
  hook_used: string;
};

export function parseDraftJson(raw: string): OutreachDraft | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
    const subject = String(obj.subject || '').trim();
    const body = String(obj.body || '').trim();
    if (!subject || !body) return null;
    return {
      subject,
      body,
      hook_used: String(obj.hook_used || obj.hook || '').trim(),
    };
  } catch {
    return null;
  }
}

export function fallbackDraft(opts: {
  company: string;
  role: string;
  candidateName?: string;
  hook?: string;
  proof?: string;
}): OutreachDraft {
  const company = opts.company || 'the team';
  const role = opts.role || 'this role';
  const hook = opts.hook || `${company}'s work on ${role}`;
  const proof = opts.proof || 'I have shipped production systems in a similar stack.';
  const name = opts.candidateName || '';
  return {
    subject: `${role} — ${company}`,
    hook_used: hook,
    body: [
      `Hi,`,
      ``,
      `${hook}.`,
      ``,
      proof,
      ``,
      `That maps to what you listed for ${role}. I'd welcome 15 minutes to see if it's a fit.`,
      ``,
      name,
    ]
      .join('\n')
      .trim(),
  };
}
