#!/usr/bin/env node
/** Backfill portal_key + logo_url for existing jobs missing logo cache. */

import sql from './db/client.mjs';
import { resolveJobLogoFields } from './lib/job-logos.mjs';

const userIdArg = process.argv.find((a) => a.startsWith('--user='));
const userId = userIdArg ? Number.parseInt(userIdArg.split('=')[1], 10) : null;
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const rows = userId
    ? await sql`
        SELECT id, url, source, logo_url, logo_source, portal_key
        FROM jobs
        WHERE user_id = ${userId}
          AND (logo_url IS NULL OR portal_key IS NULL)
        ORDER BY created_at DESC
        LIMIT 2000
      `
    : await sql`
        SELECT id, url, source, logo_url, logo_source, portal_key
        FROM jobs
        WHERE logo_url IS NULL OR portal_key IS NULL
        ORDER BY created_at DESC
        LIMIT 2000
      `;

  let updated = 0;
  for (const row of rows) {
    const fields = resolveJobLogoFields({ url: row.url, source: row.source });
    if (!fields.logo_url && !fields.portal_key) continue;

    const needsUpdate =
      row.portal_key !== fields.portal_key ||
      row.logo_url !== fields.logo_url ||
      row.logo_source !== fields.logo_source;

    if (!needsUpdate) continue;

    if (dryRun) {
      console.log(`[dry-run] job ${row.id}:`, fields);
      updated++;
      continue;
    }

    await sql`
      UPDATE jobs
      SET portal_key = ${fields.portal_key},
          logo_url = ${fields.logo_url},
          logo_source = ${fields.logo_source}
      WHERE id = ${row.id}
    `;
    updated++;
  }

  console.log(`${dryRun ? 'Would update' : 'Updated'} ${updated} job(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
