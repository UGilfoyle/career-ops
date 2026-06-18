import fs from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import sql from './db/client.mjs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let hf = null;
let hfUnavailable = false;
let hfTokenInUse = '';
const HF_MODEL = process.env.HF_MODEL || 'MiniMaxAI/MiniMax-M2.7';
const TARGET_MAP = 'data/current_eval.json';
const TEMPLATE = 'templates/ats-template-professional.html';
const require = createRequire(import.meta.url);

const idOrUrl = process.argv[2];
const rawUserId = process.env.SCAN_USER_ID || 1;
const userId = Number.parseInt(String(rawUserId), 10);
if (!Number.isFinite(userId)) {
  throw new Error(`Invalid SCAN_USER_ID: ${rawUserId}`);
}

if (!idOrUrl) {
  console.error("Usage: tailor <job_id_or_url>");
  process.exit(1);
}

async function getHfClient(token) {
  hfTokenInUse = token || process.env.HUGGINGFACE_TOKEN || '';
  if (hfUnavailable) return null;
  if (hf) return hf;
  try {
    const candidatePaths = [
      process.env.APP_ROOT && path.join(process.env.APP_ROOT, 'node_modules'),
      process.env.APP_ROOT,
      process.cwd(),
    ].filter(Boolean);
    const resolved = require.resolve('@huggingface/inference', { paths: candidatePaths });
    const mod = await import(pathToFileURL(resolved).href);
    hf = new mod.HfInference(token || process.env.HUGGINGFACE_TOKEN);
    return hf;
  } catch (e) {
    hfUnavailable = true;
    console.warn('⚠ Tailoring SDK unavailable in this runtime. Using Hugging Face HTTP/API fallback for text generation.');
    return null;
  }
}

async function callHfChatViaHttp(messages, model) {
  if (!hfTokenInUse) return null;
  const targetModel = model || HF_MODEL;
  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfTokenInUse}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: targetModel,
      messages,
      max_tokens: 3000,
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HuggingFace API error ${response.status}: ${body.slice(0, 200)}`);
  }
  return response.json();
}

async function getChromium() {
  try {
    const mod = await import('playwright');
    return mod.chromium;
  } catch {
    return null;
  }
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    `https://${accountId}.r2.cloudflarestorage.com`;
  // Cloudflare R2 supports virtual-hosted style; path-style can cause signature mismatch
  // depending on endpoint/account routing. Default to virtual-hosted style.
  const forcePathStyle = process.env.R2_FORCE_PATH_STYLE === '1';

  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function uploadToR2({ key, body, contentType }) {
  const bucket = process.env.R2_BUCKET || '';
  const client = getR2Client();
  if (!bucket || !client) {
    console.warn('[R2] Skip upload: missing bucket or client credentials');
    console.warn(`[R2] Debug: bucket="${bucket}", hasClient=${!!client}, accountId="${process.env.R2_ACCOUNT_ID?.slice(0, 6)}...", hasAccessKey=${!!process.env.R2_ACCESS_KEY_ID}, hasSecret=${!!process.env.R2_SECRET_ACCESS_KEY}`);
    return false;
  }
  try {
    console.log(`[R2] Config: endpoint="${process.env.R2_ENDPOINT?.trim() || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`}", forcePathStyle=${process.env.R2_FORCE_PATH_STYLE === '1'}`);
    console.log(`[R2] Uploading ${key} (${body.length} bytes) to bucket ${bucket}...`);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    console.log(`[R2] Upload successful: ${key}`);
    return true;
  } catch (e) {
    console.error(`[R2] Upload failed for ${key}: ${e?.name || e?.message}`);
    if (e?.message?.includes('AccessDenied')) {
      console.error('[R2] Hint: Check your R2 token permissions (needs Object Read & Write)');
    }
    if (e?.message?.includes('NoSuchBucket')) {
      console.error(`[R2] Hint: Bucket "${bucket}" does not exist`);
    }
    return false;
  }
}


// ── UTILITIES ──

