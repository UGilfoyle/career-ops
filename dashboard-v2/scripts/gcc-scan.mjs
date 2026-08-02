// GCC-targeted scanner — hunts captive / GCC employers in India hubs (separate from generic `scan`)

import sql from './db/client.mjs';
import { classifyCompany, getGccScanBatch } from '../../gcc-classify.mjs';
import { scoreGccSignals } from '../../gcc-signal-engine.mjs';
import { discoverJobsWithoutBrowser } from './lib/ddg-discovery.mjs';

const rawUserId = process.env.SCAN_USER_ID || process.argv[2] || 1;
const userId = Number.parseInt(String(rawUserId), 10);
if (!Number.isFinite(userId)) {
  throw new Error(`Invalid SCAN_USER_ID: ${rawUserId}`);
}

const offsetArg = process.argv.find((a) => a.startsWith('--offset='));
const offset = offsetArg ? Number.parseInt(offsetArg.split('=')[1], 10) : new Date().getDate();

let keywords = { positive: [], negative: [] };
try {
  const [profile] = await sql`
    SELECT targeting_keywords FROM user_profiles WHERE user_id = ${userId}
  `;
  keywords = profile?.targeting_keywords || keywords;
} catch {
  // proceed with defaults
}

const primaryKeyword = (keywords.positive?.[0] || 'software engineer').toLowerCase();
const { batch, total, start, batchSize, locations } = getGccScanBatch({ offset });
const locClause = locations.map((l) => `"${l}"`).join(' OR ');

function matchesFilter(title) {
  const t = title.toLowerCase();
  for (const n of keywords.negative || []) {
    if (t.includes(String(n).toLowerCase())) return false;
  }
  const positive = keywords.positive?.length
    ? keywords.positive
    : ['software engineer', 'developer', 'backend', 'full stack'];
  return positive.some((p) => t.includes(String(p).toLowerCase()));
}

function buildQueries(company) {
  const quoted = company.includes(' ') ? `"${company}"` : company;
  return [
    {
      name: `${company} · LinkedIn`,
      query: `site:linkedin.com/jobs ${quoted} ${primaryKeyword} (${locClause})`,
      company,
    },
    {
      name: `${company} · Naukri`,
      query: `site:naukri.com ${quoted} ${primaryKeyword} ${locations[0] || 'Pune'}`,
      company,
    },
    {
      name: `${company} · Greenhouse`,
      query: `site:boards.greenhouse.io ${quoted} ${primaryKeyword} India`,
      company,
    },
  ];
}

const seenUrls = new Set();
try {
  const existing = await sql`SELECT url FROM jobs WHERE user_id = ${userId}`;
  existing.forEach((r) => seenUrls.add(r.url));
} catch {
  console.warn('⚠ Database dedup unavailable — continuing.');
}

const newJobs = [];
const stats = { checked: 0, found: 0, added: 0, filtered: 0, dup: 0, errors: 0 };

function tryAdd(url, company, title, source) {
  if (!url || !title) return 'skip';
  const cleanUrl = url.split('?')[0];
  if (seenUrls.has(url) || seenUrls.has(cleanUrl)) {
    stats.dup++;
    return 'dup';
  }
  if (!matchesFilter(title)) {
    stats.filtered++;
    return 'filtered';
  }
  const companyType = classifyCompany(company);
  if (companyType !== 'GCC') {
    stats.filtered++;
    return 'not_gcc';
  }
  seenUrls.add(url);
  newJobs.push({ url, canonical_url: cleanUrl, company, title, source, company_type: 'GCC' });
  stats.added++;
  return 'added';
}

