import { BrevoClient } from '@getbrevo/brevo';

const brevo = new BrevoClient({ 
    apiKey: process.env.BREVO_API_KEY || ''
});

/** Prefer env; fallback to Brevo-verified sender with DKIM & DMARC configured. */
const DEFAULT_SENDER_EMAIL = 'noreply@careerops.dpdns.org';

function sanitizeSenderEmail(raw?: string): string {
  if (!raw) return DEFAULT_SENDER_EMAIL;
  let cleaned = raw.trim();
  // Strip accidental key=value prefix (e.g. if pasted "BREVO_SENDER_EMAIL=noreply@..." into Vercel value)
  cleaned = cleaned.replace(/^[a-zA-Z0-9_]*brevo[a-zA-Z0-9_]*\s*=\s*/i, '').trim();
  cleaned = cleaned.replace(/^['"]|['"]$/g, '').trim();
  const match = cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (match) {
    const email = match[0];
    // Freemail From → Gmail soft-bounces / spam; force authenticated domain sender.
    if (/@(gmail|googlemail|yahoo|outlook|hotmail|live)\./i.test(email)) {
      console.warn(
        `[mail] Rejecting freemail sender ${email}; using ${DEFAULT_SENDER_EMAIL}`
      );
      return DEFAULT_SENDER_EMAIL;
    }
    return email;
  }
  console.warn(
    `[mail] Invalid BREVO_SENDER_EMAIL=${JSON.stringify(raw)}; using ${DEFAULT_SENDER_EMAIL}`
  );
  return DEFAULT_SENDER_EMAIL;
}

const getSender = () => ({
  name: (process.env.BREVO_SENDER_NAME || 'Career-Ops')
    .trim()
    .replace(/^[a-zA-Z0-9_]*name\s*=\s*/i, '')
    .replace(/^['"]|['"]$/g, '') || 'Career-Ops',
  email: sanitizeSenderEmail(process.env.BREVO_SENDER_EMAIL),
});

function assertSenderConfigured(context: string): { name: string; email: string } | null {
  const sender = getSender();
  if (sender.email) return sender;
  console.warn(`⚠️ No sender email for ${context}`);
  return null;
}

function emailShell(inner: string): string {
  const appUrl = (process.env.NEXTAUTH_URL || process.env.APP_URL || 'https://careerops.dpdns.org').replace(/\/$/, '');
  return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #F5F5F0; }
            .wrap { max-width: 520px; margin: 0 auto; padding: 32px 16px 48px; }
            .card { background: #ffffff; border: 1px solid #E5E5E0; border-radius: 24px; padding: 40px 32px; }
            .brand { text-align: center; margin-bottom: 28px; }
            .brand-mark { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #1C1C1E; border-radius: 14px; margin-bottom: 12px; }
            .brand-name { font-size: 15px; font-weight: 700; color: #1C1C1E; letter-spacing: -0.02em; }
            .headline { font-size: 22px; font-weight: 700; color: #1C1C1E; text-align: center; margin: 0 0 10px; letter-spacing: -0.03em; }
            .subtext { font-size: 14px; color: #6B6B6B; text-align: center; margin: 0 0 28px; line-height: 1.6; }
            .code-wrap { background: #FAFAF8; border: 1px solid #E5E5E0; border-radius: 16px; padding: 24px 16px; text-align: center; margin-bottom: 24px; }
            .code { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 36px; font-weight: 700; color: #1C1C1E; letter-spacing: 0.35em; padding-left: 0.35em; }
            .expiry { font-size: 12px; color: #9CA3AF; text-align: center; margin: 0 0 24px; }
            .cta { display: inline-block; background: #1C1C1E; color: #fff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 12px; }
            .bullets { color: #1C1C1E; font-size: 14px; line-height: 1.7; margin: 0 0 28px 0; padding-left: 20px; }
            .refer { background: #FAFAF8; border: 1px solid #E5E5E0; border-radius: 16px; padding: 20px; margin: 24px 0; text-align: center; }
            .refer h2 { font-size: 15px; margin: 0 0 8px 0; color: #1C1C1E; }
            .refer p { font-size: 13px; color: #6B6B6B; margin: 0 0 12px 0; line-height: 1.5; }
            .refer a.link { word-break: break-all; font-size: 12px; color: #1C1C1E; font-weight: 600; }
            .footer { border-top: 1px solid #F0F0EB; margin-top: 28px; padding-top: 20px; text-align: center; }
            .notice { font-size: 12px; color: #9CA3AF; line-height: 1.6; margin: 0 0 8px; }
            .footer-link { font-size: 12px; color: #6B6B6B; text-decoration: none; font-weight: 600; }
            .unsub { font-size: 11px; color: #9CA3AF; }
            .unsub a { color: #6B6B6B; }
            .center { text-align: center; margin: 20px 0 8px; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="card">
              <div class="brand">
                <div class="brand-mark">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                </div>
                <div class="brand-name">Career-Ops</div>
              </div>
              ${inner}
            </div>
            <p style="text-align:center;font-size:11px;color:#9CA3AF;margin-top:20px;">
              <a href="${appUrl}" class="footer-link">${appUrl.replace(/^https?:\/\//, '')}</a>
            </p>
          </div>
        </body>
        </html>
  `;
}

export const sendVerificationEmail = async (email: string, token: string) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.warn('⚠️ BREVO_API_KEY missing. Verification token for', email, 'is:', token);
      return;
    }
    const sender = assertSenderConfigured('verification email');
    if (!sender) {
      console.warn('Verification token for', email, 'is:', token);
      return;
    }

    const textContent = `Confirm your Career-Ops account\n\nYour verification code is: ${token}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\nIf you did not create a Career-Ops account, you can safely ignore this email.`;

    const result = await brevo.transactionalEmails.sendTransacEmail({
      subject: 'Your Career-Ops verification code',
      sender,
      replyTo: sender,
      to: [{ email }],
      tags: ['auth-otp-verification'],
      textContent,
      htmlContent: emailShell(`
            <h1 class="headline">Confirm your email</h1>
            <p class="subtext">Enter this code on the verification page to finish setting up your account.</p>
            <div class="code-wrap">
              <span class="code">${token}</span>
            </div>
            <p class="expiry">This code expires in 10 minutes. Do not share it with anyone.</p>
            <div class="footer">
              <p class="notice">Didn't create a Career-Ops account? You can ignore this email - nothing will be changed.</p>
            </div>
      `),
    });
    
    console.log('OTP Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to send OTP Email:', error);
    return null; 
  }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.warn('⚠️ BREVO_API_KEY missing. Reset token for', email, 'is:', token);
      return;
    }
    const sender = assertSenderConfigured('password reset email');
    if (!sender) {
      console.warn('Reset token for', email, 'is:', token);
      return;
    }

    const textContent = `Reset your Career-Ops password\n\nYour password reset code is: ${token}\n\nThis code expires in 10 minutes. For security, never share this code.\n\nIf you did not request a password reset, you can safely ignore this email.`;

    return await brevo.transactionalEmails.sendTransacEmail({
      subject: 'Reset your Career-Ops password',
      sender,
      replyTo: sender,
      to: [{ email }],
      tags: ['auth-password-reset'],
      textContent,
      htmlContent: emailShell(`
            <h1 class="headline">Reset your password</h1>
            <p class="subtext">Use this code on the reset page. If you didn't request a reset, ignore this email.</p>
            <div class="code-wrap">
              <span class="code">${token}</span>
            </div>
            <p class="expiry">This code expires in 10 minutes.</p>
            <div class="footer">
              <p class="notice">For security, never share this code. Career-Ops will never ask for it by phone or chat.</p>
            </div>
      `),
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return null;
  }
};

export type MonthlyNewsletterParams = {
  email: string;
  name?: string | null;
  dashboardUrl: string;
  referralUrl: string;
  unsubscribeUrl: string;
  inactive: boolean;
};

export const sendMonthlyNewsletterEmail = async (params: MonthlyNewsletterParams) => {
  const { email, name, dashboardUrl, referralUrl, unsubscribeUrl, inactive } = params;
  const first = String(name || '').trim().split(/\s+/)[0] || 'there';

  if (!process.env.BREVO_API_KEY) {
    console.warn('⚠️ BREVO_API_KEY missing. Skipping monthly newsletter for', email);
    return null;
  }
  const sender = assertSenderConfigured('monthly newsletter');
  if (!sender) {
    return null;
  }

  const subject = inactive
    ? 'Your Career-Ops pipeline is waiting'
    : 'Your monthly Career-Ops check-in';

  const headline = inactive
    ? 'Your job search pipeline is waiting'
    : 'Your Career-Ops monthly check-in';

  const intro = inactive
    ? `Hey ${first} - it has been a quiet stretch. Your scan targets, tailored resumes, and Master Resume Studio are still ready when you are.`
    : `Hey ${first} - a quick monthly nudge from Career-Ops. Keep momentum with a scan, a deep tailor, or a Master Resume polish.`;

  const textContent = `${headline}\n\n${intro}\n\n- Scan portals for roles matching your target keywords\n- Tailor an ATS-optimized resume + cover letter\n- Master Resume Studio: keep your canonical profile ready\n\nOpen Career-Ops: ${dashboardUrl}\nRefer friends: ${referralUrl}\nUnsubscribe: ${unsubscribeUrl}`;

  const htmlContent = emailShell(`
            <h1 class="headline">${headline}</h1>
            <p class="subtext">${intro}</p>
            <ul class="bullets">
              <li><strong>Scan</strong> portals for roles that match your targeting keywords</li>
              <li><strong>Tailor</strong> an ATS-optimized resume + cover letter for a high-score job</li>
              <li><strong>Master Resume Studio</strong> - keep your canonical profile ready for every application</li>
            </ul>
            <div class="center">
              <a class="cta" href="${dashboardUrl}">Open Career-Ops</a>
            </div>
            <div class="refer">
              <h2>Refer your friends</h2>
              <p>Know someone job hunting? Share Career-Ops so they can evaluate offers, generate tailored CVs, and track applications the same way you do.</p>
              <a class="link" href="${referralUrl}">${referralUrl}</a>
            </div>
            <div class="footer">
              <p class="notice">You received this because you use Career-Ops. We send at most one of these per month.</p>
              <p class="unsub"><a href="${unsubscribeUrl}">Unsubscribe from monthly emails</a></p>
              <div style="margin-top: 20px;">
                <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#9CA3AF;">Career-Ops · Monthly</span>
              </div>
            </div>
  `);

  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      subject,
      sender,
      replyTo: sender,
      to: [{ email }],
      tags: ['newsletter-monthly'],
      textContent,
      htmlContent,
    });
    console.log('Monthly newsletter sent:', email);
    return result;
  } catch (error) {
    console.error('Failed to send monthly newsletter:', email, error);
    return null;
  }
};

export const sendProAccessEmail = async (
  email: string,
  name: string,
  accessLink: string,
  priceDisplay: string,
) => {
  const sender = assertSenderConfigured('Pro access email');
  if (!sender) return null;

  const textContent = `Your Career-Ops Pro access is ready\n\nHi ${name || 'there'}, thanks for subscribing (${priceDisplay}/month). Activate Pro access: ${accessLink}\n\nThis link expires in 7 days.\n\nFeatures:\n- Master resume editor + live ATS preview\n- PDF export & JD keyword match\n- Unlimited Career Copilot synced to your profile`;

  const htmlContent = emailShell(`
            <h1 class="headline">Your Pro access is ready</h1>
            <p class="subtext">Hi ${name || 'there'}, thanks for subscribing (${priceDisplay}/month). Use the link below to access <strong>Resume Studio</strong> and unlimited <strong>Career Copilot</strong>.</p>
            <div class="center">
              <a class="cta" href="${accessLink}">Activate Pro access</a>
            </div>
            <p class="expiry">This link expires in 7 days. If you're already logged in, you can also open Resume Studio from your dashboard after payment.</p>
            <ul class="bullets">
              <li>Master resume editor + live ATS preview</li>
              <li>PDF export & JD keyword match</li>
              <li>Copilot synced to your profile (10+ messages / 2hr on free plan)</li>
            </ul>
            <div class="footer">
              <p class="notice">If you didn't purchase Pro, ignore this email.</p>
            </div>
  `);

  try {
    return await brevo.transactionalEmails.sendTransacEmail({
      subject: 'Your Career-Ops Pro access link',
      sender,
      replyTo: sender,
      to: [{ email }],
      tags: ['billing-pro-access'],
      textContent,
      htmlContent,
    });
  } catch (error) {
    console.error('Failed to send Pro access email:', email, error);
    return null;
  }
};

export const sendUpiClaimAdminEmail = async (
  adminEmail: string,
  payload: {
    userEmail: string;
    amountInr: number;
    utr: string;
    transactionRef: string | null;
    approveUrl: string;
  },
) => {
  const sender = assertSenderConfigured('UPI claim admin email');
  if (!sender) return null;

  const textContent = `UPI payment to verify\n\n${payload.userEmail} submitted Rs. ${payload.amountInr} Pro payment.\nUTR: ${payload.utr}\nRef: ${payload.transactionRef || '-'}\n\nApprove: ${payload.approveUrl}`;

  const htmlContent = emailShell(`
            <h1 class="headline">UPI payment to verify</h1>
            <p class="subtext">${payload.userEmail} submitted ₹${payload.amountInr} Pro payment.</p>
            <ul class="bullets">
              <li><strong>UTR:</strong> ${payload.utr}</li>
              <li><strong>Ref:</strong> ${payload.transactionRef || '-'}</li>
            </ul>
            <p class="subtext">Check your statement, then approve if amount matches.</p>
            <div class="center">
              <a class="cta" href="${payload.approveUrl}">Approve Pro access</a>
            </div>
  `);

  try {
    return await brevo.transactionalEmails.sendTransacEmail({
      subject: `[Career-Ops] Verify UPI Rs. ${payload.amountInr} - ${payload.utr}`,
      sender,
      replyTo: sender,
      to: [{ email: adminEmail }],
      tags: ['billing-upi-admin'],
      textContent,
      htmlContent,
    });
  } catch (error) {
    console.error('Failed to send UPI admin email:', adminEmail, error);
    return null;
  }
};
