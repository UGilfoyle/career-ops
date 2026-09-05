/**
 * newsletter-core.mjs — Shared helpers for monthly newsletter + referral codes.
 * Used by newsletter-monthly.mjs (GitHub Actions) without TypeScript.
 */
import { createHmac, randomBytes } from 'crypto';

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 8) {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  }
  return out;
}

function unsubSecret() {
  return (
    process.env.NEWSLETTER_UNSUB_SECRET
    || process.env.AUTH_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
  );
}

export function appBaseUrl() {
  const raw =
    process.env.APP_URL
    || process.env.NEXTAUTH_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || 'https://career-ops.vercel.app';
  return String(raw).replace(/\/$/, '');
}

export function createUnsubscribeToken(userId) {
  const secret = unsubSecret();
  if (!secret) throw new Error('NEWSLETTER_UNSUB_SECRET or AUTH_SECRET required');
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function referralSignupUrl(code) {
  return `${appBaseUrl()}/signup?ref=${encodeURIComponent(code)}`;
}

export function unsubscribeUrl(userId) {
  const token = createUnsubscribeToken(userId);
  return `${appBaseUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function ensureNewsletterSchema(sql) {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN DEFAULT true`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_unsubscribed_at TIMESTAMPTZ`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uidx
    ON users (referral_code)
    WHERE referral_code IS NOT NULL
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_sends (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      kind TEXT NOT NULL DEFAULT 'monthly',
      month_key TEXT NOT NULL,
      UNIQUE (user_id, month_key, kind)
    )
  `;
}

export async function ensureUserReferralCode(sql, userId) {
  const [row] = await sql`SELECT referral_code FROM users WHERE id = ${userId} LIMIT 1`;
  if (row?.referral_code) return String(row.referral_code);

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    try {
      const [updated] = await sql`
        UPDATE users
        SET referral_code = ${code}
        WHERE id = ${userId}
          AND (referral_code IS NULL OR referral_code = '')
        RETURNING referral_code
      `;
      if (updated?.referral_code) return String(updated.referral_code);
      const [again] = await sql`SELECT referral_code FROM users WHERE id = ${userId} LIMIT 1`;
      if (again?.referral_code) return String(again.referral_code);
    } catch {
      /* unique collision */
    }
  }
  throw new Error(`Could not allocate referral_code for user ${userId}`);
}

export function monthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function buildMonthlyEmailHtml({
  name,
  dashboardUrl,
  referralUrl,
  unsubscribeUrl: unsub,
  inactive,
}) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const headline = inactive
    ? 'Your job search pipeline is waiting'
    : 'Your Career-Ops monthly check-in';
  const intro = inactive
    ? `Hey ${first} — it’s been a quiet stretch. Your scan targets, tailored resumes, and Master Resume Studio are still ready when you are.`
    : `Hey ${first} — a quick monthly nudge from Career-Ops. Keep momentum with a scan, a deep tailor, or a Master Resume polish.`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Inter,Helvetica,Arial,sans-serif;margin:0;padding:0;background:#FAFAF8;">
  <div style="max-width:600px;margin:40px auto;padding:48px 40px;background:#fff;border:1px solid #E5E5E0;border-radius:32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
      <tr>
        <td align="center" style="width:56px;height:56px;background:#1C1C1E;border-radius:16px;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;">
            <polyline points="4 17 10 11 4 5"></polyline>
            <line x1="12" y1="19" x2="20" y2="19"></line>
          </svg>
        </td>
      </tr>
    </table>
    <h1 style="font-size:28px;font-weight:700;color:#1C1C1E;text-align:center;margin:0 0 12px;">${headline}</h1>
    <p style="font-size:15px;color:#6B6B6B;text-align:center;line-height:1.55;margin:0 0 28px;">${intro}</p>
    <ul style="color:#1C1C1E;font-size:14px;line-height:1.7;margin:0 0 28px;padding-left:20px;">
      <li><strong>Scan</strong> portals for roles that match your targeting keywords</li>
      <li><strong>Tailor</strong> an ATS-optimized resume + cover letter for a high-score job</li>
      <li><strong>Master Resume Studio</strong> — keep your canonical profile ready for every application</li>
    </ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="${dashboardUrl}" style="display:inline-block;background:#1C1C1E;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:14px;">Open Career-Ops</a>
    </div>
    <div style="background:#FAFAF8;border:1px solid #E5E5E0;border-radius:20px;padding:24px;margin:28px 0;text-align:center;">
      <h2 style="font-size:16px;margin:0 0 8px;color:#1C1C1E;">Refer your friends</h2>
      <p style="font-size:13px;color:#6B6B6B;margin:0 0 14px;line-height:1.5;">Know someone job hunting? Share Career-Ops so they can evaluate offers, generate tailored CVs, and track applications the same way you do.</p>
      <a href="${referralUrl}" style="word-break:break-all;font-size:12px;color:#1C1C1E;font-weight:600;">${referralUrl}</a>
    </div>
    <div style="border-top:1px solid #F5F5F0;margin-top:40px;padding-top:24px;text-align:center;">
      <p style="font-size:12px;color:#9CA3AF;line-height:1.6;">You received this because you use Career-Ops. We send at most one of these per month.</p>
      <p style="font-size:11px;color:#9CA3AF;"><a href="${unsub}" style="color:#6B6B6B;">Unsubscribe from monthly emails</a></p>
    </div>
  </div>
