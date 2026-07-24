#!/usr/bin/env node
// add-job.mjs - Scrape, score, and add a single job URL to the database

import sql from './db/client.mjs';
import { chromium } from 'playwright';
import {
  isIndeedUrl,
  canonicalIndeedUrl,
  fetchIndeedJob,
} from './indeed-job.mjs';

const url = process.argv[2];
const userId = process.env.SCAN_USER_ID || 1;

if (!url) {
  console.error('Usage: node add-job.mjs <job_url>');
  process.exit(1);
}

// Calculate ATS-like score based on JD vs profile keywords
function calculateJobScore(jdText, profile) {
  const jdLower = (jdText || '').toLowerCase();
  const superpowers = profile?.narrative?.superpowers || [];
  const positiveKeywords = profile?.targeting_keywords?.positive || [];
  const negativeKeywords = profile?.targeting_keywords?.negative || [];

  let score = 5; // Base score

  // Positive matches
  for (const kw of positiveKeywords) {
    if (jdLower.includes(kw.toLowerCase())) score += 1;
  }

  // Superpowers match
  for (const sp of superpowers) {
    const words = sp.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && jdLower.includes(word)) score += 0.5;
    }
  }

  // Negative penalty
  for (const kw of negativeKeywords) {
    if (jdLower.includes(kw.toLowerCase())) score -= 2;
  }

  return Math.max(0, Math.min(10, Math.round(score)));
}

function canonicalJobUrl(url) {
  try {
    const u = new URL(String(url).trim());
    u.hash = '';
    // Indeed: stable id is jk=… (viewjob / rc/clk / pagead)
    if (isIndeedUrl(u.toString())) {
      return canonicalIndeedUrl(u.toString());
    }
    // LinkedIn: stable id lives in path; strip tracking query params
    if (u.hostname.includes('linkedin.com')) {
      const currentJobId = u.searchParams.get('currentJobId');
      if (currentJobId) {
        return `https://www.linkedin.com/jobs/view/${currentJobId}`;
      }
      if (u.pathname.includes('/jobs/view/')) {
        u.search = '';
      }
    }
    return u.toString();
  } catch {
    return String(url || '').split('?')[0];
  }
}

// Heuristic parse for LinkedIn public job pages (body text varies by locale / auth wall)
function extractLinkedInCompanyTitle(jdText, url) {
  if (!url.includes('linkedin.com')) return { company: null, title: null };
  const head = String(jdText || '').slice(0, 6000);
  // Document title / hero often: "Co hiring Role — Remote | LinkedIn"
  const hiring = head.match(
    /^[^\n]*\b([^\n|]{2,80}?)\s+hiring\s+([^\n|]+?)(?:\s+[-—]\s*(?:Remote|Hybrid|On-site)[^\n|]*)?(?:\s*\||\s*$)/im
  );
  if (hiring) {
    const company = hiring[1].replace(/\s+/g, ' ').trim();
    let title = hiring[2].replace(/\s+/g, ' ').trim();
    title = title.replace(/\s+[-—]\s+Remote in .+$/i, '').trim();
    if (company.length >= 2 && title.length >= 4) return { company, title };
  }
  const lines = String(jdText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const skip = (l) =>
    /^(skip to|sign in|join now|apply|save|report|get ai|email or phone|password|new to linkedin)/i.test(l) ||
    l.length < 2;

  const good = lines.filter((l) => !skip(l));

  let title = null;
  let company = null;

  for (let i = 0; i < Math.min(good.length, 50); i++) {
    const line = good[i];
    if (
      !title &&
      /(engineer|developer|manager|architect|lead|remote|contract|full[\s-]?stack|software|data|product|devops)/i.test(line) &&
      line.length < 140
    ) {
      title = line.replace(/\s+/g, ' ').trim();
      continue;
    }
    if (title && !company && line.length > 1 && line.length < 100) {
      // Often: "Kake · Spain" or "Kake Spain" or "Company Name"
      if (line === title) continue;
      const c = line.split('·')[0].split('|')[0].trim();
      if (c && c.toLowerCase() !== title.toLowerCase()) {
        company = c;
        break;
      }
    }
  }

  return { company, title };
}

// Extract company name from URL (non-LinkedIn)
function extractCompanyFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');
    if (hostname.includes('linkedin.com')) return 'LinkedIn Job';
    if (hostname.includes('ashbyhq.com') || hostname.includes('greenhouse.io')) {
      const match = url.match(/\/([^/]+)\/\d+/);
      if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
    if (parts.length >= 2) {
      return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
    }
  } catch (e) {
    // ignore
  }
  return 'Unknown Company';
}

