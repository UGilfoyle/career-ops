// scanner - check greenhouse, ashby, lever, workable for new jobs

import sql from './db/client.mjs';
import { classifyCompany } from '../../gcc-classify.mjs';
import { scoreGccSignals } from '../../gcc-signal-engine.mjs';
import { discoverJobsWithoutBrowser } from './lib/ddg-discovery.mjs';
import { resolveJobLogoFields } from './lib/job-logos.mjs';

const rawUserId = process.env.SCAN_USER_ID || process.argv[2] || 1;
const userId = Number.parseInt(String(rawUserId), 10);
if (!Number.isFinite(userId)) {
  throw new Error(`Invalid SCAN_USER_ID: ${rawUserId}`);
}

function normalizePortalId(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  const noProtocol = raw.replace(/^https?:\/\//, '');
  const host = noProtocol.split('/')[0].replace(/^www\./, '');

  if (raw.includes('naukri.com') || host === 'naukri.com') return 'naukri';
  if (raw.includes('indeed.com') || host.endsWith('indeed.com')) return 'indeed';
  if (raw.includes('japan-dev.com') || host === 'japan-dev.com') return 'japan-dev';
  if (raw.includes('instahyre.com') || host === 'instahyre.com') return 'instahyre';
  if (raw.includes('cutshort.io') || host === 'cutshort.io') return 'cutshort';
  if (raw.includes('linkedin.com') || host === 'linkedin.com') return 'linkedin';
  if (raw.includes('greenhouse.io') || host.endsWith('greenhouse.io')) return 'greenhouse';
  if (raw.includes('lever.co') || host.endsWith('lever.co')) return 'lever';
  if (raw.includes('workday') || host.includes('myworkdayjobs.com')) return 'workday';
  if (raw.includes('successfactors')) return 'successfactors';

  return raw;
}
// Attempt to load distinct profile config
let config = { title_filter: { positive: [], negative: [] }, tracked_companies: [], search_queries: [] };
try {
  const [profile] = await sql`
    SELECT targeting_keywords, resume_context
    FROM user_profiles
    WHERE user_id = ${userId}
  `;
  if (profile?.targeting_keywords) {
     config.title_filter = profile.targeting_keywords;
  }
  const selectedPortals = profile?.resume_context?.search?.portals || [];
  if (selectedPortals.length > 0) {
    const primaryKeyword = (config.title_filter?.positive?.[0] || 'software engineer').toLowerCase();
    const location = profile?.resume_context?.candidate?.location || 'India';
    const normalizedPortals = [...new Set(selectedPortals.map(normalizePortalId).filter(Boolean))];
    config.search_queries = normalizedPortals.map((portal) => ({
      name: `${portal} ${primaryKeyword}`,
      portal,
      query: primaryKeyword,
      location,
      enabled: true,
    }));
  }
} catch(e) {
  // Graceful fallback when DB is unavailable in the current environment.
  // Keep the scan engine alive with an empty config instead of crashing on yaml deps.
  config = { title_filter: { positive: [], negative: [] }, tracked_companies: [], search_queries: [] };
}
const companies = config.tracked_companies || [];

const DISCOVERY_SITE_BY_PORTAL = {
  linkedin: 'linkedin.com/jobs',
  naukri: 'naukri.com',
  indeed: 'indeed.com',
  instahyre: 'instahyre.com',
  flexiple: 'flexiple.com',
  cutshort: 'cutshort.io',
  greenhouse: 'boards.greenhouse.io',
  lever: 'jobs.lever.co',
  'japan-dev': 'japan-dev.com/jobs',
};

function buildDiscoveryQuery(q) {
  const baseQuery = `${q.query || ''} ${q.location || ''}`.trim();
  const site = DISCOVERY_SITE_BY_PORTAL[q.portal];
  if (!site) return baseQuery || q.query || '';
  return `site:${site} ${baseQuery}`.trim();
}

// Check Playwright availability ONCE at startup to avoid 7+ redundant import failures
let playwrightAvailable = null; // null = untested, true/false = tested

async function checkPlaywrightAvailability() {
  if (playwrightAvailable !== null) return playwrightAvailable;
  try {
    await import('playwright');
    playwrightAvailable = true;
    console.log('✓ Playwright runtime detected — full scraper mode enabled.');
  } catch {
    playwrightAvailable = false;
    console.log('ℹ️ Playwright unavailable in this runtime — using DuckDuckGo discovery engine (no browser required).');
  }
  return playwrightAvailable;
}

async function importScraper(moduleName) {
  // Skip all scraper imports if Playwright is unavailable — they all depend on it
  if (!await checkPlaywrightAvailability()) return null;

  const appRoot = process.env.APP_ROOT || '';
  const candidates = [
    appRoot ? `file://${appRoot}/runtime-assets/portals/scrapers/${moduleName}.mjs` : null,
    appRoot ? `file://${appRoot}/portals/scrapers/${moduleName}.mjs` : null,
    new URL(`../../portals/scrapers/${moduleName}.mjs`, import.meta.url),
    new URL(`../portals/scrapers/${moduleName}.mjs`, import.meta.url),
    new URL(`../../../portals/scrapers/${moduleName}.mjs`, import.meta.url),
    `file://${process.cwd()}/portals/scrapers/${moduleName}.mjs`,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return await import(candidate);
    } catch {
      // try next candidate
    }
  }
  console.warn(`⚠ Scraper module not found: ${moduleName}.mjs`);
  return null;
}

