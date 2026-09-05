#!/usr/bin/env node
/**
 * newsletter-product-update.mjs — One-time v3 product announcement to DB users.
 *
 * No Brevo contact list needed — sends transactional email per user via SMTP API.
 *
 * Env: DATABASE_URL, BREVO_API_KEY, BREVO_SENDER_EMAIL, APP_URL|NEXTAUTH_URL,
 *      NEWSLETTER_UNSUB_SECRET|AUTH_SECRET
 *
 * Dry run: NEWSLETTER_DRY_RUN=1
 * Force re-send (testing): NEWSLETTER_FORCE=1
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';
import {
  appBaseUrl,
  buildProductUpdateEmailHtml,
  ensureNewsletterSchema,
  ensureUserReferralCode,
  referralSignupUrl,
  sendViaBrevo,
  unsubscribeUrl,
} from './newsletter-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RELEASE_PATH = join(__dirname, 'dashboard-v2/src/content/release-v3.json');
const SEND_KIND = 'product-update-sept-2026-v2';

const cleanDbUrl = (process.env.DATABASE_URL || '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

const DELAY_MS = Number(process.env.NEWSLETTER_SEND_DELAY_MS || 400);
const DRY_RUN = process.env.NEWSLETTER_DRY_RUN === '1';
const FORCE = process.env.NEWSLETTER_FORCE === '1';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadRelease() {
  const raw = readFileSync(RELEASE_PATH, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const release = loadRelease();
  console.log('═══════════════════════════════════════════');
  console.log('  career-ops — Product Update Newsletter');
  console.log(`  Release: ${release.version} (${release.id})`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  console.log(`  Dry run: ${DRY_RUN}  Force: ${FORCE}`);
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
    const dashboardUrl = appBaseUrl();
    const signupUrl = `${dashboardUrl}/signup`;

    const targetUserIdsRaw = process.env.TARGET_USER_IDS || '24,25,26,27,29,30,31,32,33,53,56,59,60';
    const targetIds = targetUserIdsRaw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter(Boolean);

    let users;
    if (targetIds && targetIds.length > 0) {
      users = await sql`
        SELECT u.id::text AS id, u.name, u.email
        FROM users u
        WHERE u.id IN ${sql(targetIds)}
          AND u.email IS NOT NULL
          AND COALESCE(u.newsletter_opt_in, true) = true
        ORDER BY u.id
      `;
    } else {
      users = await sql`
        SELECT u.id::text AS id, u.name, u.email
        FROM users u
        WHERE u.email IS NOT NULL
          AND u.email_verified IS NOT NULL
          AND COALESCE(u.newsletter_opt_in, true) = true
        ORDER BY u.id
      `;
    }

    console.log(`Eligible users: ${users.length}`);
    console.log('Note: Recipients come from your database — no Brevo contact list required.');

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    const subject = `What is new in Career-Ops - ${release.tagline}`;

    for (const user of users) {
      const uid = String(user.id);

      if (!FORCE) {
        const [already] = await sql`
          SELECT id FROM newsletter_sends
          WHERE user_id = ${uid} AND kind = ${SEND_KIND}
          LIMIT 1
        `;
        if (already) {
          skipped += 1;
          continue;
        }
      }

      let code;
      try {
        code = await ensureUserReferralCode(sql, user.id);
      } catch (e) {
        console.error(`[release] referral code failed for ${user.email}:`, e?.message || e);
        failed += 1;
        continue;
      }

      const htmlContent = buildProductUpdateEmailHtml({
        name: user.name,
        release,
        dashboardUrl,
        signupUrl,
        referralUrl: referralSignupUrl(code),
        unsubscribeUrl: unsubscribeUrl(uid),
      });

      if (DRY_RUN) {
        console.log(`[dry-run] would send to ${user.email}`);
        sent += 1;
        continue;
      }

      const ok = await sendViaBrevo({
        to: user.email,
        subject,
        htmlContent,
        unsubscribeUrl: unsubscribeUrl(uid),
      });

      if (!ok) {
        failed += 1;
        await sleep(DELAY_MS);
        continue;
      }

      await sql`
        INSERT INTO newsletter_sends (user_id, kind, month_key)
        VALUES (${uid}, ${SEND_KIND}, ${release.id})
        ON CONFLICT (user_id, month_key, kind) DO NOTHING
      `;
      sent += 1;
      console.log(`[ok] ${user.email}`);
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
  console.error('Fatal product update newsletter error:', e);
  process.exit(1);
});
