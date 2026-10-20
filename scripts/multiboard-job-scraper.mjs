#!/usr/bin/env node

/**
 * multiboard-job-scraper.mjs — Multi-Board Job Sourcing & Aggregator Engine
 * Aggregates live jobs across multiple developer job boards & ATS platforms.
 * Parity with LoopCV multi-board sourcing.
 *
 * Usage:
 *   node scripts/multiboard-job-scraper.mjs --query "backend" --limit 20
 *   node scripts/multiboard-job-scraper.mjs --query "react" --remote --dry-run
 */

import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { analyzeJdProfileFit } from '../jd-profile-match.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * 1. RemoteOK Board Source
 */
async function fetchRemoteOk(query) {
  try {
    const data = await fetchWithTimeout('https://remoteok.com/api');
    if (!Array.isArray(data)) return [];
    const queryLower = query.toLowerCase();
    return data
      .slice(1) // first item is legal disclaimer
      .filter((item) => {
        const text = `${item.position || ''} ${item.tags?.join(' ') || ''} ${item.description || ''}`.toLowerCase();
        return text.includes(queryLower);
      })
      .map((item) => ({
        source: 'RemoteOK',
        company: item.company || 'Unknown',
        title: item.position || 'Software Engineer',
        url: item.url || `https://remoteok.com/l/${item.id}`,
        location: item.location || 'Remote',
        salary: item.salary_min && item.salary_max ? `$${item.salary_min}-$${item.salary_max}` : '',
        tags: item.tags || [],
        description: item.description || '',
      }));
  } catch (err) {
    console.warn(`[RemoteOK] Error fetching jobs: ${err.message}`);
    return [];
  }
}

/**
 * 2. Arbeitnow API Board Source
 */
async function fetchArbeitnow(query) {
  try {
    const data = await fetchWithTimeout(`https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`);
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.map((item) => ({
      source: 'Arbeitnow',
      company: item.company_name || 'Unknown',
      title: item.title || 'Engineer',
      url: item.url || '',
      location: item.remote ? 'Remote' : item.location || 'Worldwide',
      tags: item.tags || [],
      description: item.description || '',
    }));
  } catch (err) {
    console.warn(`[Arbeitnow] Error fetching jobs: ${err.message}`);
    return [];
  }
}

/**
 * 3. Himalayas API Board Source
 */
async function fetchHimalayas(query) {
  try {
    const data = await fetchWithTimeout(`https://himalayas.app/jobs/api?q=${encodeURIComponent(query)}`);
    const list = Array.isArray(data?.jobs) ? data.jobs : [];
    return list.map((item) => ({
      source: 'Himalayas',
      company: item.companyName || 'Unknown',
      title: item.title || 'Engineer',
      url: item.applicationUrl || `https://himalayas.app/companies/${item.companySlug}/jobs/${item.slug}`,
      location: item.locationRestrictions?.join(', ') || 'Remote',
      salary: item.minSalary && item.maxSalary ? `$${item.minSalary}-$${item.maxSalary}` : '',
      tags: item.categories || [],
      description: item.description || '',
    }));
  } catch (err) {
    console.warn(`[Himalayas] Error fetching jobs: ${err.message}`);
    return [];
  }
}

export async function aggregateJobs({ query = 'engineer', limit = 20 }) {
  console.log(`\n🌐 Fetching live roles across multiple boards for "${query}"...`);
  const [remoteOk, arbeitnow, himalayas] = await Promise.all([
    fetchRemoteOk(query),
    fetchArbeitnow(query),
    fetchHimalayas(query),
  ]);

  const all = [...remoteOk, ...arbeitnow, ...himalayas];
  console.log(`   ✓ Found: ${remoteOk.length} from RemoteOK, ${arbeitnow.length} from Arbeitnow, ${himalayas.length} from Himalayas`);
  console.log(`   ✓ Total candidates found: ${all.length}`);

  // Deduplicate by URL or Company+Title
  const seen = new Set();
  const deduped = [];
  for (const job of all) {
    const key = (job.url || `${job.company}-${job.title}`).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(job);
    }
    if (deduped.length >= limit) break;
  }
  return deduped;
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  let query = 'backend';
  let limit = 15;
  const dryRun = args.includes('--dry-run');

  const qIdx = args.indexOf('--query');
  if (qIdx !== -1 && args[qIdx + 1]) query = args[qIdx + 1];

  const lIdx = args.indexOf('--limit');
  if (lIdx !== -1 && args[lIdx + 1]) limit = Number.parseInt(args[lIdx + 1], 10) || 15;

  let profile = {};
  if (fs.existsSync('config/profile.yml')) {
    profile = parseYaml(fs.readFileSync('config/profile.yml', 'utf8'));
  }

  aggregateJobs({ query, limit }).then((jobs) => {
    console.log(`\n🎯 STAGED ${jobs.length} JOBS (Preview):`);
    console.log('--------------------------------------------------------------------------------');
    jobs.slice(0, 10).forEach((j, i) => {
      let fitScore = '—';
      if (j.description && profile?.candidate) {
        try {
          const fit = analyzeJdProfileFit(j.description, profile);
          fitScore = `${fit.honest?.length || 0} skills match`;
        } catch {}
      }
      console.log(`[${i + 1}] ${j.title} @ ${j.company} [${j.source}]`);
      console.log(`    Location: ${j.location} | Fit: ${fitScore}`);
      console.log(`    URL: ${j.url}`);
    });
    console.log('--------------------------------------------------------------------------------\n');
    if (dryRun) {
      console.log('Dry run complete. No tracker files modified.');
    } else {
      console.log(`Ready to stage into pipeline tracker with: cops add-job`);
    }
  });
}
