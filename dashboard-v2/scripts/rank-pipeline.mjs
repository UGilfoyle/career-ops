import sql from './db/client.mjs';
import fs from 'fs';
import { scoreGccSignals } from '../../gcc-signal-engine.mjs';

const OUTPUT_JSON = 'data/current_eval.json';

const rawUserId = process.env.SCAN_USER_ID || 1;
const userId = Number.parseInt(String(rawUserId), 10);
if (!Number.isFinite(userId)) {
  throw new Error(`Invalid SCAN_USER_ID: ${rawUserId}`);
}

async function getKeywords() {
  const [profile] = await sql`SELECT targeting_keywords FROM user_profiles WHERE user_id = ${userId}`;
  return profile?.targeting_keywords || { positive: [], negative: [] };
}

function scoreJob(title, company, companyType, keywords) {
  const combined = ((title || '') + ' ' + (company || '')).toLowerCase();
  
  // 1. Negative checks
  const negativeKws = [...(keywords.negative || []), 'manager', 'director', 'vp'];
  const hasNegative = negativeKws.some(nw => combined.includes(nw.toLowerCase()));
  if (hasNegative) {
    return 0.0;
  }
  
  // 2. Positive checks
  const positiveKws = [...(keywords.positive || [])];
  if (positiveKws.length === 0) {
    positiveKws.push('software engineer', 'developer', 'engineer', 'backend', 'full-stack');
  }
  
  let matchedCount = 0;
  positiveKws.forEach(pw => {
    if (combined.includes(pw.toLowerCase())) {
      matchedCount++;
    }
  });
  
  // Seniority boost: if seniority matches, give small additional credit
  const seniorityKws = ['staff', 'principal', 'lead', 'senior', 'remote'];
  let seniorityMatches = 0;
  seniorityKws.forEach(sk => {
    if (combined.includes(sk)) seniorityMatches += 0.2;
  });
  
  const matchRatio = matchedCount / positiveKws.length;
  let score = (matchRatio * 8.0) + (seniorityMatches); // max 8.0 from keywords, max 1.0 from seniority = 9.0
  score = Math.min(10.0, score);
  
  // 3. GCC / Services adjustment
  if (companyType === 'GCC') {
    score = Math.min(10.0, score + 1.5); // GCC Boost
  } else if (companyType === 'Services') {
    score = Math.max(0.0, score - 3.0); // Services Penalty
  }
  
  return parseFloat(score.toFixed(1));
}

async function run() {
  console.log("🎯 Scoring jobs in the pipeline...");

  try {
    const keywords = await getKeywords();

    // Optimization: Only score/rank the most recent 500 jobs to keep it fast
    const jobs = await sql`
      SELECT id, url, company, title, source, company_type, jd_text FROM jobs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 500
    `;

    console.log(`  ✓ Fetched ${jobs.length} recent jobs from database for user ${userId}.`);
    if (jobs.length === 0) {
      console.log("  ⚠ No jobs found to score. Run 'scan' first.");
      process.exit(0);
    }

    console.log("  ⚡ Scoring in progress...");
    const scoredJobs = jobs.map(j => {
      const gcc = scoreGccSignals({
        company: j.company,
        title: j.title,
        jdText: j.jd_text || '',
        companyType: j.company_type,
      });
      return {
        ...j,
        score: scoreJob(j.title, j.company, j.company_type, keywords),
        gcc_signal_score: gcc.score,
        gcc_high_value: gcc.highValue,
      };
    });

    // push scores to db (Parallelized for speed)
    console.log("  💾 Saving scores...");
    await Promise.all(scoredJobs.map(j =>
      sql`UPDATE jobs SET score = ${j.score}, gcc_signal_score = ${j.gcc_signal_score}, gcc_high_value = ${j.gcc_high_value} WHERE id = ${j.id}`
    ));
    console.log("  ✓ Database updated.");

    // Rank by score descending
    scoredJobs.sort((a, b) => b.score - a.score);

    console.log('--- Ranked Jobs ---');

    const mapping = {};
    scoredJobs.forEach((job, index) => {
      const idx = index + 1;
      mapping[idx] = { 
        id: job.id,
        url: job.url, 
        company: job.company, 
        title: job.title, 
        source: job.source || 'Scanned',
        score: job.score 
      };
      const scoreStr = job.score > 0 ? `[Score: ${job.score}]` : `[Score: 0]`;
      // Print real job id for downstream commands (tailor/apply expect a DB job id or URL).
      console.log(`${String(job.id).padStart(5)}  (rank ${String(idx).padStart(3)})  ${scoreStr.padEnd(12)} ${job.company.substring(0,18).padEnd(19)} | ${job.title}`);
    });

    console.log('-------------------');
    console.log(`Done. Scored ${scoredJobs.length} jobs.`);

    // Save mapping for backward compatibility in auto-apply index lookup
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(mapping, null, 2));

  } catch (err) {
    console.error("❌ Ranking failed:", err.message);
  } finally {
    process.exit(0);
  }
}

run();
