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
    <div style="width:56px;height:56px;background:#1C1C1E;border-radius:16px;margin:0 auto 32px;"></div>
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

/** Send via Brevo REST (no SDK required in Actions). */
export async function sendViaBrevo({ to, subject, htmlContent }) {
  const apiKey = process.env.BREVO_API_KEY || '';
  if (!apiKey) {
    console.warn('[newsletter] BREVO_API_KEY missing — skip send to', to);
    return false;
  }
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || 'akash.k96.official@gmail.com').trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Career-Ops').trim();
  if (!senderEmail) {
    console.error('[newsletter] BREVO_SENDER_EMAIL missing.');
    return false;
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[newsletter] Brevo ${res.status} for ${to}:`, text.slice(0, 300));
    return false;
  }
  return true;
}