function renderExperience(exp, tailoredBullets, jdText = '', maxPages = 2) {
  if (!Array.isArray(exp) || exp.length === 0) return '';

  // Limit bullets per job based on page count
  const maxBulletsPerJob = maxPages >= 3 ? 6 : maxPages >= 2 ? 4 : 3;

  // tailoredBullets can be:
  //   (a) a flat array of strings → legacy single-role mode (applied to most-relevant role)
  //   (b) an object { "0": [...], "1": [...] } → multi-role mode keyed by role index
  const isMultiRole = tailoredBullets && typeof tailoredBullets === 'object' && !Array.isArray(tailoredBullets);
  const flatBullets = Array.isArray(tailoredBullets) ? tailoredBullets : null;

  // For legacy flat-array mode: find the most relevant job
  let tailoredJobIndex = 0;
  if (flatBullets && flatBullets.length > 0 && jdText) {
    const jdLower = jdText.toLowerCase();
    let bestScore = -1;
    exp.forEach((job, idx) => {
      const jobText = `${job.role} ${job.company} ${(job.bullets || []).join(' ')}`.toLowerCase();
      const jdKeywords = jdLower.match(/\b\w{4,}\b/g) || [];
      const score = jdKeywords.filter(kw => jobText.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        tailoredJobIndex = idx;
      }
    });
    console.log(`[DEBUG] Selected job #${tailoredJobIndex + 1} (${exp[tailoredJobIndex]?.role} at ${exp[tailoredJobIndex]?.company}) for tailored bullets`);
  } else if (!isMultiRole) {
    console.log(`[DEBUG] No tailored bullets or JD provided. Using original bullets for all jobs.`);
  } else {
    console.log(`[DEBUG] Multi-role tailoring: ${Object.keys(tailoredBullets).length} roles received tailored bullets`);
  }

  // Date patterns to aggressively strip from company/role
  const datePatterns = [
    /\b\d{4}\s*[-–—]\s*(?:\d{4}|present|current|now)\b/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\b/gi,
    /\b20\d{2}\b/g,
    /\b(?:present|current|now)\b/gi,
  ];
  
  const stripDates = (text) => {
    let cleaned = text;
    for (const pattern of datePatterns) {
      cleaned = cleaned.replace(pattern, '').trim();
    }
    return cleaned.replace(/\s*[|—–-]\s*$/, '').replace(/^\s*[|—–-]\s*/, '').trim();
  };

  return exp.map((job, idx) => {
    // Multi-role mode: check if AI provided bullets for this role index
    let roleBullets = null;
    if (isMultiRole && tailoredBullets[String(idx)]) {
      roleBullets = tailoredBullets[String(idx)];
      console.log(`[DEBUG] Applying ${roleBullets.length} tailored bullets to job #${idx + 1} (${job.role})`);
    } else if (flatBullets && flatBullets.length > 0 && idx === tailoredJobIndex) {
      roleBullets = flatBullets;
      console.log(`[DEBUG] Applying ${roleBullets.length} tailored bullets to job #${idx + 1} (${job.role})`);
    }
    const bullets = roleBullets
      ? roleBullets.slice(0, maxBulletsPerJob)
      : (job.bullets || []).slice(0, maxBulletsPerJob);

    let role = (job.role || '').trim();
    let company = (job.company || '').trim();
    let dates = (job.period || '').trim();
    
    // Aggressively strip dates from role and company
    role = stripDates(role);
    company = stripDates(company);
    
    // Clean up: if company is in role text, extract it
    if (role && !company) {
      // Try to detect company in role string using common suffixes
      const companySuffixPattern = /(.*?(?:Solutions|Services|Technologies|Tech|Labs|Inc\.?|LLC|Ltd\.?|Corp\.?|Company|Group|Partners|Consulting|Systems|Software|Digital|Global|Engineering|Engineers|Products|Media|Enterprises|Holdings|Platforms|Ventures|Studios))\s*(?:—|\||-|–)?\s*(.+)/i;
      const match = role.match(companySuffixPattern);
      if (match) {
        company = match[1].trim();
        role = match[2].trim();
      }
    }
    
    // Final cleanup - remove any remaining date-like text
    role = stripDates(role);
    company = stripDates(company);
    
    // If role and company are identical, keep only role
    if (role.toLowerCase() === company.toLowerCase()) {
      company = '';
    }
    
    // Clean layout: Company — Role (left)    Dates (right)
    const hasCompanyInRole = role.toLowerCase().includes(company.toLowerCase()) && company.length > 3;
    const hasRoleInCompany = company.toLowerCase().includes(role.toLowerCase()) && role.length > 3;
    
    let titleLeft = '';
    if (company && role && !hasCompanyInRole && !hasRoleInCompany) {
      titleLeft = `<span class="job-company">${company}</span> — <span class="job-title">${role}</span>`;
    } else if (role && hasCompanyInRole) {
      // Role already contains company - just show role
      titleLeft = `<span class="job-title">${role}</span>`;
    } else if (company && hasRoleInCompany) {
      // Company contains role - just show company
      titleLeft = `<span class="job-company">${company}</span>`;
    } else if (company) {
      titleLeft = `<span class="job-company">${company}</span>`;
    } else if (role) {
      titleLeft = `<span class="job-title">${role}</span>`;
    }

    return `
    <div class="job">
      <div class="job-header">
        <div>${titleLeft}</div>
        <div class="job-dates">${dates}</div>
      </div>
      <ul>
        ${bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>
    </div>
  `}).join('');
}

function renderEducation(edu) {
  if (!Array.isArray(edu) || edu.length === 0) return '';
  return edu.map(e => `
    <div>${e.degree}${e.school ? `, ${e.school}` : ''}${e.period ? ` (${e.period})` : ''}</div>
  `).join('');
}

function renderProjects(projects) {
  if (!projects) return '';
  return projects.map(p => `
    <div class="project">
      <span style="font-weight: bold;">${p.name}:</span> ${p.hero_metric}
    </div>
  `).join('');
}

function renderCategorizedSkills(profileSuperpowers, tailoredCompetencies) {
  const superpowers = Array.isArray(profileSuperpowers) ? profileSuperpowers : [];
  const competencies = Array.isArray(tailoredCompetencies) ? tailoredCompetencies : [];

  if (superpowers.length === 0 && competencies.length === 0) return '';

  // Known tech stacks / tools — if a competency looks like an actual technology, it goes to Technical Skills.
  // This list covers the most common stacks seen in JDs; short tokens matched case-insensitively.
  const techPatterns = [
    // Languages
    /\b(java(?:script)?|python|typescript|go(?:lang)?|rust|ruby|c\+\+|c#|\.net|kotlin|swift|scala|php|perl|elixir|haskell|dart|r\b|sql|graphql|html|css|sass|less)\b/i,
    // Frameworks & runtimes
    /\b(react|angular|vue|svelte|next\.?js|nuxt|nest\.?js|express|fastapi|flask|django|spring|rails|laravel|gin|echo|fiber|fastify|hono|remix|gatsby|astro|node\.?js|deno|bun)\b/i,
    // Databases
    /\b(postgres|postgresql|mysql|mariadb|mongo(?:db)?|redis|dynamodb|aurora|cockroach|cassandra|elastic|opensearch|sqlite|supabase|neon|firebase|firestore|couchdb|neo4j|memcached|influxdb)\b/i,
    // Cloud & infra
    /\b(aws|gcp|azure|cloudflare|vercel|heroku|digital\s?ocean|ecs|ec2|lambda|fargate|s3|cloudfront|route\s?53|iam|vpc|sqs|sns|step\s?functions|api\s?gateway|cloud\s?run|cloud\s?functions|bigquery|pubsub|terraform|pulumi|cdk|cloudformation|ansible)\b/i,
    // DevOps & containers
    /\b(docker|kubernetes|k8s|helm|istio|envoy|nginx|haproxy|traefik|ci\/cd|jenkins|github\s?actions|gitlab\s?ci|circle\s?ci|argo\s?cd|flux|buildkite|drone|prometheus|grafana|datadog|new\s?relic|pagerduty|splunk|elk|loki|jaeger|opentelemetry)\b/i,
    // Data & ML
    /\b(kafka|rabbitmq|nats|pulsar|flink|spark|airflow|dbt|snowflake|redshift|databricks|mlflow|sagemaker|pytorch|tensorflow|langchain|openai|hugging\s?face|llm|rag|vector\s?db|pinecone|weaviate|qdrant|milvus)\b/i,
    // Testing & tools
    /\b(jest|mocha|pytest|cypress|playwright|selenium|postman|swagger|openapi|storybook|webpack|vite|esbuild|turbopack|rollup|parcel|pnpm|yarn|npm|git|jira|confluence|linear|notion|figma|slack)\b/i,
    // Patterns that are clearly tech (short tokens)
    /\b(rest\s?api|grpc|websocket|oauth|jwt|saml|sso|rbac|rls|cors|cdn|dns|tls|ssl|http\/2|http\/3|protobuf|avro|parquet)\b/i,
  ];

  const isTechStack = (text) => {
    const t = text.trim();
    // Short items (≤30 chars) that look like tool/tech names (few spaces, no verb phrases)
    if (t.length <= 30 && (t.split(/\s+/).length <= 3)) {
      // Check against known patterns
      if (techPatterns.some(p => p.test(t))) return true;
      // If it's a very short string (single word or two), treat as tech by default
      // unless it contains management/leadership style words
      if (t.split(/\s+/).length <= 2 && !/\b(management|leadership|communication|mentoring|strategy|ownership|reviews)\b/i.test(t)) {
        return true;
      }
    }
    // Longer items — check for tech patterns
    return techPatterns.some(p => p.test(t));
  };

  // Separate competencies into Core Competencies (broad skills) and Technical Skills (tech stacks)
  const coreComp = [];
  const techSkills = [];

  // Process tailored competencies FIRST (JD-aligned, highest priority)
  for (const item of competencies) {
    const s = String(item || '').trim();
    if (!s) continue;
    if (isTechStack(s)) {
      techSkills.push(s);
    } else {
      coreComp.push(s);
    }
  }

  // Then add profile superpowers that aren't already covered
  const existingLower = new Set([...coreComp, ...techSkills].map(x => x.toLowerCase()));
  for (const sp of superpowers) {
    const s = String(sp || '').trim();
    if (!s || existingLower.has(s.toLowerCase())) continue;
    // Extract parenthesized tech stacks from superpowers like "AWS platform engineering (ECS, Lambda, Aurora, IAM)"
    const parenMatch = s.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const techs = parenMatch[1].split(',').map(t => t.trim()).filter(Boolean);
      for (const tech of techs) {
        if (!existingLower.has(tech.toLowerCase())) {
          techSkills.push(tech);
          existingLower.add(tech.toLowerCase());
        }
      }
    }
    // The superpower phrase itself goes to Core Competencies (without the parenthesized part)
    const cleanedSp = s.replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (cleanedSp && !existingLower.has(cleanedSp.toLowerCase())) {
      coreComp.push(cleanedSp);
      existingLower.add(cleanedSp.toLowerCase());
    }
  }

  // Deduplicate and limit
  const uniqueCore = [...new Set(coreComp)].slice(0, 10);
  const uniqueTech = [...new Set(techSkills)].slice(0, 12);

  // Generate HTML
  let html = '';
  if (uniqueCore.length > 0) {
    html += `<div class="skill-line"><span class="skill-label">Core Competencies:</span> ${uniqueCore.join(', ')}</div>`;
  }
  if (uniqueTech.length > 0) {
    html += `<div class="skill-line"><span class="skill-label">Technical Skills:</span> ${uniqueTech.join(', ')}</div>`;
  }

  // Fallback if somehow both are empty
  if (!html) {
    const allItems = [...superpowers, ...competencies].slice(0, 12);
    html = `<div class="skill-line"><span class="skill-label">Skills:</span> ${allItems.join(', ')}</div>`;
  }

  return html;
}

