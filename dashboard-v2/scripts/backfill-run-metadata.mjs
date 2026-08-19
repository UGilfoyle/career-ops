#!/usr/bin/env node
/** Backfill action_type + job_id on historical background_runs / background_events. */

import sql from './db/client.mjs';
import { parseRunMetadata } from './lib/run-metadata.mjs';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await sql`
    ALTER TABLE background_runs
      ADD COLUMN IF NOT EXISTS job_id INTEGER,
      ADD COLUMN IF NOT EXISTS action_type TEXT,
      ADD COLUMN IF NOT EXISTS error_message TEXT,
      ADD COLUMN IF NOT EXISTS duration_ms INTEGER
  `;
  await sql`
    ALTER TABLE background_events
      ADD COLUMN IF NOT EXISTS job_id INTEGER,
      ADD COLUMN IF NOT EXISTS action_type TEXT
  `;

  const runs = await sql`
    SELECT id, action_script, action_args, action_type, job_id
    FROM background_runs
    WHERE action_type IS NULL OR job_id IS NULL
    ORDER BY queued_at DESC
    LIMIT 5000
  `;

  let updated = 0;
  for (const row of runs) {
    const meta = parseRunMetadata({
      actionScript: row.action_script,
      actionArgs: row.action_args,
    });
    const needsUpdate =
      row.action_type !== meta.action_type ||
      (meta.job_id != null && row.job_id !== meta.job_id);

    if (!needsUpdate) continue;

    if (dryRun) {
      console.log(`[dry-run] ${row.id}:`, meta);
      updated++;
      continue;
    }

    await sql`
      UPDATE background_runs
      SET action_type = ${meta.action_type},
          job_id = COALESCE(${meta.job_id}, job_id)
      WHERE id = ${row.id}
    `;
    updated++;
  }

  const events = await sql`
    SELECT id, action_script, action_args, action_type, job_id
    FROM background_events
    WHERE action_type IS NULL OR job_id IS NULL
    ORDER BY created_at DESC
    LIMIT 5000
  `;

  let eventsUpdated = 0;
  for (const row of events) {
    const meta = parseRunMetadata({
      actionScript: row.action_script,
      actionArgs: row.action_args,
    });
    if (row.action_type === meta.action_type && (meta.job_id == null || row.job_id === meta.job_id)) {
      continue;
    }
    if (dryRun) {
      eventsUpdated++;
      continue;
    }
    await sql`
      UPDATE background_events
      SET action_type = ${meta.action_type},
          job_id = COALESCE(${meta.job_id}, job_id)
      WHERE id = ${row.id}
    `;
    eventsUpdated++;
  }

  console.log(
    `${dryRun ? 'Would update' : 'Updated'} ${updated} background_runs, ${eventsUpdated} background_events.`,
  );
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
