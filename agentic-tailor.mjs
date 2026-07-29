import fs from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import sql from './db/client.mjs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  polishTailoredResume,
  auditResumeQuality,
  normalizeBulletText,
  preferSourceIfThin,
  parseTenureMonths,
  bulletsBudgetForRole as roleBulletBudget,
  elevateBulletToSenior,
  elevateBulletForEmployer,
  isSeniorToneEmployer,
  removeSplicedFragments,
} from './resume-quality.mjs';
import {
  extractJdKeywords,
  extractJdTechKeywords,
  measureJdAlignment,
  alignResumeToJd,
  formatJdKeywordBlock,
  ensureAllRolesTailored,
  isJunkKeyword,
  isWeavableKeyword,
} from './jd-keyword-align.mjs';
import { buildApplicationDocumentPaths } from './document-filename.mjs';
import { classifyCompany } from './gcc-classify.mjs';
import { hydrateResumeProfile } from './profile-hydrate.mjs';
import { formatEducationLine } from './education-format.mjs';
import {
  analyzeJdProfileFit,
  formatHonestKeywordBlock,
  reframeExperienceFromProfile,
  buildHonestCompetencies,
  buildJdMatchedCompetencies,
  buildHonestSummary,
} from './jd-profile-match.mjs';
import {
  buildSourceResumeFromProfile,
  validateResumeAlignment,
  printAlignmentConfirmation,
  writeAlignmentReport,
} from './resume-alignment-validator.mjs';
import {
  isIndeedUrl,
  fetchIndeedJob,
  looksLikeUsableJd,
  indeedManualJdHint,
  IndeedFetchError,
} from './indeed-job.mjs';
import {
  buildTailoringPlan,
  executeTailoringPlan,
  repairTailoredResume,
  measureMutableRoleCoverage,
  assertPreservedEquality,
  restorePreservedEmployers,
} from './resume-tailoring-plan.mjs';

let hf = null;
let hfUnavailable = false;
let hfTokenInUse = '';
const HF_MODEL = process.env.HF_MODEL || 'MiniMaxAI/MiniMax-M2.7';
const TARGET_MAP = 'data/current_eval.json';
const TEMPLATE_FILES = {
  'ats-professional': 'templates/ats-template-professional.html',
  'ats-modern-compact': 'templates/ats-template-modern-compact.html',
  'ats-technical': 'templates/ats-template-technical.html',
  'ats-minimal': 'templates/ats-template-minimal.html',
};
const TEMPLATE = TEMPLATE_FILES['ats-professional'];
const require = createRequire(import.meta.url);

function resolveTemplatePath(profile) {
  const id = profile?.studio?.template_id || 'ats-professional';
  const file = TEMPLATE_FILES[id] || TEMPLATE_FILES['ats-professional'];
  if (fs.existsSync(file)) return file;
  return TEMPLATE;
}

function robustJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    try {
      let inString = false;
      const charArray = Array.from(str);
      for (let i = 0; i < charArray.length; i++) {
        if (charArray[i] === '"' && (i === 0 || charArray[i - 1] !== '\\')) {
          inString = !inString;
        }
        if (inString && charArray[i] === '\n') {
          charArray[i] = '\\n';
        }
        if (inString && charArray[i] === '\r') {
          charArray[i] = '\\r';
        }
      }
      return JSON.parse(charArray.join(''));
    } catch (e2) {
      throw new Error(`Failed to parse AI response: ${str}. Parse error: ${e2.message}`);
    }
  }
}

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
  } catch (err) {
    console.warn(`⚠ Playwright import failed: ${err.message}`);
    // Try playwright-core as fallback (installed separately in some setups)
    try {
      const coreMod = await import('playwright-core');
      return coreMod.chromium;
    } catch {
      // Neither available
    }
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

function stripBulletMarkdown(text) {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^[•\-*▸]\s*/, '')
    .trim();
}

function formatBulletHtml(text) {
  // Defense-in-depth: never render a lowercase-starting experience bullet
  return escapeHtml(normalizeBulletText(stripBulletMarkdown(text)) || stripBulletMarkdown(text));
}

