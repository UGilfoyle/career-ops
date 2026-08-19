/** Portal + company logo helpers for dashboard UI (mirrors scripts/lib/job-logos.mjs). */

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

export function googleFaviconUrl(domain: string, size = 64): string | null {
  const d = String(domain || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  if (!d || !d.includes('.')) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=${size}`;
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

  if (portal_key) {
    return {
      portal_key,
      logo_url: portalFaviconUrl(portal_key),
      logo_source: 'portal-favicon',
    };
  }

  return { portal_key: null, logo_url: null, logo_source: null };
}

function isGenericOgImage(url?: string | null): boolean {
  const u = String(url || '').toLowerCase();
  const hints = [
    'default-share',
    'placeholder',
    'logo-linkedin',
    '/images/logo',
    'static.licdn.com/sc/h/',
  ];
  return hints.some((hint) => u.includes(hint));
}

/** Prefer cached DB logo; fall back to portal favicon; then company initial. */
export function resolveDisplayLogo(job: JobLogoProps): {
  imageUrl: string | null;
  portalKey: string | null;
  portalBadgeUrl: string | null;
  isPortalOnly: boolean;
} {
  const portalKey = job.portalKey || resolvePortalKey(job.url, job.source);
  const portalBadgeUrl = portalFaviconUrl(portalKey, 32);
  const cached = String(job.logoUrl || '').trim();

  if (cached && job.logoSource !== 'portal-favicon') {
    return { imageUrl: cached, portalKey, portalBadgeUrl, isPortalOnly: false };
  }

  if (cached && job.logoSource === 'portal-favicon') {
    return { imageUrl: cached, portalKey, portalBadgeUrl: cached, isPortalOnly: true };
  }

  if (portalBadgeUrl) {
    return { imageUrl: portalBadgeUrl, portalKey, portalBadgeUrl, isPortalOnly: true };
  }

  return { imageUrl: null, portalKey, portalBadgeUrl: null, isPortalOnly: false };
}
