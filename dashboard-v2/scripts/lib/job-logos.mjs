/** Portal + company logo helpers — used by scanners, add-job, and dashboard UI. */

export const PORTAL_DOMAINS = {
  linkedin: 'linkedin.com',
  naukri: 'naukri.com',
  indeed: 'indeed.com',
  hirist: 'hirist.com',
  workable: 'workable.com',
  greenhouse: 'greenhouse.io',
  ashby: 'ashbyhq.com',
  lever: 'lever.co',
  instahyre: 'instahyre.com',
  flexiple: 'flexiple.com',
  cutshort: 'cutshort.io',
  'japan-dev': 'japan-dev.com',
};

export const COMPANY_DOMAIN_ALIASES = {
  addepar: 'addepar.com',
  accenture: 'accenture.com',
  amazon: 'amazon.com',
  apple: 'apple.com',
  atlassian: 'atlassian.com',
  caterpillar: 'caterpillar.com',
  'caterpillar inc': 'caterpillar.com',
  cognizant: 'cognizant.com',
  deloitte: 'deloitte.com',
  'deloitte india': 'deloitte.com',
  'deloitte usi': 'deloitte.com',
  ey: 'ey.com',
  'ernst and young': 'ey.com',
  'ernst & young': 'ey.com',
  google: 'google.com',
  ibm: 'ibm.com',
  infosys: 'infosys.com',
  kpmg: 'kpmg.com',
  meta: 'meta.com',
  microsoft: 'microsoft.com',
  oracle: 'oracle.com',
  pwc: 'pwc.com',
  'pwc india': 'pwc.com',
  pricewaterhousecoopers: 'pwc.com',
  sap: 'sap.com',
  siemens: 'siemens.com',
  tcs: 'tcs.com',
  'tata consultancy services': 'tcs.com',
  wipro: 'wipro.com',
  goldman: 'goldmansachs.com',
  'goldman sachs': 'goldmansachs.com',
  jpmorgan: 'jpmorganchase.com',
  'jp morgan': 'jpmorganchase.com',
  qualcomm: 'qualcomm.com',
  salesforce: 'salesforce.com',
  stripe: 'stripe.com',
  uber: 'uber.com',
  zomato: 'zomato.com',
  swiggy: 'swiggy.com',
  flipkart: 'flipkart.com',
  razorpay: 'razorpay.com',
};

const GENERIC_OG_HINTS = [
  'default-share',
  'placeholder',
  'logo-linkedin',
  '/images/logo',
  'static.licdn.com/sc/h/',
];

export function normalizeCompanyKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolvePortalKey(url, source = '') {
  const u = String(url || '').toLowerCase();
  const s = String(source || '').toLowerCase();

  if (u.includes('linkedin.com') || s.includes('linkedin')) return 'linkedin';
  if (u.includes('hirist.com') || s.includes('hirist')) return 'hirist';
  if (u.includes('workable.com') || s.includes('workable')) return 'workable';
  if (u.includes('naukri.com') || s.includes('naukri')) return 'naukri';
  if (u.includes('indeed.com') || s.includes('indeed')) return 'indeed';
  if (u.includes('greenhouse.io') || s.includes('greenhouse')) return 'greenhouse';
  if (u.includes('ashbyhq.com') || s.includes('ashby')) return 'ashby';
  if (u.includes('lever.co') || s.includes('lever')) return 'lever';
  if (u.includes('instahyre.com') || s.includes('instahyre')) return 'instahyre';
  if (u.includes('flexiple.com') || s.includes('flexiple')) return 'flexiple';
  if (u.includes('cutshort.io') || s.includes('cutshort')) return 'cutshort';
  if (u.includes('japan-dev.com') || s.includes('japan-dev')) return 'japan-dev';

  return null;
}

export function googleFaviconUrl(domain, size = 128) {
  const d = String(domain || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  if (!d || !d.includes('.')) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=${size}`;
}

export function clearbitLogoUrl(domain) {
  const d = String(domain || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  if (!d || !d.includes('.')) return null;
  return `https://logo.clearbit.com/${encodeURIComponent(d)}`;
}

export function portalFaviconUrl(portalKey, size = 64) {
  const domain = portalKey ? PORTAL_DOMAINS[portalKey] : null;
  if (!domain) return null;
  return googleFaviconUrl(domain, size);
}

export function extractEmployerSlugFromUrl(url) {
  try {
    const u = new URL(String(url || ''));
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);
    if (host.includes('greenhouse.io') && parts[0]) return parts[0].toLowerCase();
    if (host.includes('lever.co') && parts[0]) return parts[0].toLowerCase();
    if (host.includes('ashbyhq.com') && parts[0]) return parts[0].toLowerCase();
    if (host.includes('workable.com') && parts[0] && parts[0] !== 'j') return parts[0].toLowerCase();
    if (host.includes('bamboohr.com') && parts[0] === 'careers' && parts[1]) return parts[1].toLowerCase();
  } catch {
    /* ignore */
  }
  return null;
}

