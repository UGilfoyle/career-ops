import { BrevoClient } from '@getbrevo/brevo';

const brevo = new BrevoClient({ 
    apiKey: process.env.BREVO_API_KEY || ''
});

/** Prefer env; fallback to Brevo-verified sender so OTP never silently dies. */
const DEFAULT_SENDER_EMAIL = 'akash.k96.official@gmail.com';

const getSender = () => ({
  name: (process.env.BREVO_SENDER_NAME || 'Career-Ops').trim(),
  email: (process.env.BREVO_SENDER_EMAIL || DEFAULT_SENDER_EMAIL).trim(),
});

function assertSenderConfigured(context: string): { name: string; email: string } | null {
  const sender = getSender();
  if (sender.email) return sender;
  console.warn(`⚠️ No sender email for ${context}`);
  return null;
}

function emailShell(inner: string): string {
  return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #FAFAF8; }
            .container { max-width: 600px; margin: 40px auto; padding: 48px 40px; background-color: #ffffff; border: 1px solid #E5E5E0; border-radius: 32px; }
            .logo { width: 56px; height: 56px; background-color: #1C1C1E; border-radius: 16px; margin: 0 auto 32px auto; display: flex; align-items: center; justify-content: center; }
            .headline { font-size: 28px; font-weight: 700; color: #1C1C1E; text-align: center; margin-bottom: 12px; letter-spacing: -0.025em; }
            .subtext { font-size: 15px; color: #6B6B6B; text-align: center; margin-bottom: 32px; line-height: 1.55; }
            .cta { display: inline-block; background: #1C1C1E; color: #fff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 14px; }
            .bullets { color: #1C1C1E; font-size: 14px; line-height: 1.7; margin: 0 0 28px 0; padding-left: 20px; }
            .refer { background: #FAFAF8; border: 1px solid #E5E5E0; border-radius: 20px; padding: 24px; margin: 28px 0; text-align: center; }
            .refer h2 { font-size: 16px; margin: 0 0 8px 0; color: #1C1C1E; }
            .refer p { font-size: 13px; color: #6B6B6B; margin: 0 0 14px 0; line-height: 1.5; }
            .refer a.link { word-break: break-all; font-size: 12px; color: #1C1C1E; font-weight: 600; }
            .footer { border-top: 1px solid #F5F5F0; margin-top: 40px; padding-top: 24px; text-align: center; }
            .footer-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #9CA3AF; }
            .notice { font-size: 12px; color: #9CA3AF; line-height: 1.6; margin-bottom: 8px; }
            .unsub { font-size: 11px; color: #9CA3AF; }
            .unsub a { color: #6B6B6B; }
            .center { text-align: center; margin: 24px 0 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </div>
            ${inner}
          </div>
        </body>
        </html>
  `;
}

export const sendVerificationEmail = async (email: string, token: string) => {
  try {
    // Lead Engineer Note: Fallback to console for easier local debugging if key is placeholder
    if (!process.env.BREVO_API_KEY) {
      console.warn('⚠️ BREVO_API_KEY missing. Verification token for', email, 'is:', token);
      return;
    }
    if (!assertSenderConfigured('verification email')) {
      console.warn('Verification token for', email, 'is:', token);
      return;
    }

    const sender = getSender();
    const result = await brevo.transactionalEmails.sendTransacEmail({
      subject: "Career-Ops Identity Verification",
      htmlContent: emailShell(`
            <h1 class="headline">Verify Identity</h1>
            <p class="subtext">Enter the secure authentication code below to activate your Career-Ops dashboard and begin your agentic career scan.</p>
            <div style="background-color: #FAFAF8; border: 1px solid #E5E5E0; padding: 40px; border-radius: 32px; text-align: center; margin-bottom: 32px;">
              <span style="font-size: 52px; font-weight: 700; color: #1C1C1E; letter-spacing: 12px; margin-left: 12px;">${token}</span>
            </div>
            <div class="footer">
              <p class="notice">If you did not request this code, your identity remains secure. You can safely discard this transmission.</p>
              <div style="margin-top: 24px;">
                <span class="footer-tag">SaaS Infrastructure v2.0-modern</span>
              </div>
            </div>
      `),
      sender,
      to: [{ email }]
    });
    
    console.log('OTP Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to send OTP Email:', error);
    // Lead Engineer: Do NOT crash the registration flow if email fails. 
    // Log it and allow the user to see the "Check your email" page so they can try "Resend".
    return null; 
  }
};

export const sendPasswordResetEmail = async (email: string, token: string) => {
  return sendVerificationEmail(email, token);
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
  if (!assertSenderConfigured('monthly newsletter')) {
    return null;
  }

  const subject = inactive
    ? 'Your Career-Ops pipeline is waiting'
    : 'Your monthly Career-Ops check-in';

  const headline = inactive
    ? 'Your job search pipeline is waiting'
    : 'Your Career-Ops monthly check-in';

  const intro = inactive
    ? `Hey ${first} — it’s been a quiet stretch. Your scan targets, tailored resumes, and Master Resume Studio are still ready when you are.`
    : `Hey ${first} — a quick monthly nudge from Career-Ops. Keep momentum with a scan, a deep tailor, or a Master Resume polish.`;

  const htmlContent = emailShell(`
            <h1 class="headline">${headline}</h1>
            <p class="subtext">${intro}</p>
            <ul class="bullets">
              <li><strong>Scan</strong> portals for roles that match your targeting keywords</li>
              <li><strong>Tailor</strong> an ATS-optimized resume + cover letter for a high-score job</li>
              <li><strong>Master Resume Studio</strong> — keep your canonical profile ready for every application</li>
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
                <span class="footer-tag">Career-Ops · Monthly</span>
              </div>
            </div>
  `);

  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      subject,
      htmlContent,
      sender: getSender(),
      to: [{ email }],
    });
    console.log('Monthly newsletter sent:', email);
    return result;
  } catch (error) {
    console.error('Failed to send monthly newsletter:', email, error);
    return null;
  }
};
