#!/usr/bin/env node
/**
 * newsletter-monthly.mjs — Send monthly Career-Ops check-in + referral CTA.
 *
 * Env: DATABASE_URL, BREVO_API_KEY, APP_URL|NEXTAUTH_URL,
 *      NEWSLETTER_UNSUB_SECRET|AUTH_SECRET
 *
 * Dry run: NEWSLETTER_DRY_RUN=1
 */

import postgres from 'postgres';
import {
  appBaseUrl,
  buildMonthlyEmailHtml,
  ensureNewsletterSchema,
  ensureUserReferralCode,
  monthKey,
  referralSignupUrl,
  sendViaBrevo,
  unsubscribeUrl,
} from './newsletter-core.mjs';

const cleanDbUrl = (process.env.DATABASE_URL || '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

const INACTIVE_DAYS = 14;
const DELAY_MS = Number(process.env.NEWSLETTER_SEND_DELAY_MS || 400);
const DRY_RUN = process.env.NEWSLETTER_DRY_RUN === '1';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  career-ops — Monthly Newsletter');
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log('═══════════════════════════════════════════');

  if (!cleanDbUrl) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }

  if (!process.env.BREVO_API_KEY && !DRY_RUN) {
    console.warn('BREVO_API_KEY missing — nothing to send. Exiting 0.');
    process.exit(0);
  }

  if (!process.env.NEWSLETTER_UNSUB_SECRET && !process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
    console.error('NEWSLETTER_UNSUB_SECRET or AUTH_SECRET required for unsubscribe links');
    process.exit(1);
  }

  const sql = postgres(cleanDbUrl, {
    ssl: 'require',
    max: 3,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    await ensureNewsletterSchema(sql);
    const key = monthKey();
    const dashboardUrl = appBaseUrl();
    const cutoff = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);

    const users = await sql`
      SELECT
        u.id::text AS id,
        u.name,
        u.email,
        COALESCE(u.newsletter_opt_in, true) AS newsletter_opt_in,
        u.referral_code,
        (
          SELECT MAX(j.created_at)
          FROM jobs j
          WHERE j.user_id::text = u.id::text
        ) AS last_activity
      FROM users u
      WHERE u.email IS NOT NULL
        AND u.email_verified IS NOT NULL
        AND COALESCE(u.newsletter_opt_in, true) = true
      ORDER BY u.id
    `;

    console.log(`Eligible users: ${users.length}`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of users) {
      const uid = String(user.id);
      const [already] = await sql`
        SELECT id FROM newsletter_sends
        WHERE user_id = ${uid} AND month_key = ${key} AND kind = 'monthly'
        LIMIT 1
      `;
      if (already) {
        skipped += 1;
        continue;
      }

      let code;
      try {
        code = await ensureUserReferralCode(sql, user.id);
      } catch (e) {
        console.error(`[newsletter] referral code failed for ${user.email}:`, e?.message || e);
        failed += 1;
        continue;
      }

      const last = user.last_activity ? new Date(user.last_activity) : null;
      const inactive = !last || last < cutoff;
      const subject = inactive
        ? 'Your Career-Ops pipeline is waiting'
        : 'Your monthly Career-Ops check-in';

      const htmlContent = buildMonthlyEmailHtml({
        name: user.name,
        dashboardUrl,
        referralUrl: referralSignupUrl(code),
        unsubscribeUrl: unsubscribeUrl(uid),
        inactive,
      });

      if (DRY_RUN) {
        console.log(`[dry-run] would send to ${user.email} inactive=${inactive}`);
        sent += 1;
        continue;
      }

      const ok = await sendViaBrevo({
        to: user.email,
        subject,
        htmlContent,
      });

      if (!ok) {
        failed += 1;
        await sleep(DELAY_MS);
        continue;
      }

      await sql`
        INSERT INTO newsletter_sends (user_id, kind, month_key)
        VALUES (${uid}, 'monthly', ${key})
        ON CONFLICT (user_id, month_key, kind) DO NOTHING
      `;
      sent += 1;
      console.log(`[ok] ${user.email} (${inactive ? 're-engage' : 'digest'})`);
      await sleep(DELAY_MS);
    }

    console.log('═══════════════════════════════════════════');
    console.log(`  Sent: ${sent}  Skipped: ${skipped}  Failed: ${failed}`);
    console.log('═══════════════════════════════════════════');
  } finally {
    await sql.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error('Fatal newsletter error:', e);
  process.exit(1);
});