function renderExperience(exp, tailoredBullets, jdText = '', maxPages = 2) {
  if (!Array.isArray(exp) || exp.length === 0) return '';

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
    /\b\d{4}\s*(?:[-–—]|to)\s*(?:\d{4}|present|current|now)\b/gi,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Sept|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*\d{4}\b/gi,
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
    const tenureMonths = parseTenureMonths(job.period);
    const budget = roleBulletBudget(idx, { tenureMonths, maxPages });
    const candidates = (roleBullets
      ? roleBullets.slice(0, budget + 2)
      : (job.bullets || []).slice(0, budget + 2)
    );
    // Merge orphan fragments; if tailored output is thin/broken, prefer profile source facts.
    // Company-aware tone: senior LinkedIn bar only for Quest / Glidewell / INTVERSE / Srijan;
    // mid-level professional polish for KOCO / Rubico / Artisanssoft (and other older roles).
    const employerToneKey = `${job.company || ''} ${job.role || ''}`;
    const normalizedBullets = preferSourceIfThin(candidates, job.bullets || [], {
      minCount: Math.min(3, budget),
      maxBullets: budget,
      company: employerToneKey,
    })
      .map((b) => normalizeBulletText(elevateBulletForEmployer(String(b || ''), employerToneKey), employerToneKey))
      .filter((b) => b.length >= 20);

    let role = (job.role || '').trim();
    let company = (job.company || '').trim();
    let dates = (job.period || '').trim();

    // Show role title only — never append (Contract) / (Freelance) labels
    role = role.replace(/\s*\((?:contract|freelance|temporary|project)\)\s*/gi, '').trim();
    
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
        ${normalizedBullets.map(b => `<li>${formatBulletHtml(b)}</li>`).join('')}
      </ul>
    </div>
  `}).join('');
}

function renderEducation(edu) {
  if (!Array.isArray(edu) || edu.length === 0) return '';
  return edu.map((e) => `<div>${escapeHtml(formatEducationLine(e))}</div>`).join('');
}

function renderAchievements(proofPoints) {
  if (!Array.isArray(proofPoints) || proofPoints.length === 0) return '';
  return `<ul>${proofPoints.map((p) => {
    const name = escapeHtml(p?.name || 'Achievement');
    const metric = escapeHtml(p?.hero_metric || '');
    return `<li><strong>${name}:</strong> ${metric}</li>`;
  }).join('')}</ul>`;
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
    if (!t || isJunkKeyword(t) || !isWeavableKeyword(t)) return false;
    // Short items (≤30 chars) that look like tool/tech names (few spaces, no verb phrases)
    if (t.length <= 30 && (t.split(/\s+/).length <= 3)) {
      // Check against known patterns
      if (techPatterns.some(p => p.test(t))) return true;
      // Short tokens: only if they match a tech pattern (never "Find")
      return false;
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
    if (!s || isJunkKeyword(s)) continue;
    if (isTechStack(s)) {
      techSkills.push(s);
    } else if (isWeavableKeyword(s) || s.split(/\s+/).length >= 2) {
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

  // Deduplicate and limit — denser skills rows for Zety/ATS hybrid
  const uniqueCore = [...new Set(coreComp)].slice(0, 12);
  const uniqueTech = [...new Set(techSkills)].slice(0, 16);

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

// Career span from earliest role start → latest end (or present)
function parseJobMonthIndex(periodStr, which = 'start') {
  const monthNames = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const parts = String(periodStr || '').split(/\s*(?:[-–—]|to)\s*/i);
  const target = which === 'start' ? parts[0] : (parts[1] || parts[0]);
  const clean = (target || '').trim().toLowerCase();
  if (/^(?:present|current|now)$/.test(clean)) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }
  const m = clean.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|sept|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{4})\b/
  );
  if (m) return parseInt(m[2], 10) * 12 + monthNames[m[1].slice(0, 3)];
  const y = clean.match(/\b(19|20)\d{2}\b/);
  if (y) return parseInt(y[0], 10) * 12;
  return null;
}

function calculateYearsOfExperience(experience) {
  if (!Array.isArray(experience) || experience.length === 0) return 0;

  let earliest = Infinity;
  let latest = 0;
  const nowMonths = new Date().getFullYear() * 12 + new Date().getMonth();

  for (const job of experience) {
    const start = parseJobMonthIndex(job.period, 'start');
    const end = parseJobMonthIndex(job.period, 'end');
    if (start != null) earliest = Math.min(earliest, start);
    if (end != null) latest = Math.max(latest, end);
    else if (start != null) latest = Math.max(latest, nowMonths);
  }

  if (!Number.isFinite(earliest) || earliest === Infinity) return 0;
  const months = Math.max(0, latest - earliest);
  return Math.max(1, Math.round(months / 12));
}

function narrativeYearsHint(profile) {
  const story = `${profile?.narrative?.exit_story || ''} ${profile?.narrative?.headline || ''}`;
  const m = story.match(/(\d+)\+?\s*years/i);
  return m ? parseInt(m[1], 10) : 0;
}

function effectiveYearsOfExperience(profile) {
  const span = calculateYearsOfExperience(profile?.experience || []);
  return Math.max(span, narrativeYearsHint(profile));
}

function resolveResumePageBudget(yearsExp, roleCount) {
  if (yearsExp >= 10 || roleCount >= 8) return 3;
  if (yearsExp >= 6 || roleCount >= 5) return 2;
  if (yearsExp >= 4 || roleCount >= 4) return 2;
  return 1;
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
      const blurb = (e?.bullets || []).filter(Boolean).join('\n  ');
      return `• ${role} — ${company} (${period}):\n  ${blurb}`;
    })
    .join('\n\n');
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
  if (!jdText || !tailoring) {
    return { score: 0, matched: 0, total: 0, totalMatched: 0, matchedSample: [], missing: [] };
  }

  const jdFit = profile ? analyzeJdProfileFit(jdText, profile) : null;
  const jdKeywords = jdFit?.honest?.length
    ? jdFit.honest
    : extractJdKeywords(jdText, 25);
  if (jdKeywords.length > 0) {
    const alignment = measureJdAlignment(tailoring, jdKeywords);
    return {
      score: alignment.score,
      matched: alignment.matched.length,
      total: jdKeywords.length,
      totalMatched: alignment.matched.length,
      matchedSample: alignment.matched.slice(0, 10),
      missing: alignment.missing,
      jdKeywords,
      honestOnly: Boolean(jdFit?.honest?.length),
      gapKeywords: jdFit?.gaps || [],
    };
  }

  const jdLower = String(jdText).toLowerCase();
  const matched = [];

  // Collect tailored experience bullets (multi-role object or flat array)
  const tailoredBullets = [];
  const expData = tailoring?.experience;
  if (expData && typeof expData === 'object' && !Array.isArray(expData)) {
    // Multi-role object: {"0": [...], "1": [...], ...}
    Object.values(expData).forEach(bullets => {
      if (Array.isArray(bullets)) tailoredBullets.push(...bullets);
    });
  } else if (Array.isArray(expData)) {
    tailoredBullets.push(...expData);
  }

  const rawLines = [
    ...(profile.narrative?.superpowers || []),
    ...(profile.experience?.flatMap((e) => e.bullets || []) || []),
    ...(tailoring?.core_competencies || []),
    ...tailoredBullets,
    ...(tailoring?.summary ? [tailoring.summary] : []),
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

  // Indeed desktop is Cloudflare-gated — use mobile embedded _initialData
  if (isIndeedUrl(targetUrl)) {
    console.log('🎯 Indeed URL detected. Fetching via mobile embedded endpoint…');
    try {
      const job = await fetchIndeedJob(targetUrl);
      if (job.text && job.text.length > 200) {
        console.log(
          `✅ Indeed JD extracted (${job.text.length} chars) — ${job.company} / ${job.title}`
        );
        return job.text;
      }
    } catch (err) {
      console.warn(`⚠️ Indeed mobile fetch failed: ${err.message}. Falling back to default scraper.`);
    }
  }

  // Intercept BambooHR URLs to fetch clean JSON details directly
  let bhrSubdomain = null;
  let bhrJobId = null;
  try {
    const parsedUrl = new URL(targetUrl);
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
        return text;
      } else {
        console.warn(`⚠️ BambooHR detail API returned status ${res.status}. Falling back to default scraper.`);
      }
    } catch (err) {
      console.warn(`⚠️ BambooHR detail API request failed: ${err.message}. Falling back to default scraper.`);
    }
  }

  // Intercept Greenhouse Board URLs to fetch clean JSON details
  let ghBoardToken = null;
  let ghJobId = null;
  try {
    const parsedUrl = new URL(targetUrl);
    // Matches boards.greenhouse.io/<board_token>/jobs/<job_id>
    // and job-boards.greenhouse.io/.../<job_id>
    if (parsedUrl.hostname.endsWith('greenhouse.io')) {
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      // Pattern: /<board_token>/jobs/<job_id>
      if (pathParts.length >= 3 && pathParts[1] === 'jobs') {
        ghBoardToken = pathParts[0];
        ghJobId = pathParts[2];
      }
    }
  } catch (err) {
    // Ignore URL parsing errors
  }

  if (ghBoardToken && ghJobId) {
    const ghApiUrl = `https://boards-api.greenhouse.io/v1/boards/${ghBoardToken}/jobs/${ghJobId}`;
    console.log(`🎯 Greenhouse URL detected. Fetching JSON from: ${ghApiUrl}`);
    try {
      const res = await fetch(ghApiUrl, {
        headers: {
          'User-Agent': 'career-ops-tailor/1.0',
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const json = await res.json();
        const title = json.title || '';
        const location = json.location?.name || '';
        const contentHtml = json.content || '';

        const contentText = contentHtml
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\n\s*\n/g, '\n\n')
          .trim();

        const text = `Job Title: ${title}\nLocation: ${location}\n\nDescription:\n${contentText}`;
        console.log(`✅ Successfully extracted job description via Greenhouse Board API (${text.length} chars).`);
        return text;
      } else {
        console.warn(`⚠️ Greenhouse Board API returned status ${res.status}. Falling back to default scraper.`);
      }
    } catch (err) {
      console.warn(`⚠️ Greenhouse Board API request failed: ${err.message}. Falling back to default scraper.`);
    }
  }

  // Intercept Lever URLs to fetch clean JSON details
  let leverPostingId = null;
  try {
    const parsedUrl = new URL(targetUrl);
    // Matches jobs.lever.co/<company>/<posting_id>
    if (parsedUrl.hostname === 'jobs.lever.co') {
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        leverPostingId = targetUrl; // Use full URL as the posting endpoint
      }
    }
  } catch (err) {
    // Ignore URL parsing errors
  }

  if (leverPostingId) {
    console.log(`🎯 Lever URL detected. Fetching from Lever postings API...`);
    try {
      // Lever's public postings API: just append /json to the posting URL
      const leverUrl = leverPostingId.replace(/\/$/, '');
      const res = await fetch(leverUrl, {
        headers: {
          'User-Agent': 'career-ops-tailor/1.0',
          'Accept': 'text/html'
        }
      });
      if (res.ok) {
        const html = await res.text();
        // Lever pages have structured content in the HTML even without JS
        const stripped = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<header[\s\S]*?<\/header>/gi, ' ')
          .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
          .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<\/h[1-6]>/gi, '\n\n')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\n\s*\n/g, '\n\n')
          .replace(/[ \t]+/g, ' ')
          .trim();
        if (stripped.length > 200) {
          console.log(`✅ Successfully extracted job description from Lever page (${stripped.length} chars).`);
          return stripped.slice(0, 15000);
        }
      }
      console.warn(`⚠️ Lever page fetch returned insufficient content. Falling back to default scraper.`);
    } catch (err) {
      console.warn(`⚠️ Lever page request failed: ${err.message}. Falling back to default scraper.`);
    }
  }

  const chromium = await getChromium();
  if (chromium) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const page = await context.newPage();
    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      let text = '';
      if (targetUrl.includes('indeed.com')) {
        text = await page.evaluate(() => {
          const jdContainer = document.getElementById('jobDescriptionText') || 
                              document.querySelector('.jobsearch-JobComponent-description') ||
                              document.querySelector('.jobsearch-BodyContainer');
          return jdContainer ? jdContainer.innerText : document.body.innerText;
        });
      } else {
        text = await page.evaluate(() => document.body.innerText);
      }
      
      await browser.close();
      return text.trim();
    } catch (err) {
      await browser.close();
      throw new Error(`Scrape failed: ${err.message}`);
    }
  }

  console.warn('⚠ Playwright unavailable in this runtime. Falling back to enhanced HTML fetch.');
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();

    // Strategy 1: Extract JSON-LD structured data (most job boards embed this for SEO)
    const jsonLdMatches = html.match(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of jsonLdMatches) {
      try {
        const jsonStr = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
        const data = JSON.parse(jsonStr);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'JobPosting' || item['@type']?.includes?.('JobPosting')) {
            const parts = [];
            if (item.title) parts.push(`Job Title: ${item.title}`);
            if (item.hiringOrganization?.name) parts.push(`Company: ${item.hiringOrganization.name}`);
            if (item.jobLocation?.address?.addressLocality) parts.push(`Location: ${item.jobLocation.address.addressLocality}`);
            if (item.description) {
              const descText = item.description
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<\/li>/gi, '\n')
                .replace(/<[^>]+>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/\n\s*\n/g, '\n\n')
                .trim();
              parts.push(`\nDescription:\n${descText}`);
            }
            if (item.qualifications) parts.push(`\nQualifications:\n${item.qualifications}`);
            if (item.skills) parts.push(`\nSkills:\n${item.skills}`);
            if (item.responsibilities) parts.push(`\nResponsibilities:\n${item.responsibilities}`);
            const text = parts.join('\n');
            if (text.length > 100) {
              console.log(`✅ Extracted job description from JSON-LD structured data (${text.length} chars).`);
              return text;
            }
          }
        }
      } catch {
        // Invalid JSON-LD, continue
      }
    }

    // Strategy 2: Extract from Next.js/React __NEXT_DATA__ or similar embedded JSON
    const nextDataMatch = html.match(/<script[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const pageProps = nextData?.props?.pageProps;
        if (pageProps) {
          const jobData = pageProps.job || pageProps.jobPosting || pageProps.listing || pageProps.data;
          if (jobData && (jobData.description || jobData.content || jobData.body)) {
            const desc = jobData.description || jobData.content || jobData.body || '';
            const title = jobData.title || jobData.name || '';
            const descText = String(desc)
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (descText.length > 100) {
              const text = `Job Title: ${title}\n\nDescription:\n${descText}`;
              console.log(`✅ Extracted job description from __NEXT_DATA__ (${text.length} chars).`);
              return text;
            }
          }
        }
      } catch {
        // Invalid JSON, continue
      }
    }

    // Strategy 3: Smart HTML stripping with noise removal
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    if (stripped.length > 200) {
      console.log(`📄 Extracted job description from HTML content (${stripped.length} chars).`);
      return stripped.slice(0, 15000);
    }

    // Strategy 4: If all else fails, try meta description
    const metaDesc = html.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    const ogDesc = html.match(/<meta[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']+)["']/i);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const fallbackParts = [];
    if (titleMatch) fallbackParts.push(`Job Title: ${titleMatch[1].trim()}`);
    if (metaDesc) fallbackParts.push(`Description: ${metaDesc[1]}`);
    if (ogDesc && ogDesc[1] !== metaDesc?.[1]) fallbackParts.push(`Details: ${ogDesc[1]}`);
    if (fallbackParts.length > 0) {
      const text = fallbackParts.join('\n');
      console.warn(`⚠️ Could only extract meta description (${text.length} chars). JD content may be limited.`);
      return text;
    }

    throw new Error('Page returned no extractable job content (likely a client-rendered SPA with no SSR or JSON-LD).');
  } catch (err) {
    throw new Error(`Fallback fetch failed: ${err.message}`);
  }
}