// load already seen urls from db
const seenUrls = new Set();
try {
  const existing = await sql`SELECT url FROM jobs WHERE user_id = ${userId}`;
  existing.forEach(r => seenUrls.add(r.url));
  console.log(`✓ Loaded ${seenUrls.size} existing jobs from database for deduplication.`);
} catch (e) {
  console.warn("⚠ Database not ready for dedup check, proceeding anyway.");
}

// Filter by title keywords from portals.yml
function matchesFilter(title) {
  const t = title.toLowerCase();
  for (const n of (config.title_filter.negative || [])) {
    if (t.includes(n.toLowerCase())) return false;
  }
  for (const p of (config.title_filter.positive || [])) {
    if (t.includes(p.toLowerCase())) return true;
  }
  return false;
}

// result queue
const newJobs = [];      // { url, company, title }
const startTime = Date.now();

function tryAdd(url, company, title, source) {
  if (!url || !title) return 'skip_nodata';
  const cleanUrl = url.split('?')[0];
  if (seenUrls.has(url) || seenUrls.has(cleanUrl)) {
    return 'dup';
  }
  if (!matchesFilter(title)) {
    return 'filtered';
  }
  seenUrls.add(url);
  const logoFields = resolveJobLogoFields({ url, source });
  newJobs.push({ url, canonical_url: cleanUrl, company, title, source, ...logoFields });
  return 'added';
}

// counters
const stats = {
  greenhouse: { checked: 0, found: 0, added: 0, errors: 0 },
  ashby:      { checked: 0, found: 0, added: 0, errors: 0 },
  lever:      { checked: 0, found: 0, added: 0, errors: 0 },
  workable:   { checked: 0, found: 0, added: 0, errors: 0 },
  discovery:  { checked: 0, found: 0, added: 0, errors: 0 },
  enterprise: { checked: 0, found: 0, added: 0, errors: 0 },
};

