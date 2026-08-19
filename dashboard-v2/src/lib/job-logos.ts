/** Shared company → logo resolution (mirrored in scripts/lib/job-logos.mjs). */

export const PORTAL_DOMAINS: Record<string, string> = {
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

export const PORTAL_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  naukri: 'Naukri',
  indeed: 'Indeed',
  hirist: 'Hirist',
  workable: 'Workable',
  greenhouse: 'Greenhouse',
  ashby: 'Ashby',
  lever: 'Lever',
  instahyre: 'Instahyre',
  flexiple: 'Flexiple',
  cutshort: 'Cutshort',
  'japan-dev': 'Japan Dev',
};

/** Normalized company name → corporate domain (extend as needed). */
export const COMPANY_DOMAIN_ALIASES: Record<string, string> = {
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
  morgan: 'morganstanley.com',
  'morgan stanley': 'morganstanley.com',
  qualcomm: 'qualcomm.com',
  salesforce: 'salesforce.com',
  stripe: 'stripe.com',
  uber: 'uber.com',
  walmart: 'walmart.com',
  zomato: 'zomato.com',
  swiggy: 'swiggy.com',
  flipkart: 'flipkart.com',
  razorpay: 'razorpay.com',
  phonepe: 'phonepe.com',
  paytm: 'paytm.com',
};

const GENERIC_OG_HINTS = [
  'default-share',
  'placeholder',
  'logo-linkedin',
  '/images/logo',
  'static.licdn.com/sc/h/',
];

export function normalizeCompanyKey(name?: string | null): string {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolvePortalKey(url?: string | null, source?: string | null): string | null {
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

export function googleFaviconUrl(domain: string, size = 128): string | null {
  const d = String(domain || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  if (!d || !d.includes('.')) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=${size}`;
}

export function clearbitLogoUrl(domain: string): string | null {
  const d = String(domain || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  if (!d || !d.includes('.')) return null;
  return `https://logo.clearbit.com/${encodeURIComponent(d)}`;
}

export function portalFaviconUrl(portalKey?: string | null, size = 64): string | null {
  const domain = portalKey ? PORTAL_DOMAINS[portalKey] : null;
  if (!domain) return null;
  return googleFaviconUrl(domain, size);
}

export function portalLabel(portalKey?: string | null): string | null {
  if (!portalKey) return null;
  return PORTAL_LABELS[portalKey] || portalKey;
}

/** Pull employer slug from Greenhouse / Lever / Ashby / Workable URLs. */
export function extractEmployerSlugFromUrl(url?: string | null): string | null {
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

export function inferCompanyDomain(company?: string | null, url?: string | null): string | null {
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
    if (first && first.length >= 4 && !PORTAL_DOMAINS[first as keyof typeof PORTAL_DOMAINS]) {
      return `${first}.com`;
    }
  }

  const slug = extractEmployerSlugFromUrl(url);
  if (slug) {
    const slugKey = slug.replace(/[-_]/g, ' ');
    if (COMPANY_DOMAIN_ALIASES[slugKey]) return COMPANY_DOMAIN_ALIASES[slugKey];
    if (COMPANY_DOMAIN_ALIASES[slug.replace(/[-_]/g, '')]) {
      return COMPANY_DOMAIN_ALIASES[slug.replace(/[-_]/g, '')];
    }
    if (!slug.includes('greenhouse') && slug.length >= 3) return `${slug.replace(/[-_]/g, '')}.com`;
  }

  try {
    const host = new URL(String(url || '')).hostname.toLowerCase();
    if (host && !Object.values(PORTAL_DOMAINS).some((d) => host === d || host.endsWith(`.${d}`))) {
      const bare = host.replace(/^www\./, '');
      if (bare.split('.').length >= 2) return bare;
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function inferCompanyLogoUrls(company?: string | null, url?: string | null): {
  primary: string | null;
  fallback: string | null;
  domain: string | null;
} {
  const domain = inferCompanyDomain(company, url);
  if (!domain) return { primary: null, fallback: null, domain: null };
  return {
    domain,
    primary: clearbitLogoUrl(domain),
    fallback: googleFaviconUrl(domain, 128),
  };
}

export function isGenericOgImage(url?: string | null): boolean {
  const u = String(url || '').toLowerCase();
  return GENERIC_OG_HINTS.some((hint) => u.includes(hint));
}

export type JobLogoProps = {
  company?: string | null;
  url?: string | null;
  source?: string | null;
  logoUrl?: string | null;
  portalKey?: string | null;
  logoSource?: string | null;
};

export function resolveJobLogoFields(input: {
  url?: string | null;
  source?: string | null;
  company?: string | null;
  scrapedLogo?: {
    jsonLd?: string | null;
    ogImage?: string | null;
    appleTouch?: string | null;
    favicon?: string | null;
  } | null;
}): { portal_key: string | null; logo_url: string | null; logo_source: string | null } {
  const portal_key = resolvePortalKey(input.url, input.source);
  const c = input.scrapedLogo;
  let picked: { url: string; source: string } | null = null;

  if (c?.jsonLd) picked = { url: c.jsonLd, source: 'json-ld' };
  else if (c?.ogImage && !isGenericOgImage(c.ogImage)) picked = { url: c.ogImage, source: 'og-image' };
  else if (c?.appleTouch) picked = { url: c.appleTouch, source: 'apple-touch-icon' };
  else if (c?.favicon) picked = { url: c.favicon, source: 'favicon' };

  if (picked?.url) {
    return { portal_key, logo_url: picked.url, logo_source: picked.source };
  }

  const inferred = inferCompanyLogoUrls(input.company, input.url);
  if (inferred.primary) {
    return { portal_key, logo_url: inferred.primary, logo_source: 'company-clearbit' };
  }

  if (portal_key) {
    return {
      portal_key,
      logo_url: portalFaviconUrl(portal_key),
      logo_source: 'portal-favicon',
    };
  }

  return { portal_key: null, logo_url: null, logo_source: null };
}

/** Prefer company logo; portal only as small badge. */
export function resolveDisplayLogo(job: JobLogoProps): {
  imageUrl: string | null;
  fallbackUrl: string | null;
  portalKey: string | null;
  portalBadgeUrl: string | null;
  isPortalOnly: boolean;
} {
  const portalKey = job.portalKey || resolvePortalKey(job.url, job.source);
  const portalBadgeUrl = portalFaviconUrl(portalKey, 32);
  const cached = String(job.logoUrl || '').trim();
  const cachedIsPortal = job.logoSource === 'portal-favicon';
  const inferred = inferCompanyLogoUrls(job.company, job.url);

  if (cached && !cachedIsPortal) {
    return {
      imageUrl: cached,
      fallbackUrl: inferred.fallback,
      portalKey,
      portalBadgeUrl,
      isPortalOnly: false,
    };
  }

  if (inferred.primary) {
    return {
      imageUrl: inferred.primary,
      fallbackUrl: inferred.fallback,
      portalKey,
      portalBadgeUrl,
      isPortalOnly: false,
    };
  }

  if (cached) {
    return {
      imageUrl: cached,
      fallbackUrl: null,
      portalKey,
      portalBadgeUrl: cached,
      isPortalOnly: cachedIsPortal,
    };
  }

  if (portalBadgeUrl) {
    return {
      imageUrl: portalBadgeUrl,
      fallbackUrl: null,
      portalKey,
      portalBadgeUrl,
      isPortalOnly: true,
    };
  }

  return { imageUrl: null, fallbackUrl: null, portalKey, portalBadgeUrl: null, isPortalOnly: false };
}