// Calculate years of experience from experience array
function calculateYearsOfExperience(experience) {
  if (!Array.isArray(experience) || experience.length === 0) return 0;

  let totalYears = 0;
  const currentYear = new Date().getFullYear();

  for (const job of experience) {
    if (!job.period) continue;
    const period = job.period;

    // Parse various date formats
    // Format: "2020–Present", "2018-2022", "Jan 2020 - Dec 2022"
    const parts = period.split(/[-–—]/);
    if (parts.length === 2) {
      const startStr = parts[0].trim();
      const endStr = parts[1].trim();

      // Extract year from start
      const startMatch = startStr.match(/\d{4}/);
      const startYear = startMatch ? parseInt(startMatch[0]) : currentYear;

      // Extract year from end
      let endYear;
      if (/present|current|now/i.test(endStr)) {
        endYear = currentYear;
      } else {
        const endMatch = endStr.match(/\d{4}/);
        endYear = endMatch ? parseInt(endMatch[0]) : currentYear;
      }

      totalYears += Math.max(0, endYear - startYear);
    }
  }

  return totalYears;
}

function buildExperienceDigestForPrompt(experience, maxRoles = 6) {
  if (!Array.isArray(experience) || experience.length === 0) {
    return '(No roles in profile — keep the summary generic and honest; do not invent employers.)';
  }
  return experience
    .slice(0, maxRoles)
    .map((e) => {
      const role = e?.role || e?.title || 'Role';
      const company = e?.company || 'Company';
      const period = e?.period || '';
      const blurb = (e?.bullets || []).filter(Boolean).slice(0, 2).join(' ');
      return `• ${role} — ${company} (${period})${blurb ? ` — ${blurb.slice(0, 160)}` : ''}`;
    })
    .join('\n');
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain summary: ≤4 lines, ≤~520 chars; use with white-space: pre-line in HTML. */
function normalizeResumeSummaryPlain(rawSummary, yearsExp) {
  let t = String(rawSummary || '').trim();
  const y = Number(yearsExp) || 0;
  if (!t) {
    t =
      y > 0
        ? `Engineer with ${y}+ years shipping production software, APIs, and reliability-focused systems.\nHands-on with design, delivery, incident ownership, and performance tuning.\nComfortable owning features end-to-end across distributed backends and cloud infrastructure.`
        : `Engineer focused on production systems, APIs, and measurable delivery.\nOwns implementation through monitoring, incidents, and iterative improvements.\nWorks with modern backend stacks and cross-functional partners.`;
  }
  let lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) {
    const parts = t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1) lines = parts.slice(0, 4);
  }
  lines = lines.slice(0, 4);
  lines = lines.map((line) => (line.length > 200 ? `${line.slice(0, 197)}…` : line));
  const joined = lines.join('\n');
  return joined.length > 580 ? `${joined.slice(0, 577)}…` : joined;
}

function formatResumeSummaryHtml(rawSummary, yearsExp) {
  return escapeHtml(normalizeResumeSummaryPlain(rawSummary, yearsExp));
}

/**
 * ATS-style overlap score: how many distinct resume lines (superpowers, bullets,
 * tailored competencies) share at least one meaningful token with the JD.
 * This is NOT the same as third-party checkers (parse rate, grammar, quantified impact).
 */