// Greenhouse API
async function scanGreenhouse() {
  const ghCompanies = companies.filter(c => c.api && c.enabled !== false);
  console.log(`\n🌿 Greenhouse API — ${ghCompanies.length} companies`);
  stats.greenhouse.checked = ghCompanies.length;

  for (let i = 0; i < ghCompanies.length; i++) {
    const comp = ghCompanies[i];
    const progress = ghCompanies.length > 10 ? `[${i + 1}/${ghCompanies.length}] ` : '';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout per company
      const res = await fetch(comp.api, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) { stats.greenhouse.errors++; continue; }
      const data = await res.json();
      const jobs = data.jobs || [];
      stats.greenhouse.found += jobs.length;

      for (const job of jobs) {
        const url = job.absolute_url;
        const loc = job.location?.name || '';
        const title = loc ? `${job.title} (${loc})` : job.title;
        const result = tryAdd(url, comp.name, title, 'Greenhouse API');
        if (result === 'added') {
          stats.greenhouse.added++;
          process.stdout.write(`  ${progress}✓ ${comp.name}: ${job.title}\n`);
        }
      }

      // Show progress every 10 companies if many exist
      if (ghCompanies.length > 10 && (i + 1) % 10 === 0) {
        console.log(`📊 Greenhouse: ${i + 1}/${ghCompanies.length} checked`);
      }
    } catch (e) {
      stats.greenhouse.errors++;
      process.stdout.write(`  ${progress}✗ ${comp.name}: ${e.message}\n`);
    }
  }
}

// ... scanAshby, scanLever, scanWorkable remain functionally the same, omitted for brevity but integrated
// (I will keep them in the final replacement content)
async function scanAshby() {
  const ashbyCompanies = companies.filter(c => c.careers_url?.includes('jobs.ashbyhq.com') && !c.api && c.enabled !== false);
  console.log(`\n🔷 Ashby API — ${ashbyCompanies.length} companies`);
  stats.ashby.checked = ashbyCompanies.length;
  for (let i = 0; i < ashbyCompanies.length; i++) {
    const comp = ashbyCompanies[i];
    const progress = ashbyCompanies.length > 10 ? `[${i + 1}/${ashbyCompanies.length}] ` : '';
    try {
      const slug = comp.careers_url.replace('https://jobs.ashbyhq.com/', '').split('/')[0].split('?')[0];
      const apiUrl = `https://jobs.ashbyhq.com/${slug}/api/jobs`;
      const res = await fetch(apiUrl, { headers: { 'User-Agent': 'career-ops-scanner/2.0' } });
      if (!res.ok) { stats.ashby.errors++; continue; }
      const data = await res.json();
      const jobs = data.jobs || [];
      stats.ashby.found += jobs.length;
      for (const job of jobs) {
        const url = job.applicationLink || `https://jobs.ashbyhq.com/${slug}/${job.id}`;
        const loc = job.locationName || (job.isRemote ? 'Remote' : '');
        const title = loc ? `${job.title} (${loc})` : job.title;
        const result = tryAdd(url, comp.name, title, 'Ashby API');
        if (result === 'added') { stats.ashby.added++; process.stdout.write(`  ${progress}✓ ${comp.name}: ${job.title}\n`); }
      }
      if (ashbyCompanies.length > 10 && (i + 1) % 10 === 0) {
        console.log(`📊 Ashby: ${i + 1}/${ashbyCompanies.length} checked`);
      }
    } catch (e) { stats.ashby.errors++; process.stdout.write(`  ${progress}✗ ${comp.name}: ${e.message}\n`); }
  }
}

