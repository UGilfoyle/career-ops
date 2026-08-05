/**
 * resume-contact-html.mjs — ATS-safe contact row with inline SVG icons (PDF/Playwright safe).
 */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeHref(raw) {
  const s = String(raw || '').trim();
  if (!s) return '#';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s)) return s;
  if (/@/.test(s) && !/\s/.test(s)) return `mailto:${s}`;
  if (/^\+?[\d\s().-]{8,}$/.test(s)) return `tel:${s.replace(/\s/g, '')}`;
  return `https://${s.replace(/^\/+/, '')}`;
}

function displayLink(raw) {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^mailto:/i, '')
    .replace(/\/$/, '');
}

/** Minimal outline icons — monochrome, print-safe (no brand colors). */
function strokeIcon(children) {
  return `<svg class="contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${children}</svg>`;
}

const ICONS = {
  location: strokeIcon(
    '<path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.25"/>',
  ),
  email: strokeIcon(
    '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="m3 7 9 6 9-6"/>',
  ),
  phone: strokeIcon(
    '<path d="M8.5 4h2l1.2 4.8a1 1 0 0 1-.52 1.08l-1.38.69a12.5 12.5 0 0 0 5.43 5.43l.69-1.38a1 1 0 0 1 1.08-.52L20 15.5v2a1 1 0 0 1-1 1A15 15 0 0 1 8 5a1 1 0 0 1 1-1z"/>',
  ),
  linkedin: strokeIcon(
    '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 11v6M8 8v.01M12 17v-4a2 2 0 0 1 4 0v4"/>',
  ),
  github: strokeIcon(
    '<path d="M9 19c-4 1.5-4-2.5-5-3m10 6v-1.5a3.5 3.5 0 0 0-1-2.6c3-.3 3-2.7 3-3.8 0-1.4-.5-2.5-1.4-3.4.1-.3.6-1.6-.1-3.2 0 0-1.1-.4-3.7 1.3a12.2 12.2 0 0 0-6.6 0C3.6 4.9 2.5 5.3 2.5 5.3c-.7 1.6-.2 2.9-.1 3.2-.9.9-1.4 2-1.4 3.4 0 1.1 0 3.5 3 3.8a3.5 3.5 0 0 0-1 2.6V21"/>',
  ),
  link: strokeIcon(
    '<path d="M10 13a3.5 3.5 0 0 0 5 0l1.5-1.5a3.5 3.5 0 0 0-5-5L10 8"/><path d="M14 11a3.5 3.5 0 0 0-5 0L7.5 12.5a3.5 3.5 0 0 0 5 5L14 16"/>',
  ),
};

function contactItem(iconKey, innerHtml) {
  const icon = ICONS[iconKey] || ICONS.link;
  return `<span class="contact-item">${icon}<span class="contact-text">${innerHtml}</span></span>`;
}

/**
 * @param {object} candidate — full_name, email, phone, location, linkedin, github, portfolio_url
 */
export function renderContactBarHtml(candidate = {}) {
  const c = candidate || {};
  const items = [];

  const location = String(c.location || '').trim();
  if (location) items.push(contactItem('location', escapeHtml(location)));

  const email = String(c.email || '').trim();
  if (email) {
    items.push(
      contactItem(
        'email',
        `<a href="${escapeHtml(normalizeHref(email))}">${escapeHtml(email)}</a>`,
      ),
    );
  }

  const phone = String(c.phone || '').trim();
  if (phone) {
    items.push(
      contactItem(
        'phone',
        `<a href="${escapeHtml(normalizeHref(phone))}">${escapeHtml(phone)}</a>`,
      ),
    );
  }

  const linkedin = String(c.linkedin || '').trim();
  if (linkedin) {
    items.push(
      contactItem(
        'linkedin',
        `<a href="${escapeHtml(normalizeHref(linkedin))}">${escapeHtml(displayLink(linkedin))}</a>`,
      ),
    );
  }

  const github = String(c.github || '').trim();
  if (github) {
    items.push(
      contactItem(
        'github',
        `<a href="${escapeHtml(normalizeHref(github))}">${escapeHtml(displayLink(github).replace(/^github\.com\//i, 'github.com/'))}</a>`,
      ),
    );
  } else {
    const portfolio = String(c.portfolio_url || '').trim();
    if (portfolio) {
      items.push(
        contactItem(
          'link',
          `<a href="${escapeHtml(normalizeHref(portfolio))}">${escapeHtml(displayLink(portfolio))}</a>`,
        ),
      );
    }
  }

  if (!items.length) return '';
  return `<div class="contact-bar">${items.join('')}</div>`;
}

/** Shared CSS snippet for icon contact bar — inject into template styles. */
export const CONTACT_BAR_CSS = `
        .contact-bar {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
            gap: 4px 16px;
            margin-top: 5px;
        }
        .contact-item {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 9pt;
            color: #1a1a1a;
            line-height: 1.35;
            white-space: nowrap;
        }
        .contact-icon {
            width: 10.5px;
            height: 10.5px;
            flex-shrink: 0;
            color: #111111;
            opacity: 1;
        }
        .contact-text a {
            color: #1a1a1a;
            text-decoration: none;
        }
        @media print {
            .contact-icon { color: #000; }
            .contact-item, .contact-text a { color: #000; }
        }
        .contact-bar:empty { display: none; }
`;