function calculateATSScore(profile, jdText, tailoring) {
  if (!jdText || !profile) {
    return { score: 0, matched: 0, total: 0, totalMatched: 0, matchedSample: [] };
  }

  const jdLower = String(jdText).toLowerCase();
  const matched = [];

  const rawLines = [
    ...(profile.narrative?.superpowers || []),
    ...(profile.experience?.flatMap((e) => e.bullets || []) || []),
    ...(tailoring?.core_competencies || []),
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const profileSkills = [...new Set(rawLines)];

  for (const skill of profileSkills) {
    const skillLower = skill.toLowerCase();
    const keywords = skillLower.split(/[,;\s|/()+]+/).filter((k) => k.length > 2);
    const tokenHit =
      keywords.length > 0
        ? keywords.some((kw) => jdLower.includes(kw))
        : skillLower.length > 2 && jdLower.includes(skillLower);
    if (tokenHit) matched.push(skill);
  }

  const uniqueMatches = [...new Set(matched)];
  const m = uniqueMatches.length;
  const n = profileSkills.length;

  const tokenScore = n === 0 ? 0 : Math.min(100, m * 5 + 50);
  const ratioScore = n === 0 ? 0 : Math.round((m / n) * 100);
  const finalScore = Math.min(100, Math.max(tokenScore, ratioScore));

  return {
    score: finalScore,
    matched: m,
    total: n,
    totalMatched: m,
    matchedSample: uniqueMatches.slice(0, 10),
  };
}

// Generate visual ATS score bar
function generateATSScoreBar(score) {
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';
  return `
    <div style="margin: 10px 0;">
      <div style="font-size: 9pt; color: #666; margin-bottom: 3px;">ATS Compatibility Score</div>
      <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
        <div style="background: ${color}; width: ${score}%; height: 100%; border-radius: 4px;"></div>
      </div>
      <div style="font-size: 10pt; font-weight: bold; color: ${color}; margin-top: 2px;">${score}/100</div>
    </div>
  `;
}

// sync cv.md if profile.yml is newer
async function checkSync() {
  try {
    const syncScriptPath = path.join(process.cwd(), 'sync-profile.mjs');
    if (!fs.existsSync(syncScriptPath)) {
      return;
    }
    const profileStat = await stat(path.join(process.cwd(), 'config', 'profile.yml'));
    let cvStat;
    try { cvStat = await stat(path.join(process.cwd(), 'cv.md')); } catch {}

    if (!cvStat || profileStat.mtime > cvStat.mtime) {
      console.log('🔄 Profile change detected. Synchronizing cv.md...');
      execSync(`"${process.execPath}" "${syncScriptPath}"`);
    }
  } catch (e) {
    console.warn('⚠️ Could not check profile sync:', e.message);
  }
}

async function scrapeJD(url) {
  const normalizeUrl = (value) => {
    if (!value) return value;
    let next = String(value).trim();
    // Handle protocol-relative URLs like //duckduckgo.com/...
    if (next.startsWith('//')) next = `https:${next}`;
    // Handle URLs missing scheme like duckduckgo.com/...
    if (!/^https?:\/\//i.test(next) && /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(next)) {
      next = `https://${next}`;
    }
    try {
      const u = new URL(next);
      // Unwrap DuckDuckGo redirect links: https://duckduckgo.com/l/?uddg=<encoded>
      if (u.hostname.includes('duckduckgo.com') && u.pathname.startsWith('/l/')) {
        const ud = u.searchParams.get('uddg');
        if (ud) {
          try {
            return decodeURIComponent(ud);
          } catch {
            return ud;
          }
        }
      }
    } catch {
      // leave as-is; caller will handle failure
    }
    return next;
  };

  const targetUrl = normalizeUrl(url);
  console.log(`🌐 Scraping job description from: ${targetUrl}`);
  const chromium = await getChromium();
  if (chromium) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const text = await page.evaluate(() => document.body.innerText);
      await browser.close();
      return text.trim();
    } catch (err) {
      await browser.close();
      throw new Error(`Scrape failed: ${err.message}`);
    }
  }

  console.warn('⚠ Playwright unavailable in this runtime. Falling back to basic HTML fetch.');
  try {
    const res = await fetch(targetUrl, { headers: { 'User-Agent': 'career-ops-tailor/1.0' } });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped.slice(0, 15000);
  } catch (err) {
    throw new Error(`Fallback fetch failed: ${err.message}`);
  }
}

function canonicalizeUrl(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  let next = raw;
  if (next.startsWith('//')) next = `https:${next}`;
  if (!/^https?:\/\//i.test(next) && /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(next)) {
    next = `https://${next}`;
  }
  try {
    const u = new URL(next);
    u.hash = '';
    u.search = '';
    return u.toString();
  } catch {
    return next.split('?')[0];
  }
}

function escapeHtmlCl(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCoverSenderDetails(c) {
  if (!c || typeof c !== 'object') return '';
  const parts = [];
  const street = [c.street_address, c.address_line1].map((x) => String(x || '').trim()).find(Boolean);
  const cityLine = [c.city_state_zip, c.address_line2, c.city].map((x) => String(x || '').trim()).find(Boolean);
  const loc = String(c.location || '').trim();
  if (street) parts.push(escapeHtmlCl(street));
  if (cityLine) parts.push(escapeHtmlCl(cityLine));
  else if (loc) parts.push(escapeHtmlCl(loc));
  const ph = String(c.phone || '').trim();
  if (ph) parts.push(escapeHtmlCl(ph));
  const em = String(c.email || '').trim();
  if (em) {
    const he = escapeHtmlCl(em);
    parts.push(`<a href="mailto:${he}">${he}</a>`);
  }
  const liRaw = String(c.linkedin || '').trim();
  if (liRaw) {
    const href = /^https?:\/\//i.test(liRaw) ? liRaw : `https://${liRaw.replace(/^\/+/, '')}`;
    parts.push(`<a href="${escapeHtmlCl(href)}">${escapeHtmlCl(liRaw.replace(/^https?:\/\//i, ''))}</a>`);
  }
  const webRaw = String(c.portfolio_url || c.github || c.website || '').trim();
  if (webRaw) {
    const href = /^https?:\/\//i.test(webRaw) ? webRaw : `https://${webRaw.replace(/^\/+/, '')}`;
    const label = webRaw.replace(/^https?:\/\//i, '').replace(/\/$/, '') || 'Portfolio';
    parts.push(`<a href="${escapeHtmlCl(href)}">${escapeHtmlCl(label)}</a>`);
  }
  return parts.join('<br>');
}

function coverLetterBodyToHtml(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  let blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\r/g, '').trim())
    .filter(Boolean);
  if (blocks.length <= 1) {
    blocks = raw
      .split(/\n/)
      .map((b) => b.replace(/\r/g, '').trim())
      .filter(Boolean);
  }
  return blocks.map((p) => `<p>${escapeHtmlCl(p.replace(/\n+/g, ' '))}</p>`).join('');
}