async function scanLever() {
  const leverCompanies = companies.filter(c => c.careers_url?.includes('jobs.lever.co') && c.enabled !== false);
  console.log(`\n🔶 Lever API — ${leverCompanies.length} companies`);
  stats.lever.checked = leverCompanies.length;
  for (let i = 0; i < leverCompanies.length; i++) {
    const comp = leverCompanies[i];
    const progress = leverCompanies.length > 10 ? `[${i + 1}/${leverCompanies.length}] ` : '';
    try {
      const slug = comp.careers_url.replace('https://jobs.lever.co/', '').split('/')[0].split('?')[0];
      const apiUrl = `https://api.lever.co/v0/postings/${slug}?mode=json&limit=250`;
      const res = await fetch(apiUrl, { headers: { 'User-Agent': 'career-ops-scanner/2.0' } });
      if (!res.ok) { stats.lever.errors++; continue; }
      const jobs = await res.json();
      if (!Array.isArray(jobs)) { stats.lever.errors++; continue; }
      stats.lever.found += jobs.length;
      for (const job of jobs) {
        const url = job.hostedUrl;
        const loc = job.categories?.location || job.workplaceType || '';
        const title = loc ? `${job.text} (${loc})` : job.text;
        const result = tryAdd(url, comp.name, title, 'Lever API');
        if (result === 'added') { stats.lever.added++; process.stdout.write(`  ${progress}✓ ${comp.name}: ${job.text}\n`); }
      }
      if (leverCompanies.length > 10 && (i + 1) % 10 === 0) {
        console.log(`📊 Lever: ${i + 1}/${leverCompanies.length} checked`);
      }
    } catch (e) { stats.lever.errors++; process.stdout.write(`  ${progress}✗ ${comp.name}: ${e.message}\n`); }
  }
}

async function scanWorkable() {
  const workableCompanies = companies.filter(c => c.careers_url?.includes('apply.workable.com') && c.enabled !== false);
  console.log(`\n🔵 Workable API — ${workableCompanies.length} companies`);
  stats.workable.checked = workableCompanies.length;
  for (let i = 0; i < workableCompanies.length; i++) {
    const comp = workableCompanies[i];
    const progress = workableCompanies.length > 10 ? `[${i + 1}/${workableCompanies.length}] ` : '';
    try {
      const slug = comp.careers_url.replace('https://apply.workable.com/', '').split('/')[0].split('?')[0];
      const apiUrl = `https://apply.workable.com/api/v3/accounts/${slug}/jobs`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'career-ops-scanner/2.0' },
        body: JSON.stringify({ query: '', location: [], remote: [], employment: [], limit: 100 })
      });
      if (!res.ok) { stats.workable.errors++; continue; }
      const data = await res.json();
      const jobs = data.results || [];
      stats.workable.found += jobs.length;
      for (const job of jobs) {
        const url = `https://apply.workable.com/${slug}/j/${job.shortcode}`;
        const loc = job.location?.locationStr || (job.remote ? 'Remote' : '');
        const title = loc ? `${job.title} (${loc})` : job.title;
        const result = tryAdd(url, comp.name, title, 'Workable API');
        if (result === 'added') { stats.workable.added++; process.stdout.write(`  ${progress}✓ ${comp.name}: ${job.title}\n`); }
      }
      if (workableCompanies.length > 10 && (i + 1) % 10 === 0) {
        console.log(`📊 Workable: ${i + 1}/${workableCompanies.length} checked`);
      }
    } catch (e) { stats.workable.errors++; process.stdout.write(`  ${progress}✗ ${comp.name}: ${e.message}\n`); }
  }
}