// Extract job title from JD text (first line or heading)
function extractTitleFromJd(jdText) {
  if (!jdText) return 'Unknown Role';
  const lines = jdText.split('\n').filter(l => l.trim());
  // Look for common title patterns
  for (const line of lines.slice(0, 20)) {
    const trimmed = line.trim();
    if (/\b(engineer|developer|manager|architect|lead|director|head|vp)\b/i.test(trimmed)) {
      if (trimmed.length < 100) return trimmed;
    }
  }
  return lines[0]?.slice(0, 100) || 'Unknown Role';
}

// Scrape JD using Playwright
async function scrapeJD(url) {
  console.log(`🌐 Scraping job description from: ${url}`);

  // Indeed: desktop viewjob is Cloudflare-gated — use mobile embedded JSON
  if (isIndeedUrl(url)) {
    console.log('🎯 Indeed URL detected. Fetching via mobile embedded endpoint…');
    try {
      const job = await fetchIndeedJob(url);
      console.log(
        `✅ Indeed JD extracted (${job.text.length} chars) — ${job.company} / ${job.title}`
      );
      return {
        company: job.company,
        title: job.title,
        text: job.text,
      };
    } catch (err) {
      console.warn(`⚠️ Indeed mobile fetch failed: ${err.message}. Falling back to Playwright.`);
    }
  }

  // Intercept BambooHR URLs to fetch clean JSON details directly
  let bhrSubdomain = null;
  let bhrJobId = null;
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname.endsWith('bamboohr.com')) {
      bhrSubdomain = parsedUrl.hostname.split('.')[0];
      if (parsedUrl.pathname.startsWith('/careers/')) {
        const parts = parsedUrl.pathname.split('/');
        bhrJobId = parts[2];
      } else if (parsedUrl.pathname === '/jobs/view.php') {
        bhrJobId = parsedUrl.searchParams.get('id');
      }
    }
  } catch (err) {
    // Ignore URL parsing errors
  }

  if (bhrSubdomain && bhrJobId) {
    const detailUrl = `https://${bhrSubdomain}.bamboohr.com/careers/${bhrJobId}/detail`;
    console.log(`🎯 BambooHR URL detected. Fetching JSON detail from: ${detailUrl}`);
    try {
      const res = await fetch(detailUrl, { 
        headers: { 
          'User-Agent': 'career-ops-tailor/1.0',
          'Accept': 'application/json'
        } 
      });
      if (res.ok) {
        const json = await res.json();
        const title = json.result?.jobOpening?.jobOpeningName || '';
        const department = json.result?.jobOpening?.departmentLabel || '';
        const descriptionHtml = json.result?.jobOpening?.description || '';
        
        // Convert descriptionHtml to clean plain text
        const descriptionText = descriptionHtml
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/\n\s*\n/g, '\n\n')
          .trim();
          
        const text = `Job Title: ${title}\nDepartment: ${department}\n\nDescription:\n${descriptionText}`;
        console.log(`✅ Successfully extracted job description via BambooHR detail API (${text.length} chars).`);
        return {
          company: bhrSubdomain,
          title: title,
          text: text
        };
      }
    } catch (err) {
      console.warn(`⚠️ BambooHR detail API request failed: ${err.message}. Falling back to default Playwright scraper.`);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Detect login/sign-in walls
    const pageUrl = page.url();
    const pageTitle = await page.title();
    const pageTitleLower = pageTitle.toLowerCase();
    
    const isLoginRedirect = pageUrl.includes('/login') || 
                            pageUrl.includes('/checkpoint/lg/') || 
                            pageUrl.includes('/signup');
    
    const isLoginTitle = /sign\s*in|log\s*in|login|authwall|security\s*verification|join\s*linkedin/i.test(pageTitleLower);
    
    const isLoginForm = await page.evaluate(() => {
      const hasPassword = !!document.querySelector('input[type="password"]') || 
                          !!document.querySelector('form[action*="/login"]') ||
                          !!document.querySelector('.authwall-join-form') ||
                          (document.body.innerText.includes('Sign in to see') && document.body.innerText.includes('Password'));
      
      const hasJobDescription = !!document.querySelector('[data-testid="job-description"]') || 
                                 !!document.querySelector('.job-description') || 
                                 !!document.querySelector('#job-description') ||
                                 !!document.querySelector('.description__text') ||
                                 !!document.querySelector('.show-more-less-html__markup') ||
                                 !!document.querySelector('.jobs-description-content') ||
                                 !!document.querySelector('.jobs-box__html-content');
      
      return hasPassword && !hasJobDescription;
    });



    if (isLoginRedirect || isLoginTitle || isLoginForm) {
      throw new Error(
        `LinkedIn Login Wall / Private URL detected. The URL requested requires authentication.\n` +
        `Please copy the Job Description text from your browser manually, save it to a text file, and use the --file option:\n` +
        `  node add-job.mjs "${url}" --file ./jd.txt`
      );
    }

    let linkedInMeta = { company: null, title: null };
    try {
      const u = new URL(url);
      if (u.hostname.includes('linkedin.com')) {
        linkedInMeta = await page.evaluate(() => {
          const title =
            document.querySelector('h1')?.innerText?.trim() ||
            document.querySelector('.jobs-unified-top-card__job-title')?.innerText?.trim() ||
            null;
          const companyEl =
            document.querySelector('.jobs-unified-top-card__company-name a') ||
            document.querySelector('.jobs-unified-top-card__company-name') ||
            document.querySelector('a[href*="/company/"]');
          const company = companyEl?.innerText?.trim() || null;
          return { company, title };
        });
      }
    } catch {
      // ignore DOM parse failures
    }

    // Indeed-specific DOM (Playwright fallback)
    if (isIndeedUrl(url)) {
      try {
        const indeedText = await page.evaluate(() => {
          const el =
            document.getElementById('jobDescriptionText') ||
            document.querySelector('.jobsearch-JobComponent-description') ||
            document.querySelector('[data-testid="jobsearch-JobComponent-description"]');
          return el ? el.innerText : '';
        });
        if (indeedText && indeedText.length > 200) {
          const meta = await page.evaluate(() => {
            const title =
              document.querySelector('h1.jobsearch-JobInfoHeader-title')?.innerText?.trim() ||
              document.querySelector('h1')?.innerText?.trim() ||
              null;
            const company =
              document.querySelector('[data-company-name="true"]')?.innerText?.trim() ||
              document.querySelector('[data-testid="inlineHeader-companyName"]')?.innerText?.trim() ||
              null;
            return { company, title };
          });
          await browser.close();
          return { ...meta, text: indeedText.trim() };
        }
      } catch {
        // continue to generic selectors
      }
    }

    // Try to find JD in common containers first
    const selectors = [
      '[data-testid="job-description"]',
      '.job-description',
      '#job-description',
      '#jobDescriptionText',
      '.jobsearch-JobComponent-description',
      '[class*="description"]',
      'main',
      'article'
    ];

    let jdText = '';
    for (const selector of selectors) {
      try {
        const el = await page.$(selector);
        if (el) {
          jdText = await el.innerText();
          if (jdText.length > 200) break;
        }
      } catch {}
    }

    // Fallback to body text
    if (!jdText || jdText.length < 200) {
      jdText = await page.evaluate(() => document.body.innerText);
    }

    await browser.close();
    const text = jdText.trim();

    // Detect anti-bot block pages (Cloudflare, hCaptcha, Indeed, etc.)
    const blockSignals = [
      'request blocked',
      'you have been blocked',
      'ray id for this request',
      'cloudflare',
      'hcaptcha',
      'verify you are human',
      'access denied',
      'just a moment',
      'checking your browser',
      'please complete the security check',
      'unusual traffic',
      'additional verification required',
      'security check - indeed',
    ];
    const lower = text.toLowerCase();
    const isBlocked = blockSignals.some(s => lower.includes(s)) || text.length < 150;
    if (isBlocked) {
      throw new Error(
        `Anti-bot block detected (scraped only ${text.length} chars). ` +
        `Copy the JD text manually and use: node add-job.mjs "<url>" --file ./jd.txt`
      );
    }

    const meta = { ...linkedInMeta, text };
    return meta;
  } catch (err) {
    await browser.close();
    throw new Error(`Scrape failed: ${err.message}`);
  }
}