async function tailorPackage(jd, profile, companyName) {
  const hfClient = await getHfClient();
  if (hfClient) {
    console.log(`🤖 Generating tailored package with ${HF_MODEL}...`);
  } else if (hfTokenInUse) {
    console.log(`🤖 Using direct Hugging Face API with ${HF_MODEL}...`);
  } else {
    const y = calculateYearsOfExperience(profile?.experience);
    // Extract tech stacks from JD for the fallback (no-AI) path
    const jdLower = String(jd || '').toLowerCase();
    const knownTechs = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C#', '.NET', 'Ruby', 'PHP', 'Kotlin', 'Swift', 'Scala',
      'React', 'Angular', 'Vue.js', 'Next.js', 'NestJS', 'Express', 'FastAPI', 'Django', 'Spring Boot', 'Node.js',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'DynamoDB', 'Elasticsearch', 'Aurora',
      'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
      'ECS', 'Lambda', 'S3', 'EC2', 'CloudFormation', 'IAM', 'VPC', 'SQS', 'SNS',
      'Kafka', 'RabbitMQ', 'GraphQL', 'REST API', 'gRPC',
      'Jenkins', 'GitHub Actions', 'GitLab CI', 'Prometheus', 'Grafana', 'Datadog',
      'Jest', 'Cypress', 'Playwright', 'Webpack', 'Vite',
      'Git', 'Jira', 'Agile', 'Scrum',
    ];
    const jdTechExtract = knownTechs.filter(t => jdLower.includes(t.toLowerCase()));
    const fallbackCompetencies = [
      ...jdTechExtract.slice(0, 8),
      ...(profile?.narrative?.superpowers || []).slice(0, 5),
    ].slice(0, 12);
    return {
      resume: {
        summary: normalizeResumeSummaryPlain(
          profile?.narrative?.exit_story ||
            `Engineer with ${y || 'several'}+ years building production systems and APIs.`,
          y
        ),
        core_competencies: fallbackCompetencies,
        experience: (profile?.experience?.[0]?.bullets || []).slice(0, 3),
      },
      cover_letter: (() => {
        const em = String(profile?.candidate?.email || '').trim();
        const ph = String(profile?.candidate?.phone || '').trim();
        const tail =
          em || ph
            ? `I would welcome the opportunity to discuss fit and next steps. You may contact me at ${[em, ph].filter(Boolean).join(' or ')}.`
            : 'I would welcome the opportunity to discuss fit and next steps.';
        return `I am writing to express my interest in opportunities with ${companyName} that align with the technical requirements described in the posting. The role emphasizes delivery in production environments; my background includes building and operating backend systems with a focus on reliability and measurable performance.\n\nMy recent work aligns with several themes in the job description, including ${(profile?.narrative?.superpowers || []).slice(0, 3).join(', ') || 'the stacks and outcomes summarized in the profile context below'}. I am prepared to contribute on day one and to collaborate closely with engineering and operations partners.\n\n${tail}`;
      })()
    };
  }

  const yearsExp = calculateYearsOfExperience(profile?.experience);
  const experienceDigest = buildExperienceDigestForPrompt(profile?.experience);
  const candidateName = profile?.candidate?.full_name || '';
  const candidateEmail = profile?.candidate?.email || '';
  const candidatePhone = profile?.candidate?.phone || '';
  const cvContext = `Approximate career span from dated roles below: ~${yearsExp} years (only state a number if it matches these dates; never invent more).

Candidate name: ${candidateName}
Candidate email: ${candidateEmail}
Candidate phone: ${candidatePhone}

Headline: ${profile?.narrative?.headline || ''}
Positioning (from profile): ${profile?.narrative?.exit_story || ''}
Superpowers / keywords: ${(profile?.narrative?.superpowers || []).join(', ')}

Recent roles — fact base for what you worked on (paraphrase; do not fabricate employers or metrics):
${experienceDigest}`;
  // Determine how many roles to tailor (top 4 most relevant to cover 2022-2026)
  const rolesToTailor = Math.min(4, (profile?.experience || []).length);
  const roleDigest = (profile?.experience || []).slice(0, rolesToTailor).map((e, i) => {
    const role = e?.role || e?.title || 'Role';
    const company = e?.company || 'Company';
    return `  Role ${i}: "${role}" at "${company}"`;
  }).join('\n');

  const prompt = `
You are a senior technical writer who produces concise, professional business correspondence.

GLOBAL RULES:
- NO buzzwords: passion, leveraging, synergies, robust, seamless, cutting-edge, proven track record
- NO AI-sounding phrases
- Use short sentences, active voice, specific numbers where they appear in the digest
- Lead with substance, not filler

TASK:
1. RESUME TAILORING — every output field MUST be aligned to the JD below:

   a) **Professional summary** (resume.summary): EXACTLY 3–4 lines as ONE JSON string with \\n between lines.
      - Line 1: title/scope + years of experience. MUST mention 2-3 specific technologies from the JD.
      - Lines 2–4: concrete domains, stacks, systems, and outcomes from the digest, EXPLICITLY MAPPED to JD requirements.
      - Example: if JD says "React, Node.js, PostgreSQL" → summary MUST mention React, Node.js, PostgreSQL.
      - Total under ~90 words. No bullet characters.

   b) **Core competencies** (resume.core_competencies): 10-14 items.
      - FIRST 6-8 items: EXACT technology/tool names from the JD (copy them verbatim — e.g. "React.js", "Node.js", "PostgreSQL", "Docker", "Kubernetes", "AWS Lambda"). These are the most important.
      - NEXT 2-3 items: broader engineering competencies that appear in the JD (e.g. "System Design", "Microservices Architecture", "CI/CD Pipeline Design")
      - LAST 2-3 items: soft/domain competencies from the JD (e.g. "Agile/Scrum", "Cross-functional Collaboration")
      - CRITICAL: at least 60% of items must be EXACT terms from the JD. Do NOT genericize.

   c) **Experience bullets** (resume.experience): Rewrite bullets for the top ${rolesToTailor} roles.
      Return as an OBJECT keyed by role index ("0", "1", "2", "3"), each with EXACTLY 4 highly descriptive, impactful tailored bullets (never fewer than 4).
${roleDigest}
      BULLET RULES:
      - Each bullet MUST reference at least one specific technology/requirement from the JD
      - Use EXACT JD terminology (if JD says ".NET Core", write ".NET Core" not "backend frameworks")
      - Include metrics from the digest where available; never fabricate numbers
      - Connect each bullet directly to a JD requirement

2. COVER LETTER (body only — template adds "Dear Hiring Manager," and "Sincerely,"):
   - Return ONLY the letter body: NO salutation, NO sign-off
   - Under 150 words total. 3 short paragraphs separated by \\n\\n
   - Tone: first person, formal. Prefer "I am writing...", "The posting emphasizes..."
   - Para 1 (2 sentences): Interest at ${companyName}; reference a concrete JD requirement
   - Para 2 (2-3 sentences): Map experience to JD requirements with tools and outcomes
   - Para 3 (1-2 sentences): Availability + contact: use ONLY ${candidateEmail} and ${candidatePhone}

JD:
${jd.substring(0, 4000)}

My Context:
${cvContext}

OUTPUT FORMAT (JSON ONLY — no markdown fences):
{
  "resume": {
    "summary": "Line1 with JD tech\\nLine2 with JD domains\\nLine3 with outcomes",
    "core_competencies": ["React.js", "Node.js", "PostgreSQL", "Docker", ...],
    "experience": {
      "0": ["bullet 1 with JD tech...", "bullet 2...", "bullet 3...", "bullet 4..."],
      "1": ["bullet 1 with JD tech...", "bullet 2...", "bullet 3...", "bullet 4..."],
      "2": ["bullet 1 with JD tech...", "bullet 2...", "bullet 3...", "bullet 4..."],
      "3": ["bullet 1 with JD tech...", "bullet 2...", "bullet 3...", "bullet 4..."]
    }
  },
  "cover_letter": "para1\\n\\npara2\\n\\npara3"
}
  `;

  const messages = [
    { role: "system", content: "You are a professional recruiting assistant. Return ONLY valid JSON." },
    { role: "user", content: prompt }
  ];

  let response;
  let targetModel = HF_MODEL;
  try {
    if (hfClient) {
      response = await hfClient.chatCompletion({
        model: targetModel,
        messages,
        max_tokens: 3000,
        temperature: 0.2
      });
    } else {
      response = await callHfChatViaHttp(messages, targetModel);
    }
  } catch (err) {
    console.warn(`⚠️ Hugging Face API failed for ${targetModel}: ${err.message}`);
    
    // If the primary model fails (e.g. quota or rate limit), try falling back to Qwen
    if (targetModel === 'MiniMaxAI/MiniMax-M2.7') {
      const fallbackModel = 'Qwen/Qwen2.5-72B-Instruct';
      console.log(`🔄 [Quota/Rate-Limit Fallback] Attempting fallback to: ${fallbackModel}...`);
      try {
        if (hfClient) {
          response = await hfClient.chatCompletion({
            model: fallbackModel,
            messages,
            max_tokens: 3000,
            temperature: 0.2
          });
        } else {
          response = await callHfChatViaHttp(messages, fallbackModel);
        }
        console.log(`✅ Fallback to ${fallbackModel} succeeded.`);
      } catch (fallbackErr) {
        console.warn(`⚠️ Fallback to ${fallbackModel} also failed: ${fallbackErr.message}`);
        throw fallbackErr;
      }
    } else {
      throw err;
    }
  }

  try {
    const content = response.choices[0].message.content;
    const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
    const data = JSON.parse(jsonStr);
    const y = calculateYearsOfExperience(profile?.experience);
    if (data?.resume?.summary) {
      data.resume.summary = normalizeResumeSummaryPlain(data.resume.summary, y);
    }
    // Normalize experience: AI may return object {"0":[...], "1":[...]} or flat array
    // renderExperience handles both, so we pass through as-is
    if (data?.resume?.experience) {
      const exp = data.resume.experience;
      if (typeof exp === 'object' && !Array.isArray(exp)) {
        console.log(`[DEBUG] AI returned multi-role experience: ${Object.keys(exp).length} roles`);
      } else if (Array.isArray(exp)) {
        console.log(`[DEBUG] AI returned flat experience array: ${exp.length} bullets (legacy single-role)`);
      }
    }
    return data;
  } catch (err) {
    console.error("Failed to parse AI response:", response.choices[0].message.content);
    throw new Error("AI output was not valid JSON");
  }
}

