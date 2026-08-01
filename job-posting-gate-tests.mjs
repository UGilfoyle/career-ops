/**
 * job-posting-gate unit tests — age / repost / ancient confirm rules.
 */
import assert from 'node:assert/strict';
import {
  analyzePostingHistory,
  formatPostingGateMessage,
  STALE_POSTING_DAYS,
  ANCIENT_POSTING_DAYS,
} from './job-posting-gate.mjs';

const now = new Date('2026-08-01T12:00:00Z');

const fresh = analyzePostingHistory(
  { most_probable_date: '2026-07-20', confidence: 'high', sources: { json_ld: '2026-07-20' } },
  now,
);
assert.equal(fresh.needs_confirm, false);
assert.equal(fresh.severity, 'fresh');

const stale = analyzePostingHistory(
  { most_probable_date: '2026-04-01', confidence: 'medium', sources: { json_ld: '2026-04-01' } },
  now,
);
assert.equal(stale.needs_confirm, true);
assert.equal(stale.severity, 'stale');
assert.ok((stale.age_days ?? 0) >= STALE_POSTING_DAYS);

const freshUnder3mo = analyzePostingHistory(
  { most_probable_date: '2026-06-15', confidence: 'high', sources: { json_ld: '2026-06-15' } },
  now,
);
assert.equal(freshUnder3mo.needs_confirm, false, 'under 3 months should not block');

const ancient = analyzePostingHistory(
  { most_probable_date: '2025-07-01', confidence: 'medium', sources: { wayback: '2025-07-01' } },
  now,
);
assert.equal(ancient.needs_confirm, true);
assert.equal(ancient.severity, 'ancient');
assert.ok((ancient.age_days ?? 0) >= ANCIENT_POSTING_DAYS);

const repost = analyzePostingHistory(
  {
    most_probable_date: '2026-07-15',
    confidence: 'low',
    explanation: 'Updated date newer than Wayback first capture',
    sources: {
      wayback: '2025-06-01',
      updated: '2026-07-15',
      json_ld: '2026-07-15',
    },
  },
  now,
);
assert.equal(repost.possible_repost, true);
assert.equal(repost.needs_confirm, true);
assert.ok(['repost', 'ancient'].includes(repost.severity));

const msg = formatPostingGateMessage({
  company: 'Acme',
  title: 'SWE',
  url: 'https://example.com/jobs/1',
  analysis: ancient,
});
assert.match(msg, /JOB POSTING CHECK/);
assert.match(msg, /Yes or No/i);
assert.match(msg, /1 year/i);

console.log('job-posting-gate-tests: ok');