async function resolveJdText(entry) {
  let jdText = String(entry?.jd_text || '').trim();
  if (jdText.length >= 200) {
    console.log(`📄 Using stored JD text from database (${jdText.length} chars).`);
    return jdText;
  }

  try {
    const scraped = await scrapeJD(entry.url);
    // Indeed serves navigation chrome instead of a 403 page — tailoring on that
    // yields 0% JD coverage, so stop with instructions rather than guessing.
    if (isIndeedUrl(entry.url) && !looksLikeUsableJd(scraped)) {
      throw new IndeedFetchError(indeedManualJdHint(entry.url));
    }
    if (scraped && scraped.length > jdText.length) {
      return scraped;
    }
    if (jdText.length > 0) {
      console.warn(`⚠️ JD scrape returned limited content; using stored partial JD (${jdText.length} chars).`);
      return jdText;
    }
    return scraped || '';
  } catch (err) {
    if (err?.indeedBlocked) throw err;
    if (jdText.length > 0) {
      console.warn(`⚠️ JD scrape failed (${err.message}); using stored partial JD (${jdText.length} chars).`);
      return jdText;
    }
    throw err;
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

async function tailorPackage(jd, profile, companyName, passedCompanyType) {
  const plan = buildTailoringPlan(jd, profile);
  const jdKeywords = plan.keywords.atsMirror;
  const jdTechKeywords = plan.parsed.jdTech;
  const jdFit = plan.fit;
  const honestKeywords = plan.keywords.honest;
  const gapKeywords = plan.keywords.gaps;
  const atsKeywords = plan.keywords.atsMirror;
  if (gapKeywords.length > 0) {
    console.log(`⚠️ JD gaps (skills OK for ATS; not invented in experience): ${gapKeywords.slice(0, 8).join(', ')}`);
  }
  if (atsKeywords.length > 0) {
    console.log(`✓ JD ATS match terms: ${atsKeywords.slice(0, 12).join(', ')}`);
  }
  console.log(
    `✓ Employer policy: tailor [${plan.tailorIndices.join(',')}] freeze [${plan.preserveIndices.join(',')}] family=${plan.family}`,
  );

  const hfClient = await getHfClient();
  if (hfClient) {
    console.log(`🤖 Generating tailored package with ${HF_MODEL}...`);
  } else if (hfTokenInUse) {
    console.log(`🤖 Using direct Hugging Face API with ${HF_MODEL}...`);
  } else {
    const executed = executeTailoringPlan(plan, profile, {
      jdText: jd,
      companyName,
    });
    console.log(`📈 Offline ATS content score: ${executed.ats_content_score}/100 (target 90+)`);
    const offlinePackage = {
      resume: executed.resume,
      cover_letter: executed.cover_letter,
      jd_gap_keywords: gapKeywords,
      jd_alignment_score: executed.jd_alignment_score,
      ats_content_score: executed.ats_content_score,
      tailoring_plan: plan,
      preserved_snapshot: executed.preservedSnapshot,
    };
    return applyAlignmentGate(offlinePackage, jd, profile, companyName, executed.resume, plan);
  }

  const yearsExp = effectiveYearsOfExperience(profile);
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
  // Tailor ONLY mutable employers from the plan (Quest/INTVERSE/Glidewell/Srijan)
  const rolesToTailor = plan.tailorIndices.length
    ? Math.max(...plan.tailorIndices) + 1
    : Math.min(4, (profile?.experience || []).length);
  const roleDigest = (profile?.experience || []).slice(0, rolesToTailor).map((e, i) => {
    const role = e?.role || e?.title || 'Role';
    const company = e?.company || 'Company';
    const mode = plan.employers[i]?.mode || 'full_tailor';
    return `  Role ${i}: "${role}" at "${company}" [${mode}]`;
  }).join('\n');

  const companyType = passedCompanyType || classifyCompany(companyName);
  let companyTypeRule = '';
  if (companyType === 'GCC') {
    companyTypeRule = `
- GCC (Global Capability Center) / Captive Adaptation: The target company is a GCC/captive center of a global enterprise (e.g. financial institution, retail giant, tech product firm). Customize the summary, competencies, and experience bullets to emphasize:
  1. Product ownership, high engineering standards, and long-term codebase ownership (avoid "client delivery" or "consultancy" framing).
  2. Direct alignment and collaboration with global stakeholders (e.g. US/EU product and engineering teams).
  3. Designing robust, highly scalable, and secure systems that directly solve global business objectives.
  4. Technical leadership, mentoring team members, and taking accountability for end-to-end features.
  5. PAR bullet structure for every rewritten experience bullet: [Problem context]. [Action I took]. [Quantified result]. Example: "Payment failures caused revenue leakage. I redesigned retry logic and monitoring. Failure rate dropped 42%."`;
  } else if (companyType === 'Services') {
    companyTypeRule = `
- IT Services / Consulting Adaptation: The target company is an IT services/consulting/outsourcing firm. Customize the summary, competencies, and experience bullets to emphasize:
  1. Multi-project delivery, strong execution under tight timelines, and client satisfaction.
  2. Adherence to service-level agreements (SLAs), client requirements gathering, and cross-functional agile coordination.
  3. Adaptability to work across diverse technologies, domains, and codebases based on client project needs.
  4. Strong client-facing communication and resourcefulness in scaling systems or fixing client issues.`;
  }

  const prompt = `
You are a senior technical writer who produces concise, professional business correspondence.

GLOBAL RULES:
- NO buzzwords: passion, leveraging, synergies, robust, seamless, cutting-edge, proven track record
- NO AI-sounding phrases
- Individual Ownership (I, not We): Position all technical achievements, summaries, and cover letters as direct personal contributions. Never use team-oriented language like "we", "our", "us", "assisted with", "participated in", or "worked in a team to". Use first-person singular "I" or strong active verbs (e.g. "I built...", "I engineered...", "Architected...", "Designed...") to show individual ownership of the work.
- 100% JD-Alignment (ATS-FIRST): Mirror the JD tech stack in Summary + Core Competencies using exact JD terminology. Experience bullets stay grounded in digest facts — do not invent employers or metrics. Skills/competencies MUST include the JD TARGET STACK terms listed below (NestJS, Azure, TypeScript, etc.) even when they are not every item in the digest.
- Use short sentences, active voice, specific numbers where they appear in the digest
- Lead with substance, not filler${companyTypeRule}
- Highlight Applied AI & GenAI/LLM: If the JD requires or mentions AI, Generative AI, Large Language Models (LLMs), RAG, vector databases, or machine learning, prioritize and weave the candidate's AI experience (e.g., ChromaDB document ingestion pipeline with multiprocessing, conversation query-rewriting, Anthropic Claude/OpenAI GPT integrations with tenacity backoff retry, self-correcting validation loops for LLMs) into the summary, core competencies, and tailored experience bullets.
- Freelance / Contract / Temporary Role Adaptation: If the JD indicates a freelance, contract, or temporary role, adapt the summary and cover letter to emphasize high autonomy, rapid team integration, immediate contribution, and deliverables-oriented execution. DO NOT change the candidate's existing job titles on the resume to "Freelance" or "Contractor". Keep professional titles (e.g., "Senior Software Engineer") as-is. Avoid adding clunky "doing freelancing" or "freelancing work" phrasing.
- CRITICAL ATS OPTIMIZATION (90+ ATS Score Target): Maximize exact keyword matching. Extract the primary languages, frameworks, databases, cloud platforms, and technical skills from the JD and weave them verbatim into the Summary, Core Competencies, and Rewritten Bullets. Match terminology exactly (e.g. if the JD writes "PostgreSQL", do not write "Postgres" or "SQL database").
- CRITICAL — QUANTIFIED IMPACT (90+ target): Enforce strong quantification. Wherever a metric is present in the candidate's experience digest (%, dollar amounts, latency, throughput, CPU reduction, uptime, speedups), preserve and highlight it in the rewritten bullets. Never invent or fabricate metrics.
- CRITICAL — VERB VARIETY: Start each bullet with a unique, strong action verb (e.g., architected, engineered, streamlined, deployed, accelerated). Avoid repeating the same verb in consecutive bullet points.


TASK:
1. RESUME TAILORING — every output field MUST be aligned to the JD below:

   a) **Professional summary** (resume.summary): EXACTLY 3–4 lines as ONE JSON string with \\n between lines.
      - SENIOR TONE (kadak): candidate is a Senior Software Engineer with 7+ years — write like it.
      - Line 1: Senior title (match JD: SSE / Senior Full-Stack / Senior Backend) + years + named JD stack. Ownership language ("owning", "leading"), not soft filler.
      - Line 2: Architecture / systems depth mapped to JD (microservices, cloud, APIs, AI if relevant) with hard outcomes from digest.
      - Line 3: Reliability + SDLC ownership (reviews, tests, CI, mentoring) — NEVER weak lines like "collaborate with product partners".
      - Line 4 (optional): concrete stack closer or measurable impact bias.
      - Example: if JD says "React, Node.js, PostgreSQL" → summary MUST mention React, Node.js, PostgreSQL.
      - Total under ~90 words. No bullet characters. No clichés (passionate, results-oriented, leveraged, spearheaded).

   b) **Core competencies** (resume.core_competencies): 10-14 items — NEVER sparse.
      - Include EVERY major JD tech term (React, TypeScript, Node.js, NestJS, Azure, GitLab CI, Docker, testing, REST, LLM if mentioned).
      - Mix exact JD tool names with transferable labels (e.g. "RESTful API Design", "CI/CD Pipelines", "Unit & Integration Testing").
      - This section is for ATS matching — list the JD stack even when some tools are stretch/adjacent to digest experience.

   c) **Experience bullets** (resume.experience): Rewrite bullets ONLY for full_tailor roles (indices ${plan.tailorIndices.join(', ') || '0-3'}).
      Do NOT rewrite preserve_verbatim roles (${plan.preserveIndices.join(', ') || '4+'}). Return those keys as empty arrays.
      Return as an OBJECT keyed by role index, each with 4 tailored bullets (never fewer than 3; roles with ~2 years tenure need 3–4). Use senior tone only for Quest/INTVERSE/Glidewell/Srijan; mid-level tone for KOCO/Rubico/Artisanssoft.
${roleDigest}
      BULLET RULES — COMPANY-AWARE TONE (do not oversell older roles):
      - SENIOR LinkedIn/ATS bar ONLY for: Quest Global / Quest, INTVERSE, Glidewell, Srijan — ownership, architecture, reliability, mentoring/SDLC, measurable impact
      - MID-LEVEL professional tone for: KOCO, Rubico, Artisanssoft (and any other older/junior-era roles) — competent IC voice (Developed/Built/Implemented/Delivered). Never junior fluff (Helped/Assisted/Worked on). Never Staff/Senior architect voice (Architected/Owned/Drove/Mentored) on mid employers
      - LinkedIn formula: [Strong verb] + [scope/system] + [tech from digest/JD] + [outcome/metric from digest]
      - SENIOR GOOD: "Architected event-driven microservices on Node.js/Python, cutting infra cost 30%." / "Owned AWS right-sizing and autoscaling, protecting 99.95% uptime." / "Led peer review and mentoring that raised SDLC quality across the squad."
      - MID GOOD: "Developed Node.js multi-tenant APIs serving client platforms." / "Built MongoDB schemas and REST endpoints for deliverables." / "Implemented payment gateway integrations processing 1,000+ daily transactions."
      - BAD (all employers): "Worked on APIs." / "Helped the team." / "Assisted with deployments." / first-person essays
      - Ban openings everywhere: Helped, Assisted, Worked on, Responsible for, Duties included
      - Senior-prefer (Quest/INTVERSE/Glidewell/Srijan only): Architected, Owned, Drove, Engineered, Shipped, Hardened, Scaled, Mentored, Instituted, Diagnosed
      - Mid-prefer (KOCO/Rubico/Artisanssoft): Developed, Built, Implemented, Delivered, Integrated, Deployed, Provisioned, Established — not Architected/Owned/Drove
      - Prefer PROVEN JD technologies from the digest; map adjacent stacks carefully without inventing fake project history
      - NEVER invent metrics or employers; never append spam like "applying X in production"
      - Each bullet MUST include at least one metric from the digest when the source bullet has one; never fabricate numbers
      - Start each bullet with a UNIQUE action verb — no two bullets may share the same opening verb
      - NEVER repeat the same action verb anywhere in the resume (not just at the start) — max 1 use per verb document-wide
      - NEVER repeat any non-JD word twice in the same sentence; swap the second occurrence for a synonym
      - Avoid overused verbs: implemented, developed, designed, built — use at most once each in the full resume
      - NEVER emit orphan fragments ("Logic into…", "Integrity through…", "Authentication flows…") — keep each idea as ONE complete sentence
      - Parallel grammar: "Engineered X and built Y" — never "and building"
      - Older multi-year roles (e.g. ~2 years) still get 3–4 complete professional bullets from digest facts
      - Connect each bullet directly to a JD requirement so TA/HR sees an ATS match
      - SELF-CHECK before output: scan for junior tone, repeated verbs, orphan fragments, weak summary; rewrite until clean

2. COVER LETTER (body only — template adds "Dear Hiring Manager," and "Sincerely,"):
   - Return ONLY the letter body: NO salutation, NO sign-off
   - Under 150 words total. 3 short paragraphs separated by \\n\\n
   - Tone: first person, formal. Prefer "I am writing...", "The posting emphasizes..."
   - Para 1 (2 sentences): Interest at ${companyName}; reference a concrete JD requirement
   - Para 2 (2-3 sentences): Map experience to JD requirements with tools and outcomes
   - Para 3 (1-2 sentences): Closing and next steps (e.g. welcoming an interview or expressing interest in next steps). Do NOT restate the candidate's name, email, phone number, location, or contact details in the body, as they are already printed in the header.

JD ATS ALIGNMENT — skills/competencies list TARGET STACK; experience prefers PROVEN terms:
${formatHonestKeywordBlock(honestKeywords, gapKeywords)}

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
    { role: "system", content: "You are a senior technical recruiter writer. Output ONLY valid JSON. Every resume bullet must pass a Senior Software Engineer / LinkedIn professionalism bar for a 7+ year engineer — never junior task lists." },
    { role: "user", content: prompt }
  ];

  let data = null;
  let lastError = null;
  let response = null;

  // Helper function to call Hugging Face and parse the JSON response
  async function tryHfModel(modelName) {
    let rawResponse;
    if (hfClient) {
      rawResponse = await hfClient.chatCompletion({
        model: modelName,
        messages,
        max_tokens: 3000,
        temperature: 0.2
      });
    } else {
      rawResponse = await callHfChatViaHttp(messages, modelName);
    }
    
    if (!rawResponse || !rawResponse.choices || !rawResponse.choices[0] || !rawResponse.choices[0].message) {
      throw new Error(`Empty or malformed response from Hugging Face model: ${modelName}`);
    }
    
    const content = rawResponse.choices[0].message.content;
    const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
    const parsed = robustJsonParse(jsonStr);
    return { data: parsed, response: rawResponse };
  }

  // Phase 1: Try Hugging Face (Primary model)
  if (hfClient || hfTokenInUse) {
    try {
      const result = await tryHfModel(HF_MODEL);
      data = result.data;
      response = result.response;
      console.log(`✅ Successfully generated tailored CV using primary model: ${HF_MODEL}`);
    } catch (err) {
      console.warn(`⚠️ Primary model ${HF_MODEL} failed (or returned invalid/truncated JSON): ${err.message}`);
      lastError = err;
      
      // Phase 2: Try Hugging Face Fallback model
      if (HF_MODEL === 'MiniMaxAI/MiniMax-M2.7') {
        const hfFallback = 'Qwen/Qwen2.5-72B-Instruct';
        console.log(`🔄 [Quota/Rate-Limit Fallback] Attempting fallback to: ${hfFallback}...`);
        try {
          const result = await tryHfModel(hfFallback);
          data = result.data;
          response = result.response;
          console.log(`✅ Fallback to ${hfFallback} succeeded.`);
          lastError = null; // cleared
        } catch (fbErr) {
          console.warn(`⚠️ Fallback to ${hfFallback} also failed: ${fbErr.message}`);
          lastError = fbErr;
        }
      }
    }
  } else {
    lastError = new Error("No Hugging Face token configured.");
  }

  // Phase 3: Try Custom Provider Fallback (if HF failed/truncated or is unconfigured)
  const fallbackApiKey = process.env.FALLBACK_API_KEY || process.env.MODELSCOPE_API_KEY || process.env.MODELSCOPE_TOKEN;
  if ((!data || lastError) && fallbackApiKey) {
    let fallbackBaseUrl = process.env.FALLBACK_BASE_URL || 'https://api-inference.modelscope.cn/v1';
    if (!fallbackBaseUrl.endsWith('/chat/completions')) {
      fallbackBaseUrl = fallbackBaseUrl.replace(/\/$/, '') + '/chat/completions';
    }
    const fallbackModel = process.env.FALLBACK_MODEL || process.env.MODELSCOPE_MODEL || 'Qwen/Qwen2.5-72B-Instruct';
    
    console.log(`🔄 [Fallback LLM] Falling back to custom provider API: ${fallbackBaseUrl} using model: ${fallbackModel}...`);
    try {
      const headers = {
        'Authorization': `Bearer ${fallbackApiKey}`,
        'Content-Type': 'application/json',
      };
      if (fallbackBaseUrl.includes('models.github.ai')) {
        headers['Accept'] = 'application/vnd.github+json';
        headers['X-GitHub-Api-Version'] = '2022-11-28';
      }
      const msResponse = await fetch(fallbackBaseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: fallbackModel,
          messages,
          max_tokens: 3000,
          temperature: 0.2,
        }),
      });
      if (!msResponse.ok) {
        const body = await msResponse.text();
        throw new Error(`Fallback API error ${msResponse.status}: ${body.slice(0, 200)}`);
      }
      const msData = await msResponse.json();
      if (!msData || !msData.choices || !msData.choices[0] || !msData.choices[0].message) {
        throw new Error("Empty or malformed response from Custom Fallback API");
      }
      const content = msData.choices[0].message.content;
      const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
      data = robustJsonParse(jsonStr);
      response = msData;
      console.log(`✅ [Fallback LLM] Successfully generated tailored CV using fallback provider.`);
      lastError = null; // cleared
    } catch (msErr) {
      console.error(`❌ [Fallback LLM] Fallback failed: ${msErr.message}`);
      throw new Error(`Both Hugging Face and Fallback LLM failed.\nHF Error: ${lastError ? lastError.message : 'unconfigured'}.\nFallback Error: ${msErr.message}`);
    }
  }

  // If we still don't have data, throw the last error
  if (!data) {
    throw lastError || new Error("Failed to generate tailored CV from all providers.");
  }

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

  if (data?.resume) {
    const llmDraft = JSON.parse(JSON.stringify(data.resume));

    // Plan-driven execution: deterministic summary/competencies/experience with selective employers.
    // LLM draft is kept only as a comparison candidate + optional summary/cover hint.
    const executed = executeTailoringPlan(plan, profile, {
      jdText: jd,
      companyName,
      llmSummary: data.resume.summary,
      llmCoverLetter: data.cover_letter,
    });

    // Merge any strong LLM bullets for mutable roles that still look thin
    if (llmDraft.experience && typeof llmDraft.experience === 'object' && !Array.isArray(llmDraft.experience)) {
      for (const idx of plan.tailorIndices) {
        const key = String(idx);
        const llmBullets = Array.isArray(llmDraft.experience[key]) ? llmDraft.experience[key] : [];
        const cur = Array.isArray(executed.resume.experience[key]) ? executed.resume.experience[key] : [];
        if (llmBullets.length >= 3 && cur.length < 3) {
          executed.resume.experience[key] = llmBullets.slice(0, 5);
        }
      }
      executed.resume = restorePreservedEmployers(executed.resume, executed.preservedSnapshot);
    }

    data.resume = executed.resume;
    data.cover_letter = executed.cover_letter || data.cover_letter;
    data.jd_alignment_score = executed.jd_alignment_score;
    data.jd_gap_keywords = gapKeywords;
    data.ats_content_score = executed.ats_content_score;
    data.tailoring_plan = plan;
    data.preserved_snapshot = executed.preservedSnapshot;

    console.log(
      `🎯 JD ATS alignment: ${executed.jd_alignment_score}% (plan family=${plan.family}; frozen roles=${plan.preserveIndices.length})`
    );
    if (gapKeywords.length > 0) {
      console.warn(`⚠ Experience stays factual — gaps only in skills/ATS: ${gapKeywords.slice(0, 8).join(', ')}`);
    }

    const audit = auditResumeQuality(data.resume);
    console.log(`📈 Estimated ATS content score: ${executed.ats_content_score}/100 (target 90+)`);
    if ((executed.ats_content_score ?? 0) < 90) {
      console.warn(`⚠ ATS score ${executed.ats_content_score} below 90 — alignment gate will re-polish or fail`);
    }
    if (audit.repeatedVerbs.length > 0) {
      console.warn(`⚠ Remaining repeated verbs: ${audit.repeatedVerbs.join(', ')}`);
    }
    if (audit.repeatedWords.length > 0) {
      console.warn(`⚠ Remaining repeated words: ${audit.repeatedWords.join(', ')}`);
    }
    if (audit.withoutMetrics > 0 && audit.totalBullets > 0) {
      const pct = Math.round(((audit.totalBullets - audit.withoutMetrics) / audit.totalBullets) * 100);
      console.log(`📈 Quantified impact coverage: ${pct}% of bullets (${audit.totalBullets - audit.withoutMetrics}/${audit.totalBullets})`);
    }

    return applyAlignmentGate(data, jd, profile, companyName, llmDraft, plan);
  }

  return data;
}

/** Compare source / LLM / aligned resumes; keep the strongest honest candidate or throw. */
function applyAlignmentGate(data, jd, profile, companyName, llmDraft, plan = null) {
  const activePlan = plan || data.tailoring_plan || buildTailoringPlan(jd, profile);
  let working = data.resume;

  // Repair pass when mutable-role coverage is weak
  let mutable = measureMutableRoleCoverage(
    working,
    activePlan,
    [
      ...(activePlan.keywords.weave || []),
      ...(activePlan.keywords.honest || []),
      ...(activePlan.keywords.domain || []),
    ],
  );
  const minRatio = activePlan.validation?.mutableCoverageMin ?? 0.45;
  if (mutable.matchRatio < minRatio) {
    console.warn(
      `⚠ Mutable-role JD coverage ${mutable.score}% < ${Math.round(minRatio * 100)}% — running repair pass`,
    );
    working = repairTailoredResume(working, activePlan, profile, jd);
    const repaired = executeTailoringPlan(activePlan, profile, {
      jdText: jd,
      companyName,
      llmSummary: working.summary,
      llmCoverLetter: data.cover_letter,
    });
    working = repaired.resume;
    data.preserved_snapshot = repaired.preservedSnapshot;
    mutable = measureMutableRoleCoverage(
      working,
      activePlan,
      [...(activePlan.keywords.honest || []), ...(activePlan.keywords.domain || [])],
    );
  }

  // Freeze restore before gate
  if (data.preserved_snapshot) {
    working = restorePreservedEmployers(working, data.preserved_snapshot);
  }
  data.resume = working;
  data.tailoring_plan = activePlan;
  data.mutable_role_coverage = mutable;

  const alignment = validateResumeAlignment({
    jdText: jd,
    profile,
    sourceResume: buildSourceResumeFromProfile(profile, jd),
    llmDraft: llmDraft || data.resume,
    finalResume: data.resume,
    meta: { company: companyName || '' },
    plan: activePlan,
    preservedSnapshot: data.preserved_snapshot,
  });
  printAlignmentConfirmation(alignment);
  data.alignment_confirmation = alignment;
  data.resume = alignment.selectedResume || data.resume;
  if (data.preserved_snapshot) {
    data.resume = restorePreservedEmployers(data.resume, data.preserved_snapshot);
  }
  if (alignment.selected?.ats != null) {
    data.ats_content_score = alignment.selected.ats;
  }
  if (alignment.selected?.honestCoverage != null) {
    data.jd_alignment_score = alignment.selected.honestCoverage;
  }

  // Hard fail on frozen-role drift or keyword-sprinkle trap (rich skills, empty mutable experience)
  const frozen = assertPreservedEquality(data.resume, data.preserved_snapshot || {});
  if (!frozen.pass) {
    alignment.verdict = 'FAIL';
    alignment.reasons = [
      ...(alignment.reasons || []),
      `Frozen employers changed: ${frozen.mismatches.map((m) => m.roleIndex).join(', ')}`,
    ];
  }
  const compsAlign = measureJdAlignment(
    { core_competencies: data.resume?.core_competencies || [] },
    activePlan.keywords.atsMirror || [],
  );
  mutable = measureMutableRoleCoverage(
    data.resume,
    activePlan,
    [
      ...(activePlan.keywords.weave || []),
      ...(activePlan.keywords.honest || []),
      ...(activePlan.keywords.domain || []),
    ],
  );
  data.mutable_role_coverage = mutable;
  if (compsAlign.matchRatio >= 0.7 && (mutable.roleHitRatio ?? 0) < 0.5 && activePlan.tailorIndices.length) {
    alignment.verdict = 'FAIL';
    alignment.reasons = [
      ...(alignment.reasons || []),
      `Keyword sprinkle trap: competencies ${compsAlign.score}% but only ${mutable.rolesWithHit}/${activePlan.tailorIndices.length} mutable roles carry JD terms`,
    ];
  }
  const minMutable = activePlan.validation?.mutableCoverageMin ?? 0.35;
  if (mutable.matchRatio < minMutable && activePlan.tailorIndices.length) {
    alignment.verdict = 'FAIL';
    alignment.reasons = [
      ...(alignment.reasons || []),
      `Mutable-role JD coverage ${mutable.score}% below floor ${Math.round(minMutable * 100)}%`,
    ];
  }

  // Generate the JD-tailored resume even when coverage is below the floor.
  // Shortfalls are warnings — never block the deliverable the user asked for.
  if (alignment.verdict !== 'PASS') {
    console.warn(
      `⚠ Alignment warnings — resume still generated:\n${(alignment.reasons || []).map((r) => `  - ${r}`).join('\n')}`
    );
    // Fall back to the strongest available resume so the user always gets output.
    if (!data.resume || typeof data.resume !== 'object') {
      data.resume = alignment.selectedResume || llmDraft || buildSourceResumeFromProfile(profile, jd);
    }
    data.alignment_confirmation = alignment;
  }
  return data;
}

// Main Logic
(async () => {
  try {
    await checkSync();

    let jobId = null;
    let entry = { url: '', company: 'Direct Application', title: 'Job via URL' };

    if (/^https?:\/\//.test(idOrUrl)) {
      console.log("🔗 Direct URL detected. Searching database...");
      entry.url = idOrUrl;
      try {
        const [jobRecord] = await sql`
          SELECT id, user_id, url, company, title, company_type, jd_text
          FROM jobs
          WHERE url = ${idOrUrl} AND user_id = ${userId}
          LIMIT 1
        `;
        if (jobRecord) {
          entry = jobRecord;
          console.log(`📎 Found existing job in DB: id=${entry.id}, company=${entry.company}`);
        } else {
          const domain = new URL(idOrUrl).hostname;
          const parts = domain.split('.');
          if (parts.length >= 2) {
            entry.company = parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
          }
        }
      } catch (e) {
        console.warn('DB lookup failed for URL:', e.message);
      }
    } else {
      jobId = Number.parseInt(String(idOrUrl), 10);
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
              SELECT id, user_id, url, company, title, company_type, jd_text, jd_text
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
          SELECT id, user_id, url, company, title, company_type, jd_text
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
          SELECT id, user_id, url, company, title, company_type, jd_text
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

    const rawProfile = profileRow.resume_context;
    let profile = rawProfile;
    const { profile: hydratedProfile, hydrated, educationRepaired, sources } = hydrateResumeProfile(profile);
    profile = hydratedProfile;
    if (typeof rawProfile === 'string' || rawProfile?.resume_context || rawProfile?.profile) {
      console.log('🧩 Normalized serialized/nested resume_context from database.');
    }
    if (hydrated) {
      console.log(`💧 Hydrated profile from: ${sources.join(', ')}`);
    }
    if (educationRepaired) {
      console.log('🎓 Repaired corrupted education date fields in profile.');
    }
    if (hydrated || educationRepaired) {
      try {
        await sql`
          UPDATE user_profiles
          SET resume_context = ${JSON.stringify(hydratedProfile)}::jsonb, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ${userId}
        `;
        console.log('💾 Synced profile fixes back to database.');
      } catch (syncErr) {
        console.warn(`⚠ Could not persist hydrated profile: ${syncErr.message}`);
      }
    }

    // Debug profile data
    console.log(`[DEBUG] Profile loaded: hasExperience=${Array.isArray(profile?.experience)}, expCount=${profile?.experience?.length || 0}, hasEducation=${Array.isArray(profile?.education)}, eduCount=${profile?.education?.length || 0}`);
    console.log(`[DEBUG] Profile narrative: headline="${profile?.narrative?.headline || 'N/A'}", hasSuperpowers=${Array.isArray(profile?.narrative?.superpowers)}, superpowersCount=${profile?.narrative?.superpowers?.length || 0}`);
    if (!Array.isArray(profile?.experience) || profile.experience.length === 0) {
      throw new Error(
        `Profile incomplete for user ${userId}: no experience entries were found after normalization. `
        + 'Open Dashboard → Settings, import/save the resume, then retry tailor --deep. '
        + 'Tailoring stopped before calling an LLM because alignment cannot be verified without source evidence.'
      );
    }

    // Override HuggingFace global instance if the user has provided their own token
    if (profileRow.hf_token) {
      await getHfClient(profileRow.hf_token);
    } else {
      await getHfClient();
    }

    console.log(`🎯 Target identified: ${entry.company}`);
    const jdText = await resolveJdText(entry);
    if (!jdText || jdText.length < 100) {
      console.warn(`⚠️ JD text is very short (${jdText?.length || 0} chars). Resume tailoring may be generic. Re-scan or paste JD into pipeline.`);
    }
    const canonicalUrl = canonicalizeUrl(entry.url);
    const result = await tailorPackage(jdText, profile, entry.company, entry.company_type);
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
      `📊 ATS Score: ${atsScore.score}/100 (${atsScore.totalMatched}/${atsScore.total} proven JD terms in resume${atsScore.honestOnly ? '; gaps excluded' : ''})`
    );
    if (atsScore.gapKeywords?.length) {
      console.log(`ℹ️  JD gaps not claimed: ${atsScore.gapKeywords.slice(0, 8).join(', ')}`);
    }
    if (atsScore.missing?.length) {
      console.warn(`⚠️  Missing JD keywords in resume: ${atsScore.missing.slice(0, 8).join(', ')}`);
    }
    if (atsScore.totalMatched === 0) {
      console.warn(`\n⚠️  WARNING: 0 JD keywords matched in tailored resume.`);
      console.warn(`   JD may be empty or scrape failed (common on JS-rendered career pages without Playwright).`);
      console.warn(`👉 Run with --deep for Playwright scrape, or ensure jd_text is stored on the job record.\n`);
    }

    // Calculate Years of Experience
    const yearsExp = effectiveYearsOfExperience(profile);
    console.log(`📊 Years of Experience: ${yearsExp}`);

    // Warn if no experience data
    if (!profile.experience || profile.experience.length === 0) {
      console.warn('⚠ No experience data in profile. Resume will be incomplete. Please update your profile via Dashboard Settings.');
    }
    if (!profile.education || profile.education.length === 0) {
      console.warn('⚠ No education data in profile. Resume will be incomplete. Please update your profile via Dashboard Settings.');
    }

    const roleCount = (profile.experience || []).length;
    const maxPages = resolveResumePageBudget(yearsExp, roleCount);
    console.log(`📄 Resume length: up to ${maxPages} page${maxPages > 1 ? 's' : ''} (${roleCount} roles, ${yearsExp}+ years)`);

    // Prepare common replacements
    const c = profile.candidate || {};
    const contactParts = [c.location, c.email, c.phone].map((x) => String(x || '').trim()).filter(Boolean);
    const linkedinRaw = String(c.linkedin || '').trim().replace(/^https?:\/\//i, '');
    const githubRaw = String(c.github || '').trim().replace(/^https?:\/\//i, '');
    const linkParts = [];
    if (linkedinRaw) {
      linkParts.push(`<a href="https://${linkedinRaw}">${linkedinRaw}</a>`);
    }
    if (githubRaw) {
      linkParts.push(`<a href="https://${githubRaw}">${githubRaw.replace(/^github\.com\//i, '')}</a>`);
    }

    const commonReps = {
      NAME: c.full_name || '',
      EMAIL: c.email || '',
      LOCATION: c.location || '',
      PHONE: c.phone || '',
      CONTACT_LINE: contactParts.join(' · '),
      LINKS_LINE: linkParts.join(' · '),
      LINKEDIN_URL: linkedinRaw ? `https://${linkedinRaw}` : '#',
      LINKEDIN_DISPLAY: linkedinRaw || '',
      PORTFOLIO_URL: githubRaw ? `https://${githubRaw}` : '#',
      PORTFOLIO_DISPLAY: githubRaw || '',
      DATE: (profile?.cover_letter?.show_date !== false) ? new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
      COMPANY_NAME: entry.company,
      JOB_TITLE: entry.title || 'Open role',
      LANG: 'en',
      YEARS_EXP: `${yearsExp}`,
      MAX_PAGES: `${maxPages}`
    };

    // 1. GENERATE RESUME - Show ALL experience entries, just limit bullets per job based on page budget
    const experienceToShow = profile.experience || [];

    // Build portfolio link (conditional) — legacy slot; prefer LINKS_LINE
    const portfolioLink = '';

    // Hide sections if missing data (never show blank Education/Experience)
    const hasExperience = Array.isArray(experienceToShow) && experienceToShow.length > 0;
    const hasEducation = Array.isArray(profile.education) && profile.education.length > 0;

    const hasAchievements = Array.isArray(profile.narrative?.proof_points) && profile.narrative.proof_points.length > 0;

    const yearsInline = yearsExp > 0 ? ` • ${yearsExp}+ years` : '';

    const skillsLines = renderCategorizedSkills(profile.narrative?.superpowers || [], tailoring?.core_competencies || []);
    const hasSkills = Boolean(skillsLines && String(skillsLines).trim().length > 0);

    // Final catch-all: strip LLM splice artifacts from bullets right before render
    if (tailoring?.experience && typeof tailoring.experience === 'object') {
      for (const key of Object.keys(tailoring.experience)) {
        const bullets = tailoring.experience[key];
        if (Array.isArray(bullets)) {
          tailoring.experience[key] = bullets.map((b) => removeSplicedFragments(b));
        }
      }
    }

    const resumeReps = {
      ...commonReps,
      SUMMARY_TEXT: formatResumeSummaryHtml(tailoring?.summary, yearsExp),
      EXPERIENCE: hasExperience ? renderExperience(experienceToShow, tailoring.experience, jdText, maxPages) : '',
      EXPERIENCE_DISPLAY: hasExperience ? 'block' : 'none',
      ACHIEVEMENTS: hasAchievements ? renderAchievements(profile.narrative.proof_points) : '',
      ACHIEVEMENTS_DISPLAY: hasAchievements ? 'block' : 'none',
      EDUCATION: hasEducation ? renderEducation(profile.education) : '',
      EDUCATION_DISPLAY: hasEducation ? 'block' : 'none',
      SKILLS_LINES: skillsLines,
      SKILLS_DISPLAY: hasSkills ? 'block' : 'none',
      YEARS_EXP_INLINE: yearsInline,
      PORTFOLIO_LINK: portfolioLink
    };

    let resumeHtml = fs.readFileSync(resolveTemplatePath(profile), 'utf8');
    Object.entries(resumeReps).forEach(([key, val]) => {
      resumeHtml = resumeHtml.replace(new RegExp(`{{${key}}}`, 'g'), val || '');
    });

    let roleTitle = entry.title || 'Role';
    if (jdText) {
      const titleLine = jdText.split('\n').find((l) => l.toLowerCase().startsWith('job title:'));
      if (titleLine) {
        roleTitle = titleLine.substring(titleLine.indexOf(':') + 1).trim();
      }
    }

    const docPaths = buildApplicationDocumentPaths({
      candidateName: c.full_name || 'Candidate',
      company: entry.company || 'Company',
      roleTitle,
    });
    const resumePathHtml = docPaths.resumeHtml;
    const resumePathPdf = docPaths.resumePdf;
    const clPathHtml = docPaths.coverHtml;
    const clPathPdf = docPaths.coverPdf;

    if (!fs.existsSync('output')) fs.mkdirSync('output');

    // Persist alignment confirmation beside the resume (PASS path)
    if (result.alignment_confirmation) {
      result.alignment_confirmation.meta = {
        ...(result.alignment_confirmation.meta || {}),
        company: entry.company || '',
        role: roleTitle,
        resumePath: resumePathHtml,
      };
      const written = writeAlignmentReport(result.alignment_confirmation, resumePathHtml);
      console.log(`🧾 Alignment report: ${written.mdPath}`);
    }

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
          ADD COLUMN IF NOT EXISTS jd_text TEXT,
          ADD COLUMN IF NOT EXISTS ats_content_score INTEGER;
      `;
      
      // Job title for DB (same as filename role segment)
      const inferredTitle = roleTitle;

      // We assume entry.id exists if it came from DB, else we try to find it by URL or insert it
      if (!entry.id) {
        const [existing] = await sql`
          SELECT id FROM jobs WHERE url = ${entry.url} AND user_id = ${userId} LIMIT 1
        `;
        if (existing) {
          entry.id = existing.id;
          console.log(`📎 Found existing job ID ${entry.id} via URL search.`);
        } else {
          // INSERT a new job!
          const [inserted] = await sql`
            INSERT INTO jobs (user_id, url, canonical_url, company, title, source, score, jd_text, resume_html, cover_letter_html, created_at)
            VALUES (
              ${userId}, 
              ${entry.url}, 
              ${canonicalUrl || entry.url}, 
              ${entry.company || 'Direct Application'}, 
              ${inferredTitle}, 
              'Direct', 
              ${atsScore ? Math.round(atsScore.score / 10) : 5}, 
              ${String(jdText || '').slice(0, 25000)}, 
              ${resumeHtml}, 
              ${clHtml}, 
              NOW()
            )
            RETURNING id
          `;
          if (inserted) {
            entry.id = inserted.id;
            console.log(`🆕 Created new job record in database: id=${entry.id}`);
          }
        }
      }

      if (entry.id) {
        await sql`
          UPDATE jobs
          SET
            resume_html = ${resumeHtml},
            cover_letter_html = ${clHtml},
            canonical_url = COALESCE(${canonicalUrl}, canonical_url),
            jd_text = COALESCE(${String(jdText || '').slice(0, 25000)}, jd_text),
            ats_content_score = COALESCE(${result.ats_content_score ?? null}, ats_content_score)
          WHERE id = ${entry.id} AND user_id = ${userId}
        `;
        console.log(`💾 HTML assets persisted to database for job ID ${entry.id}. You can view/print them from the dashboard!`);
      } else {
        console.warn(`⚠ Could not resolve or create job record, skipping HTML persistence.`);
      }
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
              console.log('💾 PDFs uploaded to R2 and keys persisted to database.');
            } else {
              console.warn('⚠ Skipping PDF key persistence as job ID is missing.');
            }
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
    console.error("❌ Agentic Tailor Failed:", err.message || err);
    if (err?.alignmentResult) {
      try {
        if (!fs.existsSync('output')) fs.mkdirSync('output');
        const failBase = path.join(
          'output',
          `alignment-failed-${Date.now()}`
        );
        const written = writeAlignmentReport(err.alignmentResult, failBase);
        console.error(`🧾 Alignment FAIL report: ${written.mdPath}`);
      } catch (reportErr) {
        console.error(`⚠ Could not write alignment fail report: ${reportErr.message}`);
      }
    }
    process.exitCode = 1;
  }
})();