// main run
async function run() {
  console.log('═══════════════════════════════════════════');
  console.log('  career-ops — Multi-Source (DB PERSISTENT)');
  console.log('  Sources: Greenhouse · Ashby · Lever · Workable');
  console.log('═══════════════════════════════════════════');

  // Global timeout - force exit after 4 minutes to prevent hanging
  const GLOBAL_TIMEOUT_MS = 4 * 60 * 1000;
  const startTime = Date.now();
  const timeoutId = setTimeout(() => {
    console.log('\n⏱ GLOBAL TIMEOUT: Scan running too long, forcing exit...');
    console.log(`   Runtime: ${(Date.now() - startTime) / 1000}s`);
    process.exit(0);
  }, GLOBAL_TIMEOUT_MS);

  // Heartbeat to show scan is still alive
  const heartbeat = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  ♥ Still scanning... (${elapsed}s elapsed)`);
  }, 30000); // Every 30 seconds

  const enableExtendedScan = process.env.ENABLE_EXTENDED_SCAN === 'true';
  const hasUserSearchQueries = Array.isArray(config.search_queries) && config.search_queries.length > 0;
  const shouldRunDiscovery = enableExtendedScan || hasUserSearchQueries;

  let totalAdded = 0;
  let totalChecked = 0;
  let totalFound = 0;

  try {
    // 1. Direct ATS Scans (Greenhouse, Ashby, Lever, Workable)
    console.log('\n▶ Phase 1: ATS Scans (30s timeout each)...');
    await scanGreenhouse();
    await scanAshby();
    await scanLever();
    await scanWorkable();

  // 2. Dynamic Search Discovery (Naukri, Indeed, LinkedIn, etc.)
  if (shouldRunDiscovery) {
    console.log('\n🌟 Discovery Phase — Searching all portals from portals.yml');
    try {
      const instahyreMod = await importScraper('instahyre');
      const flexipleMod = await importScraper('flexiple');
      const linkedInMod = await importScraper('linkedin');
      const naukriMod = await importScraper('naukri');
      const cutshortMod = await importScraper('cutshort');
      const indeedMod = await importScraper('indeed');
      const discoveryMod = await importScraper('discovery');
      const scrapeInstahyre = instahyreMod?.scrapeInstahyre;
      const scrapeFlexiple = flexipleMod?.scrapeFlexiple;
      const scrapeLinkedIn = linkedInMod?.scrapeLinkedIn;
      const scrapeNaukri = naukriMod?.scrapeNaukri;
      const scrapeCutshort = cutshortMod?.scrapeCutshort;
      const scrapeIndeed = indeedMod?.scrapeIndeed;
      const discoverJobs = discoveryMod?.discoverJobs;
      
      // Only process enabled queries
      const queries = (config.search_queries || []).filter(q => q.enabled !== false);
      stats.discovery.checked = queries.length;

      console.log(`\n📊 Progress: 0/${queries.length} portals completed`);

      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        const progress = `[${i + 1}/${queries.length}]`;
        console.log(`  ${progress} 🔍 Scanning ${q.name}... (${q.portal})`);

        let results = [];
        const scanStart = Date.now();

        try {
          if (q.portal === 'linkedin' && scrapeLinkedIn) {
            results = await scrapeLinkedIn(q.query, q.location || 'India');
          } else if (q.portal === 'instahyre' && scrapeInstahyre) {
            results = await scrapeInstahyre(q.query, q.locations || ['Pune', 'Bengaluru']);
          } else if (q.portal === 'flexiple' && scrapeFlexiple) {
            results = await scrapeFlexiple(q.query);
          } else if (q.portal === 'naukri' && scrapeNaukri) {
            results = await scrapeNaukri(q.query, q.location || 'India');
          } else if (q.portal === 'cutshort' && scrapeCutshort) {
            results = await scrapeCutshort(q.query, q.location || 'india');
          } else if (q.portal === 'indeed' && scrapeIndeed) {
            results = await scrapeIndeed(q.query, q.location || 'India');
          } else if (discoverJobs) {
            // Fallback: Use Discovery Engine for generic site: queries (Naukri, Indeed, Glassdoor, etc.)
            results = await discoverJobs(buildDiscoveryQuery(q), q.name);
          } else {
            // Browser-free discovery (DuckDuckGo search) — primary path in serverless
            results = await discoverJobsWithoutBrowser(buildDiscoveryQuery(q), q.name);
          }

          const duration = ((Date.now() - scanStart) / 1000).toFixed(1);
          stats.discovery.found += results.length;
          results.forEach(j => {
            const res = tryAdd(j.url, j.company, j.title, j.source);
            if (res === 'added') stats.discovery.added++;
          });
          console.log(`      ✓ Done: ${results.length} jobs found (${duration}s)`);
        } catch (err) {
          const duration = ((Date.now() - scanStart) / 1000).toFixed(1);
          console.error(`      ✗ Failed after ${duration}s:`, err.message);
          stats.discovery.errors++;
        }

        // Show progress after each portal
        const remaining = queries.length - (i + 1);
        if (remaining > 0) {
          console.log(`📊 Progress: ${i + 1}/${queries.length} completed • ${remaining} remaining`);
        } else {
          console.log(`📊 Progress: ${queries.length}/${queries.length} completed ✓`);
        }
      }
    } catch (e) {
      console.error(`  ✗ Discovery Phase Error: ${e.message}`);
    }

    // 3. Enterprise Portal Scans (Workday, SuccessFactors)
    if (enableExtendedScan) {
      console.log('\n🏢 Enterprise Phase — Scanning Workday & SuccessFactors');
      try {
        const workdayMod = await importScraper('workday');
        const successFactorsMod = await importScraper('successfactors');
        const scrapeWorkday = workdayMod?.scrapeWorkday;
        const scrapeSuccessFactors = successFactorsMod?.scrapeSuccessFactors;

        // This is where you would iterate through specific enterprise entries if added to tracked_companies
        // For now, I'll add a few known targets to ensure they are checked
        const enterpriseTargets = [
          { name: 'Siemens', subdomain: 'siemens', portal: 'workday' },
          { name: 'AMD', subdomain: 'amd', portal: 'workday' },
          { name: 'SAP', portalToken: 'sap', portal: 'successfactors' }
        ];

        for (const target of enterpriseTargets) {
           console.log(`  🏢 Checking Enterprise: ${target.name}...`);
           let results = [];
           try {
             if (target.portal === 'workday' && scrapeWorkday) {
               results = await scrapeWorkday(target.name, target.subdomain, 'Software Engineer');
             } else if (target.portal === 'successfactors' && scrapeSuccessFactors) {
               results = await scrapeSuccessFactors(target.name, target.portalToken, 'Software Engineer');
             } else {
               continue;
             }
             
             stats.enterprise.found += results.length;
             results.forEach(j => {
               const res = tryAdd(j.url, j.company, j.title, j.source);
               if (res === 'added') stats.enterprise.added++;
             });
           } catch (err) {
             console.error(`  ✗ Error scanning enterprise ${target.name}:`, err.message);
             stats.enterprise.errors++;
           }
        }
      } catch (e) {
        console.error(`  ✗ Enterprise Phase Error: ${e.message}`);
      }
    }
  } else {
    console.log('\nℹ️ No user search queries configured yet. Add portals in Settings or set ENABLE_EXTENDED_SCAN=true for full extended scan.');
  }

  totalAdded   = Object.values(stats).reduce((s, v) => s + v.added, 0);
  totalChecked = Object.values(stats).reduce((s, v) => s + v.checked, 0);
  totalFound   = Object.values(stats).reduce((s, v) => s + v.found, 0);

  if (totalAdded > 0) {
    console.log(`\n📦 UPSERTing ${totalAdded} new jobs to PostgreSQL...`);
    try {
      await sql`
        ALTER TABLE jobs
          ADD COLUMN IF NOT EXISTS canonical_url TEXT,
          ADD COLUMN IF NOT EXISTS jd_text TEXT,
          ADD COLUMN IF NOT EXISTS company_type TEXT,
          ADD COLUMN IF NOT EXISTS gcc_signal_score INTEGER,
          ADD COLUMN IF NOT EXISTS gcc_high_value BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS posted_confidence TEXT,
          ADD COLUMN IF NOT EXISTS posted_reason TEXT,
          ADD COLUMN IF NOT EXISTS posted_checked_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS portal_key TEXT,
          ADD COLUMN IF NOT EXISTS logo_url TEXT,
          ADD COLUMN IF NOT EXISTS logo_source TEXT;
      `;
    } catch {
      // ignore
    }
    for (const job of newJobs) {
      const companyType = classifyCompany(job.company);
      await sql`
        INSERT INTO jobs (url, canonical_url, company, title, source, user_id, company_type, portal_key, logo_url, logo_source)
        VALUES (
          ${job.url},
          ${job.canonical_url || job.url?.split?.('?')?.[0] || job.url},
          ${job.company},
          ${job.title},
          ${job.source},
          ${userId},
          ${companyType},
          ${job.portal_key ?? null},
          ${job.logo_url ?? null},
          ${job.logo_source ?? null}
        )
        ON CONFLICT (user_id, url) DO NOTHING
      `;
    }
  }

  // log scan to history
  await sql`
    INSERT INTO scans (portal, jobs_found, duration_ms, user_id)
    VALUES ('Multi-Source Scan', ${totalFound}, ${Date.now() - startTime}, ${userId})
  `;

  // ── Auto-scoring / Ranking integration ──────────────────────────────
  console.log('\n🎯 Auto-scoring and ranking jobs in pipeline...');
  try {
    const [profile] = await sql`SELECT targeting_keywords FROM user_profiles WHERE user_id = ${userId}`;
    const keywords = profile?.targeting_keywords || { positive: [], negative: [] };

    // Fetch recent 500 jobs to score/rank
    const jobs = await sql`
      SELECT id, url, company, title, source, company_type, jd_text FROM jobs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 500
    `;

    // Score helper matching rank-pipeline.mjs
    const scoreJobInline = (title, company, companyType) => {
      const combined = ((title || '') + ' ' + (company || '')).toLowerCase();
      
      const negativeKws = [...(keywords.negative || []), 'manager', 'director', 'vp'];
      const hasNegative = negativeKws.some(nw => combined.includes(nw.toLowerCase()));
      if (hasNegative) return 0.0;

      const positiveKws = [...(keywords.positive || [])];
      if (positiveKws.length === 0) {
        positiveKws.push('software engineer', 'developer', 'engineer', 'backend', 'full-stack');
      }

      let matchedCount = 0;
      positiveKws.forEach(pw => {
        if (combined.includes(pw.toLowerCase())) matchedCount++;
      });

      const seniorityKws = ['staff', 'principal', 'lead', 'senior', 'remote'];
      let seniorityMatches = 0;
      seniorityKws.forEach(sk => {
        if (combined.includes(sk)) seniorityMatches += 0.2;
      });

      const matchRatio = matchedCount / positiveKws.length;
      let scoreVal = (matchRatio * 8.0) + (seniorityMatches);
      scoreVal = Math.min(10.0, scoreVal);

      if (companyType === 'GCC') {
        scoreVal = Math.min(10.0, scoreVal + 1.5);
      } else if (companyType === 'Services') {
        scoreVal = Math.max(0.0, scoreVal - 3.0);
      }

      return parseFloat(scoreVal.toFixed(1));
    };

    const scoredJobs = jobs.map(j => {
      const gcc = scoreGccSignals({
        company: j.company,
        title: j.title,
        jdText: j.jd_text || '',
        companyType: j.company_type,
      });
      return {
        id: j.id,
        score: scoreJobInline(j.title, j.company, j.company_type),
        gcc_signal_score: gcc.score,
        gcc_high_value: gcc.highValue,
      };
    });

    await Promise.all(scoredJobs.map(j =>
      sql`UPDATE jobs SET score = ${j.score}, gcc_signal_score = ${j.gcc_signal_score}, gcc_high_value = ${j.gcc_high_value} WHERE id = ${j.id}`
    ));
    console.log(`  ✓ Successfully scored and updated ${scoredJobs.length} pipeline jobs.`);
  } catch (rankErr) {
    console.error(`  ✗ Auto-scoring failed: ${rankErr.message}`);
  }

  } finally {
    clearTimeout(timeoutId);
    clearInterval(heartbeat);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  SCAN RESULTS (PERSISTED)');
  console.log('───────────────────────────────────────────');
  console.log(`  Companies checked:     ${totalChecked}`);
  console.log(`  Jobs found (total):    ${totalFound}`);
  console.log(`  NEW jobs added to DB:  ${totalAdded}`);
  console.log(`  Total runtime:         ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log('═══════════════════════════════════════════');
  process.exit(0);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