export function inferCompanyDomain(company, url) {
  const key = normalizeCompanyKey(company);
  if (key && COMPANY_DOMAIN_ALIASES[key]) return COMPANY_DOMAIN_ALIASES[key];

  if (key) {
    const withoutSuffix = key
      .replace(/\b(indi[a]?|usa|us|llp|inc|ltd|limited|plc|gmbh|corp|corporation|services|technologies|technology|tech|labs|studio|group|holdings)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (COMPANY_DOMAIN_ALIASES[withoutSuffix]) return COMPANY_DOMAIN_ALIASES[withoutSuffix];
    const first = withoutSuffix.split(' ')[0];
    if (first && first.length >= 3 && COMPANY_DOMAIN_ALIASES[first]) return COMPANY_DOMAIN_ALIASES[first];
    if (first && first.length >= 4 && !PORTAL_DOMAINS[first]) return `${first}.com`;
  }

  const slug = extractEmployerSlugFromUrl(url);
  if (slug) {
    const slugKey = slug.replace(/[-_]/g, ' ');
    if (COMPANY_DOMAIN_ALIASES[slugKey]) return COMPANY_DOMAIN_ALIASES[slugKey];
    const compact = slug.replace(/[-_]/g, '');
    if (COMPANY_DOMAIN_ALIASES[compact]) return COMPANY_DOMAIN_ALIASES[compact];
    if (slug.length >= 3) return `${compact}.com`;
  }

  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    const portalHosts = Object.values(PORTAL_DOMAINS);
    if (host && !portalHosts.some((d) => host === d || host.endsWith(`.${d}`))) {
      const bare = host.replace(/^www\./, '');
      if (bare.split('.').length >= 2) return bare;
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function inferCompanyLogoUrls(company, url) {
  const domain = inferCompanyDomain(company, url);
  if (!domain) return { primary: null, fallback: null, domain: null };
  return {
    domain,
    primary: clearbitLogoUrl(domain),
    fallback: googleFaviconUrl(domain, 128),
  };
}

export function extractLogoCandidatesInBrowser() {
  const abs = (href) => {
    if (!href) return null;
    try {
      return new URL(href, window.location.href).href;
    } catch {
      return null;
    }
  };

  const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  const apple = document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
  const icon =
    document.querySelector('link[rel="icon"][sizes="32x32"]')?.getAttribute('href') ||
    document.querySelector('link[rel="icon"]')?.getAttribute('href');

  let jsonLd = null;
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const raw = JSON.parse(el.textContent || 'null');
      const items = Array.isArray(raw) ? raw : [raw];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const org = item.hiringOrganization || item.employer || item.organization;
        const logo = item.logo || org?.logo;
        if (typeof logo === 'string' && logo) {
          jsonLd = logo;
          break;
        }
        if (logo && typeof logo === 'object' && logo.url) {
          jsonLd = logo.url;
          break;
        }
      }
      if (jsonLd) break;
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  return {
    ogImage: abs(og),
    appleTouch: abs(apple),
    favicon: abs(icon),
    jsonLd: abs(jsonLd),
  };
}

export function isGenericOgImage(url) {
  const u = String(url || '').toLowerCase();
  return GENERIC_OG_HINTS.some((hint) => u.includes(hint));
}

export function pickCompanyLogoFromCandidates(candidates = {}) {
  if (candidates.jsonLd) return { url: candidates.jsonLd, source: 'json-ld' };
  if (candidates.ogImage && !isGenericOgImage(candidates.ogImage)) {
    return { url: candidates.ogImage, source: 'og-image' };
  }
  if (candidates.appleTouch) return { url: candidates.appleTouch, source: 'apple-touch-icon' };
  if (candidates.favicon) return { url: candidates.favicon, source: 'favicon' };
  return null;
}

export function resolveJobLogoFields(input = {}) {
  const portal_key = resolvePortalKey(input.url, input.source);
  const picked = input.scrapedLogo ? pickCompanyLogoFromCandidates(input.scrapedLogo) : null;

  if (picked?.url) {
    return {
      portal_key,
      logo_url: picked.url,
      logo_source: picked.source,
    };
  }

  const inferred = inferCompanyLogoUrls(input.company, input.url);
  if (inferred.primary) {
    return {
      portal_key,
      logo_url: inferred.primary,
      logo_source: 'company-clearbit',
    };
  }

  if (portal_key) {
    return {
      portal_key,
      logo_url: portalFaviconUrl(portal_key),
      logo_source: 'portal-favicon',
    };
  }

  return {
    portal_key: null,
    logo_url: null,
    logo_source: null,
  };
}
