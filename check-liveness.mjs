#!/usr/bin/env node

import { chromium } from 'playwright';
import sql from './db/client.mjs';
import {
  checkUrlLiveness,
  jitteredDelayMs,
  newLivenessPage,
  sleep,
} from './liveness-browser.mjs';

/** Only hard-expired postings are removed. Uncertain / bot-wall / short pages stay. */
const HARD_DELETE_CODES = new Set(['http_gone', 'expired_url', 'expired_body']);

async function main() {
  console.log('Checking pending jobs against liveness-core (hard-expired only)...');

  const jobs = await sql`
    SELECT id, url, company
    FROM jobs
    WHERE id NOT IN (SELECT job_id FROM applications)
    ORDER BY score DESC
    LIMIT 20
  `;

  if (jobs.length === 0) {
    console.log('  No pending jobs found to check.');
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await newLivenessPage(browser);
  let deleted = 0;
  let skipped = 0;

  try {
    for (const [i, job] of jobs.entries()) {
      if (i > 0) await sleep(jitteredDelayMs(800));
      const { result, reason, code } = await checkUrlLiveness(page, job.url);
      const icon = { active: 'ok', expired: 'expired', uncertain: 'skip' }[result] || result;
      console.log(`${icon.padEnd(8)} ${String(job.company || '').padEnd(18)} ${code || ''} | ${job.url}`);

      if (result === 'expired' && HARD_DELETE_CODES.has(code)) {
        console.log(`         delete ${job.id}: ${reason}`);
        await sql`DELETE FROM jobs WHERE id = ${job.id}`;
        deleted += 1;
      } else if (result === 'expired') {
        console.log(`         keep ${job.id} (weak expire ${code}): ${reason}`);
        skipped += 1;
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`Done. deleted=${deleted} weak-expire-kept=${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
