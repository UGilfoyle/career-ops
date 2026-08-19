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

const GENERIC_OG_HINTS = [
  'default-share',
  'placeholder',
  'logo-linkedin',
  '/images/logo',
  'static.licdn.com/sc/h/',
];

/**
 * @param {string | null | undefined} url
 * @param {string | null | undefined} source
 * @returns {string | null}
 */
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

/**
 * @param {string | null | undefined} portalKey
 * @param {number} [size]
 */
export function portalFaviconUrl(portalKey, size = 64) {
  const domain = portalKey ? PORTAL_DOMAINS[portalKey] : null;
  if (!domain) return null;
  return googleFaviconUrl(domain, size);
}

/**
 * @param {string | null | undefined} domain
 * @param {number} [size]
 */
export function googleFaviconUrl(domain, size = 64) {
  const d = String(domain || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  if (!d || !d.includes('.')) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=${size}`;
}

/**
 * Browser-side extractor — pass to page.evaluate().
 * @returns {{ ogImage: string | null, appleTouch: string | null, favicon: string | null, jsonLd: string | null }}
 */
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

/**
 * @param {string | null | undefined} url
 */
export function isGenericOgImage(url) {
  const u = String(url || '').toLowerCase();
  return GENERIC_OG_HINTS.some((hint) => u.includes(hint));
}

/**
 * @param {{ jsonLd?: string | null, ogImage?: string | null, appleTouch?: string | null, favicon?: string | null }} candidates
 * @returns {{ url: string, source: string } | null}
 */
export function pickCompanyLogoFromCandidates(candidates = {}) {
  if (candidates.jsonLd) return { url: candidates.jsonLd, source: 'json-ld' };
  if (candidates.ogImage && !isGenericOgImage(candidates.ogImage)) {
    return { url: candidates.ogImage, source: 'og-image' };
  }
  if (candidates.appleTouch) return { url: candidates.appleTouch, source: 'apple-touch-icon' };
  if (candidates.favicon) return { url: candidates.favicon, source: 'favicon' };
  return null;
}

/**
 * @param {{ url?: string, source?: string, scrapedLogo?: object | null, company?: string }} input
 * @returns {{ portal_key: string | null, logo_url: string | null, logo_source: string | null }}
 */
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

  // Scanned jobs without HTML: cache portal favicon so UI still shows board branding.
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