// Main Logic
(async () => {
  try {
    await checkSync();

    let entry = { url: '', company: 'Direct Application', title: 'Job via URL' };

    if (/^https?:\/\//.test(idOrUrl)) {
      console.log("🔗 Direct URL detected. Bypassing database lookup...");
      entry.url = idOrUrl;
      try {
        const domain = new URL(idOrUrl).hostname;
        const parts = domain.split('.');
        if (parts.length >= 2) {
          entry.company = parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
        }
      } catch (e) {}
    } else {
      let jobId = Number.parseInt(String(idOrUrl), 10);
      if (!Number.isFinite(jobId)) {
        throw new Error(`Invalid job id: ${idOrUrl}`);
      }
      
      // If the ID is a small number (e.g., from rank output), try to resolve it from the mapping file
      if (jobId < 1000 && fs.existsSync('data/current_eval.json')) {
        try {
          const mapping = JSON.parse(fs.readFileSync('data/current_eval.json', 'utf8'));
          if (mapping[jobId] && mapping[jobId].url) {
            console.log(`📎 Resolved index ${jobId} to URL: ${mapping[jobId].url}`);
            const resolvedUrl = mapping[jobId].url;
            // Now lookup by URL
            const [jobRecord] = await sql`
              SELECT id, user_id, url, company, title
              FROM jobs
              WHERE url = ${resolvedUrl} AND user_id = ${userId}
              LIMIT 1
            `;
            if (jobRecord) {
              entry = jobRecord;
            } else {
               // Fallback if not found in db, just use the mapping info
               entry = { url: resolvedUrl, company: mapping[jobId].company, title: mapping[jobId].title };
            }
          }
        } catch (err) {
          console.warn('Failed to parse current_eval.json mapping:', err.message);
        }
      }

      // If the ID is a small number but we don't have a mapping file (common in GitHub Actions),
      // interpret it as a 1-based index into the user's ranked job list.
      if (!entry.url && jobId > 0 && jobId < 1000) {
        const offset = Math.max(0, jobId - 1);
        const [jobRecord] = await sql`
          SELECT id, user_id, url, company, title
          FROM jobs
          WHERE user_id = ${userId}
          ORDER BY (score IS NULL) ASC, score DESC, created_at DESC
          OFFSET ${offset}
          LIMIT 1
        `;
        if (jobRecord) {
          console.log(`📎 Resolved index ${jobId} to job: ${jobRecord.company} — ${jobRecord.title}`);
          entry = jobRecord;
        }
      }

      // If entry still empty (not resolved from map), try direct DB lookup by ID
      if (!entry.url) {
        const [jobRecord] = await sql`
          SELECT id, user_id, url, company, title
          FROM jobs
          WHERE id = ${jobId} AND user_id = ${userId}
        `;
        if (!jobRecord) throw new Error(`Job ID ${idOrUrl} not found in database.`);
        entry = jobRecord;
      }
    }

    // Debug: log what we have
    console.log(`[DEBUG] Entry resolved: id=${entry?.id}, company=${entry?.company}`);

    const [profileRow] = await sql`SELECT resume_context, hf_token FROM user_profiles WHERE user_id = ${userId}`;
    if (!profileRow) throw new Error(`Profile not configured for user ${userId}. Please setup via the Dashboard Settings.`);

    const profile = profileRow.resume_context;

    // Debug profile data
    console.log(`[DEBUG] Profile loaded: hasExperience=${Array.isArray(profile?.experience)}, expCount=${profile?.experience?.length || 0}, hasEducation=${Array.isArray(profile?.education)}, eduCount=${profile?.education?.length || 0}`);
    console.log(`[DEBUG] Profile narrative: headline="${profile?.narrative?.headline || 'N/A'}", hasSuperpowers=${Array.isArray(profile?.narrative?.superpowers)}, superpowersCount=${profile?.narrative?.superpowers?.length || 0}`);

    // Override HuggingFace global instance if the user has provided their own token
    if (profileRow.hf_token) {
      await getHfClient(profileRow.hf_token);
    } else {
      await getHfClient();
    }

    console.log(`🎯 Target identified: ${entry.company}`);
    const jdText = await scrapeJD(entry.url);
    const canonicalUrl = canonicalizeUrl(entry.url);
    const result = await tailorPackage(jdText, profile, entry.company);
    const tailoring = result.resume;

    // Debug: Log tailored bullets
    // Debug: Log tailored bullets (handles both flat array and multi-role object)
    const expData = tailoring?.experience;
    if (expData && typeof expData === 'object' && !Array.isArray(expData)) {
      // Multi-role object: {"0": [...], "1": [...], ...}
      const roleKeys = Object.keys(expData);
      const totalBullets = roleKeys.reduce((sum, k) => sum + (Array.isArray(expData[k]) ? expData[k].length : 0), 0);
      console.log(`[DEBUG] AI generated ${totalBullets} tailored bullets across ${roleKeys.length} roles:`);
      roleKeys.forEach(k => {
        const bullets = expData[k] || [];
        console.log(`  Role ${k}: ${bullets.length} bullets`);
        bullets.forEach((b, i) => console.log(`    ${i + 1}. ${String(b || '').substring(0, 60)}...`));
      });
    } else if (Array.isArray(expData)) {
      // Legacy flat array
      console.log(`[DEBUG] AI generated ${expData.length} tailored bullets:`);
      expData.forEach((b, i) => console.log(`  ${i + 1}. ${String(b || '').substring(0, 60)}...`));
    } else {
      console.log(`[DEBUG] No tailored experience bullets returned by AI.`);
    }

    // Calculate ATS Score
    const atsScore = calculateATSScore(profile, jdText, tailoring);
    console.log(
      `📊 ATS Score: ${atsScore.score}/100 (${atsScore.totalMatched}/${atsScore.total} resume lines share JD tokens)`
    );

    // Calculate Years of Experience
    const yearsExp = calculateYearsOfExperience(profile.experience);
    console.log(`📊 Years of Experience: ${yearsExp}`);

    // Warn if no experience data
    if (!profile.experience || profile.experience.length === 0) {
      console.warn('⚠ No experience data in profile. Resume will be incomplete. Please update your profile via Dashboard Settings.');
    }
    if (!profile.education || profile.education.length === 0) {
      console.warn('⚠ No education data in profile. Resume will be incomplete. Please update your profile via Dashboard Settings.');
    }

    // Determine resume length based on experience
    // 0-5 years: 1 page, 6-11 years: 2 pages, 12-20 years: up to 4 pages
    const maxPages = yearsExp <= 5 ? 1 : yearsExp <= 11 ? 2 : Math.min(4, Math.ceil(yearsExp / 5));
    console.log(`📄 Resume length: up to ${maxPages} page${maxPages > 1 ? 's' : ''}`);

    // Prepare common replacements
    const c = profile.candidate;
    const commonReps = {
      NAME: c.full_name,
      EMAIL: c.email,
      LOCATION: c.location,
      PHONE: c.phone,
      LINKEDIN_URL: `https://${c.linkedin}`,
      LINKEDIN_DISPLAY: c.linkedin,
      PORTFOLIO_URL: c.github ? `https://${c.github}` : '#',
      PORTFOLIO_DISPLAY: c.github || 'Github',
      DATE: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      COMPANY_NAME: entry.company,
      JOB_TITLE: entry.title || 'Open role',
      LANG: 'en',
      YEARS_EXP: `${yearsExp}`,
      MAX_PAGES: `${maxPages}`
    };

    // 1. GENERATE RESUME - Show ALL experience entries, just limit bullets per job based on page budget
    const experienceToShow = profile.experience || [];

    // Build portfolio link (conditional)
    const portfolioLink = c.github
      ? ` | <a href="https://${c.github}">${c.github.replace(/^github.com\//, '')}</a>`
      : '';

    // Hide sections if missing data (never show blank Education/Experience)
    const hasExperience = Array.isArray(experienceToShow) && experienceToShow.length > 0;
    const hasEducation = Array.isArray(profile.education) && profile.education.length > 0;

    // Determine if projects section should show
    const hasProjects = maxPages >= 2 && profile.narrative?.proof_points && profile.narrative.proof_points.length > 0;

    const yearsInline = yearsExp > 0 ? ` • ${yearsExp}+ years` : '';

    const skillsLines = renderCategorizedSkills(profile.narrative?.superpowers || [], tailoring?.core_competencies || []);
    const hasSkills = Boolean(skillsLines && String(skillsLines).trim().length > 0);

    const resumeReps = {
      ...commonReps,
      SUMMARY_TEXT: formatResumeSummaryHtml(tailoring?.summary, yearsExp),
      EXPERIENCE: hasExperience ? renderExperience(experienceToShow, tailoring.experience, jdText, maxPages) : '',
      EXPERIENCE_DISPLAY: hasExperience ? 'block' : 'none',
      EDUCATION: hasEducation ? renderEducation(profile.education) : '',
      EDUCATION_DISPLAY: hasEducation ? 'block' : 'none',
      SKILLS_LINES: skillsLines,
      SKILLS_DISPLAY: hasSkills ? 'block' : 'none',
      YEARS_EXP_INLINE: yearsInline,
      PORTFOLIO_LINK: portfolioLink
    };

    let resumeHtml = fs.readFileSync(TEMPLATE, 'utf8');
    Object.entries(resumeReps).forEach(([key, val]) => {
      resumeHtml = resumeHtml.replace(new RegExp(`{{${key}}}`, 'g'), val || '');
    });

    const sanitizeFilename = (str) => str.replace(/[^a-z0-9]/gi, '_').replace(/_{2,}/g, '_').substring(0, 50);
    const companySlug = sanitizeFilename(entry.company);
    const resumePathHtml = `output/Resume_Akash_Kaintura_SSE_${companySlug}.html`;
    const resumePathPdf = `output/Resume_Akash_Kaintura_SSE_${companySlug}.pdf`;

    if (!fs.existsSync('output')) fs.mkdirSync('output');
    fs.writeFileSync(resumePathHtml, resumeHtml);

    // 2. GENERATE COVER LETTER
    const clReps = {
      ...commonReps,
      COVER_SENDER_DETAILS: buildCoverSenderDetails(c),
      COVER_LETTER_TEXT: coverLetterBodyToHtml(result.cover_letter)
    };

    let clHtml = fs.readFileSync('templates/cover-letter.html', 'utf8');
    Object.entries(clReps).forEach(([key, val]) => {
      clHtml = clHtml.replace(new RegExp(`{{${key}}}`, 'g'), val || '');
    });

    const clPathHtml = `output/Cover_Letter_Akash_Kaintura_SSE_${companySlug}.html`;
    const clPathPdf = `output/Cover_Letter_Akash_Kaintura_SSE_${companySlug}.pdf`;
    fs.writeFileSync(clPathHtml, clHtml);

    console.log(`✅ Package ready: ${resumePathHtml} & ${clPathHtml}`);

    // Persist to Neon DB so it can be viewed on the Vercel dashboard!
    try {
      await sql`
        ALTER TABLE jobs
          ADD COLUMN IF NOT EXISTS resume_html TEXT,
          ADD COLUMN IF NOT EXISTS cover_letter_html TEXT,
          ADD COLUMN IF NOT EXISTS resume_pdf_key TEXT,
          ADD COLUMN IF NOT EXISTS cover_letter_pdf_key TEXT,
          ADD COLUMN IF NOT EXISTS canonical_url TEXT,
          ADD COLUMN IF NOT EXISTS jd_text TEXT;
      `;
      
      // We assume entry.id exists if it came from DB, else we try to find it by URL
      if (entry.id) {
        await sql`
          UPDATE jobs
          SET
            resume_html = ${resumeHtml},
            cover_letter_html = ${clHtml},
            canonical_url = COALESCE(${canonicalUrl}, canonical_url),
            jd_text = COALESCE(${String(jdText || '').slice(0, 25000)}, jd_text)
          WHERE id = ${entry.id} AND user_id = ${userId}
        `;
      } else {
        await sql`
          UPDATE jobs
          SET
            resume_html = ${resumeHtml},
            cover_letter_html = ${clHtml},
            canonical_url = COALESCE(${canonicalUrl}, canonical_url),
            jd_text = COALESCE(${String(jdText || '').slice(0, 25000)}, jd_text)
          WHERE url = ${entry.url} AND user_id = ${userId}
        `;
      }
      console.log(`💾 HTML assets persisted to database. You can view/print them from the dashboard!`);
    } catch (dbErr) {
      console.warn(`⚠ Could not save HTML to database: ${dbErr.message}`);
    }

    const generatePdfScript = path.join(process.cwd(), 'generate-pdf.mjs');
    const pdfChromium = await getChromium();
    if (!pdfChromium) {
      console.log("⚠ Playwright unavailable in this runtime. Skipping PDF generation. (View HTML in Dashboard)");
    } else if (fs.existsSync(generatePdfScript)) {
      console.log("📄 Generating PDFs...");
      try {
        execSync(`"${process.execPath}" "${generatePdfScript}" "${resumePathHtml}" "${resumePathPdf}"`);
        execSync(`"${process.execPath}" "${generatePdfScript}" "${clPathHtml}" "${clPathPdf}"`);
        console.log(`✨ SUCCESS! Resume & Cover Letter saved for ${entry.company}`);

        // Upload PDFs to Cloudflare R2 (preferred) and persist keys to DB.
        try {
          const resumePdfBuf = fs.existsSync(resumePathPdf) ? fs.readFileSync(resumePathPdf) : null;
          const clPdfBuf = fs.existsSync(clPathPdf) ? fs.readFileSync(clPathPdf) : null;
          // ALWAYS use job ID for R2 key if available - never fall back to company name
          const keyId = entry?.id || jobId;
          const baseKey = `users/${userId}/jobs/${keyId}/${Date.now()}`;
          console.log(`[R2] Generating key with id=${keyId}, baseKey=${baseKey}`);
          let resumeKey = null;
          let clKey = null;
          let resumeUploaded = false;
          let clUploaded = false;

          if (resumePdfBuf) {
            resumeKey = `${baseKey}-resume.pdf`;
            resumeUploaded = await uploadToR2({ key: resumeKey, body: resumePdfBuf, contentType: 'application/pdf' });
            console.log(resumeUploaded ? `[R2] Resume uploaded: ${resumeKey}` : `[R2] Resume upload FAILED: ${resumeKey}`);
          }
          if (clPdfBuf) {
            clKey = `${baseKey}-cover-letter.pdf`;
            clUploaded = await uploadToR2({ key: clKey, body: clPdfBuf, contentType: 'application/pdf' });
            console.log(clUploaded ? `[R2] Cover letter uploaded: ${clKey}` : `[R2] Cover letter upload FAILED: ${clKey}`);
          }

          // Only save keys to DB if upload was successful
          if (resumeUploaded || clUploaded) {
            if (entry.id) {
              await sql`
                UPDATE jobs
                SET
                  resume_pdf_key = COALESCE(${resumeUploaded ? resumeKey : null}, resume_pdf_key),
                  cover_letter_pdf_key = COALESCE(${clUploaded ? clKey : null}, cover_letter_pdf_key)
                WHERE id = ${entry.id} AND user_id = ${userId}
              `;
            } else {
              await sql`
                UPDATE jobs
                SET
                  resume_pdf_key = COALESCE(${resumeUploaded ? resumeKey : null}, resume_pdf_key),
                  cover_letter_pdf_key = COALESCE(${clUploaded ? clKey : null}, cover_letter_pdf_key)
                WHERE url = ${entry.url} AND user_id = ${userId}
              `;
            }
            console.log('💾 PDFs uploaded to R2 and keys persisted to database.');
          } else {
            console.warn('⚠ No PDFs were uploaded to R2 (check credentials/bucket).');
          }
        } catch (pdfDbErr) {
          console.warn(`⚠ Could not upload PDFs to R2: ${pdfDbErr.message}`);
        }
      } catch (pdfErr) {
        console.warn(`⚠ PDF generation unavailable in this runtime (${pdfErr.message}).`);
      }
    } else {
      console.log("⚠ generate-pdf.mjs unavailable in this runtime.");
    }

  } catch (err) {
    console.error("❌ Agentic Tailor Failed:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