async function main() {
  // Auto-heal database: clean up existing garbage login-wall entries
  try {
    const deletedGarbage = await sql`
      DELETE FROM jobs
      WHERE user_id = ${userId}
        AND (
          title ILIKE 'Sign in%'
          OR title ILIKE 'Log in%'
          OR title ILIKE 'Security Verification%'
          OR company = 'LinkedIn Job' AND title = 'Sign in'
        )
      RETURNING id, company, title;
    `;
    if (deletedGarbage.length > 0) {
      console.log(`🧹 Auto-healed: Deleted ${deletedGarbage.length} garbage login/auth wall job entries from database:`);
      deletedGarbage.forEach(g => console.log(`   - Deleted: ${g.company} — ${g.title} (ID: ${g.id})`));
    }
  } catch (err) {
    console.warn(`[WARNING] Failed to run garbage cleanup query: ${err.message}`);
  }

  const rawUrl = String(url).trim();
  const canonical = canonicalJobUrl(rawUrl);
  console.log(`➕ Adding job: ${rawUrl}`);
  console.log(`   Canonical: ${canonical}`);

  // Dedupe by canonical URL or exact URL
  const existing = await sql`
    SELECT id FROM jobs
    WHERE user_id = ${userId}
      AND (url = ${rawUrl} OR url = ${canonical} OR canonical_url = ${canonical})
    LIMIT 1
  `;
  if (existing.length > 0) {
    console.log(`⚠️ Job already exists in database (ID: ${existing[0].id})`);
    console.log(`   Run: tailor ${existing[0].id} --deep`);
    process.exit(0);
  }

  // Load user profile for scoring
  const [profileRow] = await sql`
    SELECT resume_context, targeting_keywords FROM user_profiles WHERE user_id = ${userId}
  `;
  if (!profileRow) {
    console.error('❌ Profile not found. Please complete your profile in Settings first.');
    process.exit(1);
  }

  const profile = {
    ...profileRow.resume_context,
    targeting_keywords: profileRow.targeting_keywords || { positive: [], negative: [] }
  };

  // Scrape JD or read from file
  let jdText = '';
  let scrape = { text: '', company: null, title: null };

  const fileFlagIndex = process.argv.indexOf('--file');
  if (fileFlagIndex > -1 && process.argv[fileFlagIndex + 1]) {
    const filePath = process.argv[fileFlagIndex + 1];
    console.log(`📄 Reading job description from file: ${filePath}`);
    import('fs').then(fs => {
      try {
        jdText = fs.readFileSync(filePath, 'utf-8');
        scrape.text = jdText;
        console.log(`✓ Read ${jdText.length} characters from file`);
        finishAddingJob(scrape, rawUrl, canonical, jdText, profile);
      } catch (err) {
        console.error(`❌ Failed to read file: ${err.message}`);
        process.exit(1);
      }
    });
  } else {
    try {
      scrape = await scrapeJD(canonical);
      console.log(`✓ Scraped ${scrape.text.length} characters`);
      jdText = scrape.text;
      finishAddingJob(scrape, rawUrl, canonical, jdText, profile);
    } catch (e) {
      console.error(`❌ Failed to scrape: ${e.message}`);
      console.log(`\n💡 Tip: You can bypass scraping blocks (like Cloudflare) by saving the JD to a text file and running:`);
      console.log(`   node add-job.mjs "${rawUrl}" --file ./jd.txt`);
      process.exit(1);
    }
  }

  async function finishAddingJob(scrape, rawUrl, canonical, jdText, profile) {
  const li = extractLinkedInCompanyTitle(jdText, rawUrl);
  let company = extractCompanyFromUrl(rawUrl);
  let title = extractTitleFromJd(jdText);
  if (scrape.company) company = scrape.company;
  else if (li.company) company = li.company;
  if (scrape.title) title = scrape.title;
  else if (li.title) title = li.title;

  const score = calculateJobScore(jdText, profile);

  // Insert to database (store full URL user pasted; canonical for dedupe / display)
  const [inserted] = await sql`
    INSERT INTO jobs (user_id, url, canonical_url, company, title, source, score, jd_text, created_at)
    VALUES (${userId}, ${rawUrl}, ${canonical}, ${company}, ${title}, 'manual-add', ${score}, ${jdText.slice(0, 25000)}, NOW())
    RETURNING id, company, title, score
  `;

  console.log(`\n✅ Job added successfully!`);
  console.log(`   ID: ${inserted.id}`);
  console.log(`   Company: ${inserted.company}`);
  console.log(`   Title: ${inserted.title}`);
  console.log(`   Score: ${inserted.score}/10`);
  console.log(`\n📄 Next steps:`);
  console.log(`   tailor ${inserted.id} --deep    → Generate resume & cover letter`);
  console.log(`   apply ${inserted.id} --deep     → Auto-fill application`);
  }
}

main().catch(e => {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
});