async function persistAndScore() {
  if (newJobs.length === 0) return;

  try {
    await sql`
      ALTER TABLE jobs
        ADD COLUMN IF NOT EXISTS canonical_url TEXT,
        ADD COLUMN IF NOT EXISTS company_type TEXT,
        ADD COLUMN IF NOT EXISTS gcc_signal_score INTEGER,
        ADD COLUMN IF NOT EXISTS gcc_high_value BOOLEAN DEFAULT FALSE;
    `;
  } catch { /* ignore */ }

  for (const job of newJobs) {
    await sql`
      INSERT INTO jobs (url, canonical_url, company, title, source, user_id, company_type)
      VALUES (${job.url}, ${job.canonical_url}, ${job.company}, ${job.title}, ${job.source}, ${userId}, 'GCC')
      ON CONFLICT (user_id, url) DO NOTHING
    `;
  }

  const jobs = await sql`
    SELECT id, company, title, company_type, jd_text FROM jobs
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 500
  `;

  const scoreJob = (title, company) => {
    const combined = `${title || ''} ${company || ''}`.toLowerCase();
    const negativeKws = [...(keywords.negative || []), 'manager', 'director', 'vp'];
    if (negativeKws.some((nw) => combined.includes(String(nw).toLowerCase()))) return 0;

    const positiveKws = keywords.positive?.length
      ? keywords.positive
      : ['software engineer', 'developer', 'engineer', 'backend'];
    let matched = 0;
    positiveKws.forEach((pw) => {
      if (combined.includes(String(pw).toLowerCase())) matched++;
    });
    let scoreVal = (matched / positiveKws.length) * 8;
    if (/\b(senior|staff|principal|lead)\b/i.test(combined)) scoreVal += 1;
    return Math.min(10, parseFloat((scoreVal + 1.5).toFixed(1)));
  };

  await Promise.all(jobs.map((j) => {
    const gcc = scoreGccSignals({
      company: j.company,
      title: j.title,
      jdText: j.jd_text || '',
      companyType: j.company_type,
    });
    return sql`
      UPDATE jobs
      SET score = ${scoreJob(j.title, j.company)},
          gcc_signal_score = ${gcc.score},
          gcc_high_value = ${gcc.highValue}
      WHERE id = ${j.id}
    `;
  }));
}

async function run() {
  const startTime = Date.now();
  console.log('═══════════════════════════════════════════');
  console.log('  career-ops — GCC Scan (Captive Employers)');
  console.log(`  Keyword: ${primaryKeyword} · Hubs: ${locations.join(', ')}`);
  console.log(`  Batch: ${batch.length}/${total} companies (offset ${start})`);
  console.log('═══════════════════════════════════════════\n');

  const GLOBAL_TIMEOUT_MS = 5 * 60 * 1000;
  const timeoutId = setTimeout(() => {
    console.log('\n⏱ GLOBAL TIMEOUT — exiting gcc-scan');
    process.exit(0);
  }, GLOBAL_TIMEOUT_MS);

  try {
    for (let i = 0; i < batch.length; i++) {
      const company = batch[i];
      const queries = buildQueries(company);
      console.log(`\n🏢 [${i + 1}/${batch.length}] ${company}`);

      for (const q of queries) {
        stats.checked++;
        try {
          const results = await discoverJobsWithoutBrowser(q.query, q.name, { expectedCompany: q.company });
          stats.found += results.length;
          for (const j of results) {
            const res = tryAdd(j.url, j.company, j.title, `GCC Scan - ${q.name}`);
            if (res === 'added') {
              process.stdout.write(`    ✓ ${j.title.slice(0, 72)}\n`);
            }
          }
          await new Promise((r) => setTimeout(r, 1200));
        } catch (err) {
          stats.errors++;
          console.log(`    ✗ ${q.name}: ${err.message}`);
        }
      }
    }

    if (newJobs.length > 0) {
      console.log(`\n📦 Persisting ${newJobs.length} GCC job(s)...`);
      await persistAndScore();
    }

    await sql`
      INSERT INTO scans (portal, jobs_found, duration_ms, user_id)
      VALUES (${'GCC Scan'}, ${stats.found}, ${Date.now() - startTime}, ${userId})
    `;
  } finally {
    clearTimeout(timeoutId);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  GCC SCAN RESULTS');
  console.log('───────────────────────────────────────────');
  console.log(`  Queries run:        ${stats.checked}`);
  console.log(`  Links found:        ${stats.found}`);
  console.log(`  NEW GCC jobs added: ${stats.added}`);
  console.log(`  Filtered / dup:     ${stats.filtered + stats.dup}`);
  console.log(`  Errors:             ${stats.errors}`);
  console.log(`  Runtime:            ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log('═══════════════════════════════════════════');
  process.exit(0);
}

run().catch((err) => {
  console.error('GCC scan failed:', err);
  process.exit(1);
});