</body></html>`;
}


const FEATURE_ICONS = {
  'instant-tailor': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
  'copilot': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818CF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
  'multi-terminal': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
  'resume-studio': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
  'cloud-automation': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F472B6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>`,
};

const DEFAULT_FEATURE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path></svg>`;

const BADGE_COLORS = {
  Flagship: { bg: '#064E3B', text: '#34D399', border: '#059669' },
  Fast: { bg: '#312E81', text: '#A5B4FC', border: '#4F46E5' },
  New: { bg: '#0C4A6E', text: '#7DD3FC', border: '#0284C7' },
  Live: { bg: '#451A03', text: '#FCD34D', border: '#D97706' },
  Cloud: { bg: '#4A044E', text: '#F472B6', border: '#9333EA' },
  Improved: { bg: '#0F172A', text: '#94A3B8', border: '#334155' },
};

function featureCardHtml(feature) {
  const colors = BADGE_COLORS[feature.badge] || BADGE_COLORS.New;
  const iconSvg = FEATURE_ICONS[feature.id] || DEFAULT_FEATURE_ICON;
  return `
    <tr>
      <td style="padding:0 0 14px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#161F30;border:1px solid #243247;border-radius:16px;">
          <tr>
            <td style="padding:16px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="44" valign="top" style="padding-right:14px;">
                    <div style="width:42px;height:42px;background:#0F172A;border:1px solid #334155;border-radius:12px;text-align:center;line-height:42px;">
                      ${iconSvg}
                    </div>
                  </td>
                  <td valign="top">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <span style="font-size:15px;font-weight:700;color:#FFFFFF;letter-spacing:-0.01em;">${feature.title}</span>
                          <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;padding:2px 8px;border-radius:999px;background:${colors.bg};color:${colors.text};border:1px solid ${colors.border};margin-left:8px;vertical-align:middle;">
                            ${feature.badge}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:5px;font-size:13.5px;line-height:1.5;color:#94A3B8;">
                          ${feature.summary}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top:6px;font-size:12px;line-height:1.45;color:#64748B;">
                          ${feature.detail}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/** Product announcement email with horizontal architecture and executive dark palette. */
export function buildProductUpdateEmailHtml({
  name,
  release,
  dashboardUrl,
  signupUrl,
  referralUrl,
  unsubscribeUrl: unsub,
}) {
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';
  const features = Array.isArray(release?.features) ? release.features : [];
  const version = release?.version || 'v3.2';
  const tagline = release?.tagline || 'Major platform update';
  const headline = release?.headline || "What is new in Career-Ops";

  const featureRows = features.map(featureCardHtml).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#080C14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080C14;padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0F172A;border:1px solid #1E293B;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(180deg,#161F30 0%,#0F172A 100%);padding:36px 32px 28px;text-align:center;border-bottom:1px solid #1E293B;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;">
                <tr>
                  <td align="center" style="width:48px;height:48px;background:#0F172A;border:1px solid #334155;border-radius:14px;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;">
                      <polyline points="4 17 10 11 4 5"></polyline>
                      <line x1="12" y1="19" x2="20" y2="19"></line>
                    </svg>
                  </td>
                </tr>
              </table>
              <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#38BDF8;margin-bottom:8px;">${version} Product Release</div>
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#FFFFFF;line-height:1.3;letter-spacing:-0.02em;">${headline}</h1>
              <p style="margin:0;font-size:13.5px;line-height:1.55;color:#94A3B8;">${tagline}</p>
            </td>
          </tr>

          <!-- Intro Note -->
          <tr>
            <td style="padding:28px 28px 12px;">
              <p style="margin:0;font-size:14.5px;line-height:1.6;color:#FFFFFF;">Hi <strong>${first}</strong>,</p>
              <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#94A3B8;">
                We deployed major platform updates to Career-Ops. You now have instant 1-click resume tailoring, sub-second Copilot guidance, and a clean parallel dashboard. Zero configuration required on your side.
              </p>
            </td>
          </tr>

          <!-- Horizontal Highlight Metrics Bar -->
          <tr>
            <td style="padding:12px 28px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#161F30;border:1px solid #243247;border-radius:14px;text-align:center;">
                <tr>
                  <td width="33%" style="padding:14px 6px;border-right:1px solid #243247;">
                    <div style="font-size:17px;font-weight:700;color:#38BDF8;letter-spacing:-0.02em;">&lt; 60s</div>
                    <div style="font-size:10.5px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.04em;margin-top:2px;">1-Click Tailor</div>
                  </td>
                  <td width="33%" style="padding:14px 6px;border-right:1px solid #243247;">
                    <div style="font-size:17px;font-weight:700;color:#818CF8;letter-spacing:-0.02em;">Real-Time</div>
                    <div style="font-size:10.5px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.04em;margin-top:2px;">Career Copilot</div>
                  </td>
                  <td width="33%" style="padding:14px 6px;">
                    <div style="font-size:17px;font-weight:700;color:#34D399;letter-spacing:-0.02em;">Zero Config</div>
                    <div style="font-size:10.5px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.04em;margin-top:2px;">Cloud Automated</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Features (Horizontal Layout) -->
          <tr>
            <td style="padding:8px 28px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${featureRows}
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:16px 28px 28px;text-align:center;">
              <a href="${dashboardUrl}" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:14px 34px;border-radius:12px;box-shadow:0 4px 14px rgba(37,99,235,0.35);margin:0 6px 10px;">Open Career-Ops Dashboard</a>
            </td>
          </tr>

          <!-- Referral Card -->
          <tr>
            <td style="padding:0 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#161F30;border:1px solid #243247;border-radius:16px;">
                <tr>
                  <td style="padding:18px 20px;text-align:center;">
                    <div style="font-size:13.5px;font-weight:700;color:#FFFFFF;margin-bottom:6px;">Invite an Engineer</div>
                    <p style="margin:0 0 10px;font-size:12.5px;line-height:1.5;color:#94A3B8;">Know someone navigating job search? Share your referral link so they can evaluate roles and tailor resumes with your code pre-filled.</p>
                    <div style="display:inline-block;background:#0F172A;border:1px solid #334155;border-radius:8px;padding:6px 14px;">
                      <a href="${referralUrl}" style="font-size:12px;font-weight:600;color:#38BDF8;text-decoration:none;word-break:break-all;">${referralUrl}</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 28px;border-top:1px solid #1E293B;text-align:center;">
              <p style="margin:0 0 6px;font-size:11.5px;line-height:1.6;color:#64748B;">You are receiving this product update because you have an account on Career-Ops with email notifications enabled.</p>
              <p style="margin:0;font-size:11px;color:#64748B;"><a href="${unsub}" style="color:#94A3B8;text-decoration:underline;">Unsubscribe from emails</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:10px;color:#64748B;letter-spacing:0.05em;">Career-Ops - careerops.dpdns.org</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
/** Prefer authenticated custom domain — never freemail as default From. */
const DEFAULT_BREVO_SENDER = 'noreply@careerops.dpdns.org';

function sanitizeBrevoSenderEmail(raw) {
  if (!raw) return DEFAULT_BREVO_SENDER;
  let cleaned = String(raw).trim();
  // Strip accidental key=value paste into env value
  cleaned = cleaned.replace(/^[a-zA-Z0-9_]*brevo[a-zA-Z0-9_]*\s*=\s*/i, '').trim();
  cleaned = cleaned.replace(/^['"]|['"]$/g, '').trim();
  const match = cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : DEFAULT_BREVO_SENDER;
}

function sanitizeBrevoSenderName(raw) {
  let name = String(raw || 'Career-Ops').trim();
  name = name.replace(/^[a-zA-Z0-9_]*name\s*=\s*/i, '').replace(/^['"]|['"]$/g, '').trim();
  return name || 'Career-Ops';
}

/** Send via Brevo REST (no SDK required in Actions). */
export async function sendViaBrevo({ to, subject, htmlContent, textContent, unsubscribeUrl }) {
  const apiKey = process.env.BREVO_API_KEY || '';
  if (!apiKey) {
    console.warn('[newsletter] BREVO_API_KEY missing — skip send to', to);
    return false;
  }
  const senderEmail = sanitizeBrevoSenderEmail(process.env.BREVO_SENDER_EMAIL);
  const senderName = sanitizeBrevoSenderName(process.env.BREVO_SENDER_NAME);
  if (!senderEmail) {
    console.error('[newsletter] BREVO_SENDER_EMAIL missing.');
    return false;
  }

  // Generate plain text fallback if not provided (prevents MIME_HTML_ONLY spam penalty)
  const plainText = textContent || htmlContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const customHeaders = {};
  if (unsubscribeUrl) {
    customHeaders['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
    customHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    replyTo: { email: senderEmail, name: senderName },
    subject,
    htmlContent,
    textContent: plainText,
  };

  if (Object.keys(customHeaders).length > 0) {
    payload.headers = customHeaders;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[newsletter] Brevo ${res.status} for ${to}:`, text.slice(0, 300));
    return false;
  }
  return true;
}
