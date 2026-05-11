import fs from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import sql from './db/client.mjs';

let hf = null;
let hfUnavailable = false;
let hfTokenInUse = '';
const HF_MODEL = 'MiniMaxAI/MiniMax-M2.7';
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

async function callHfChatViaHttp(messages) {
  if (!hfTokenInUse) return null;
  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfTokenInUse}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages,
      max_tokens: 2000,
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


// ── UTILITIES ──

function renderExperience(exp, tailoredBullets, jdText = '', maxPages = 2) {
  if (!Array.isArray(exp) || exp.length === 0) return '';

  // Limit bullets per job based on page count
  const maxBulletsPerJob = maxPages >= 3 ? 6 : maxPages >= 2 ? 4 : 3;

  // Find the most relevant job to apply tailored bullets
  let tailoredJobIndex = 0;
  if (jdText && tailoredBullets && tailoredBullets.length > 0) {
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
  }

  return exp.map((job, idx) => {
    const useTailored = (idx === tailoredJobIndex) && tailoredBullets && tailoredBullets.length > 0;
    if (useTailored) {
      console.log(`[DEBUG] Applying ${tailoredBullets.length} tailored bullets to job #${idx + 1} (${job.role})`);
    }
    const bullets = useTailored
      ? tailoredBullets.slice(0, maxBulletsPerJob)
      : (job.bullets || []).slice(0, maxBulletsPerJob);

    return `
    <div class="job">
      <div class="job-header">
        <span>${job.role}</span>
        <span>${job.period}</span>
      </div>
      <div class="job-meta">${job.company}</div>
      <ul>
        ${bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>
    </div>
  `;
  }).join('');
}

function calculateYearsOfExperience(exp) {
  if (!Array.isArray(exp) || exp.length === 0) return 0;
  let totalYears = 0;
  for (const job of exp) {
    const period = job.period || '';
    const match = period.match(/(\d{4})/g);
    if (match && match.length >= 2) {
      const start = parseInt(match[0], 10);
      const end = period.toLowerCase().includes('present') ? new Date().getFullYear() : parseInt(match[match.length - 1], 10);
      totalYears += Math.max(0, end - start);
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
 * ATS-style overlap score: distinct resume lines (superpowers, bullets, tailored
 * competencies) that share a token with the JD. Not comparable to Enhancv-style
 * grammar/quantification/parse checks.
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

function generateATSScoreBar(score) {
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444';
  return `<div style="margin-top:8px"><div style="font-size:9pt;color:#666;margin-bottom:4px">ATS Compatibility: ${score}/100</div><div style="width:100%;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden"><div style="width:${score}%;height:100%;background:${color};transition:width 0.3s"></div></div></div>`;
}

function renderEducation(edu) {
  if (!Array.isArray(edu) || edu.length === 0) return '';
  return edu.map(e => `
    <div class="edu-item">
      <div class="edu-header">${e.degree} (${e.period}), ${e.school}</div>
    </div>
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

function renderCategorizedSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return '';

  // Generic professional categories that work for ANY industry
  const cats = {
    "Core Competencies": [],
    "Technical Skills": [],
    "Tools & Platforms": [],
    "Methodologies": []
  };

  // Keywords to auto-categorize (works for software, marketing, sales, healthcare, finance, etc.)
  const categoryKeywords = {
    "Core Competencies": ["management", "leadership", "communication", "analysis", "strategy", "planning", "research", "design", "development", "consulting", "advisory", "operations"],
    "Technical Skills": ["programming", "coding", "data", "analytics", "engineering", "architecture", "cloud", "database", "automation", "ml", "ai", "statistical", "modeling"],
    "Tools & Platforms": ["software", "platform", "tool", "system", "framework", "suite", "app", "application", "crm", "erp", "aws", "azure", "gcp", "salesforce", "sap", "excel", "tableau"],
    "Methodologies": ["agile", "scrum", "kanban", "waterfall", "lean", "six sigma", "process", "workflow", "framework", "standard", "compliance", "iso", "gdpr"]
  };

  // Sort skills into categories
  const categorized = { ...cats };
  const uncategorized = [];

  for (const skill of skills) {
    const skillLower = skill.toLowerCase();
    let matched = false;

    for (const [catName, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(k => skillLower.includes(k))) {
        categorized[catName].push(skill);
        matched = true;
        break;
      }
    }

    if (!matched) {
      uncategorized.push(skill);
    }
  }

  // Add uncategorized to Core Competencies
  if (uncategorized.length > 0) {
    categorized["Core Competencies"].push(...uncategorized);
  }

  // Generate HTML - only show categories that have skills
  let html = '';
  for (const [name, skillList] of Object.entries(categorized)) {
    if (skillList.length > 0) {
      // Remove duplicates and limit to reasonable number
      const unique = [...new Set(skillList)].slice(0, 8);
      html += `<div class="skills-category"><span class="skills-label">${name}:</span> ${unique.join(', ')}</div>`;
    }
  }

  return html || skills.slice(0, 12).join(', '); // Fallback: plain list if no categorization worked
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
    return {
      resume: {
        summary: normalizeResumeSummaryPlain(
          profile?.narrative?.exit_story ||
            `Engineer with ${y || 'several'}+ years building production systems and APIs.`,
          y
        ),
        core_competencies: (profile?.narrative?.superpowers || []).slice(0, 12),
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
  const cvContext = `Approximate career span from dated roles below: ~${yearsExp} years (only state a number if it matches these dates; never invent more).

Headline: ${profile?.narrative?.headline || ''}
Positioning (from profile): ${profile?.narrative?.exit_story || ''}
Superpowers / keywords: ${(profile?.narrative?.superpowers || []).join(', ')}

Recent roles — fact base for what you worked on (paraphrase; do not fabricate employers or metrics):
${experienceDigest}`;
  const prompt = `
You are a senior technical writer who produces concise, professional business correspondence.

GLOBAL RULES:
- NO buzzwords: passion, leveraging, synergies, robust, seamless, cutting-edge, proven track record
- NO AI-sounding phrases
- Use short sentences, active voice, specific numbers where they appear in the digest
- Lead with substance, not filler

TASK:
1. RESUME TAILORING: CRITICAL - Every bullet must include at least ONE specific technology/requirement from the JD:
   - **Professional summary** (resume.summary): EXACTLY 3–4 lines as ONE JSON string with newline characters \\n between lines (not HTML). Line 1: title/scope plus years of experience grounded in the digest above. Lines 2–4: concrete domains, stacks, systems, and outcomes you have shipped (from digest + superpowers), lightly aligned to the JD — no filler, no soft-skill-only fluff. Total under ~90 words. No bullet characters unless they read naturally in prose.
   - 8-10 core competencies (skills/tools from JD)
   - 3 rewritten bullets for ONE role that maps to JD requirements

   BULLET REQUIREMENTS:
   - Each bullet MUST name-drop a specific technology, tool, or requirement from the JD
   - Generic bullets like "Led a team to deliver results" are FORBIDDEN
   - Good example: "Deployed microservices on AWS ECS with Terraform, cutting deploy time 40%"
   - Bad example: "Improved system performance significantly"
   - If JD mentions React, say React (not "frontend framework")
   - If JD mentions Kubernetes, say Kubernetes (not "orchestration platform")

2. COVER LETTER (body only — the HTML template already prints "Dear Hiring Manager," and "Sincerely,"):
   - Return ONLY the letter body: NO salutation, NO sign-off, NO "Dear ...", NO "Sincerely", NO "Best regards"
   - Tone: first person, formal business letter. Do NOT address the reader as "you/your team" or open with "Your [X] team builds...". Prefer "I am writing...", "The posting emphasizes...", "My experience includes..."
   - Forbidden openings: "Dear [Company] Team", "Dear Hiring Team", "Your team", "You are looking for"
   - Structure: EXACTLY 3 short paragraphs, separated by blank lines (use \\n\\n between paragraphs in the JSON string)
   - Para 1: Interest in this opportunity at ${companyName}; reference one concrete requirement or theme from the JD in neutral, professional language
   - Para 2: Map your verified experience to those requirements with tools and outcomes from the digest — never invent employers or metrics
   - Para 3: Availability and how to reach you — use the candidate email and phone from My Context exactly if present; NEVER use placeholders like [your email] or [your phone]

JD:
${jd.substring(0, 4000)}

My Context:
${cvContext}

OUTPUT FORMAT (JSON ONLY):
{
  "resume": {
    "summary": "...",
    "core_competencies": ["kw1", "kw2", ...],
    "experience": ["bullet1", "bullet2", "bullet3"]
  },
  "cover_letter": "paragraph1\\n\\nparagraph2\\n\\nparagraph3 (body only; template adds greeting and closing)"
}
  `;

  const messages = [
    { role: "system", content: "You are a professional recruiting assistant. Return ONLY valid JSON." },
    { role: "user", content: prompt }
  ];

  let response;
  if (hfClient) {
    response = await hfClient.chatCompletion({
      model: HF_MODEL,
      messages,
      max_tokens: 2000,
      temperature: 0.2
    });
  } else {
    response = await callHfChatViaHttp(messages);
  }

  try {
    const content = response.choices[0].message.content;
    const jsonStr = content.substring(content.indexOf('{'), content.lastIndexOf('}') + 1);
    const data = JSON.parse(jsonStr);
    const y = calculateYearsOfExperience(profile?.experience);
    if (data?.resume?.summary) {
      data.resume.summary = normalizeResumeSummaryPlain(data.resume.summary, y);
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
    console.log(`[DEBUG] AI generated ${(tailoring?.experience || []).length} tailored bullets:`);
    (tailoring?.experience || []).forEach((b, i) => console.log(`  ${i + 1}. ${b?.substring(0, 60)}...`));
    
    // Prepare common replacements
    const c = profile.candidate;
    // Calculate years of experience and ATS score
    const yearsExp = calculateYearsOfExperience(profile.experience);
    const atsScore = calculateATSScore(profile, jdText, tailoring);

    // Determine max pages based on experience (1 page for 0-5yrs, 2 pages for 6-11yrs, up to 4 for 12-20yrs)
    const maxPages = yearsExp <= 5 ? 1 : yearsExp <= 11 ? 2 : yearsExp <= 20 ? 3 : 4;
    console.log(`[RESUME] ${yearsExp} years experience → ${maxPages} page(s)`);
    console.log(
      `[RESUME] ATS Score: ${atsScore.score}/100 (${atsScore.totalMatched}/${atsScore.total} resume lines share JD tokens)`
    );

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
      ATS_SCORE: `${atsScore.score}/100`,
      ATS_SCORE_BAR: generateATSScoreBar(atsScore.score),
      YEARS_EXP: `${yearsExp}`,
      MAX_PAGES: `${maxPages}`,
      ATS_BADGE: atsScore.score >= 85 ? '<span class="ats-badge ats-high">High Match</span>' : atsScore.score >= 70 ? '<span class="ats-badge ats-medium">Good Match</span>' : ''
    };

    // 1. GENERATE RESUME - Dynamic length based on experience
    const experienceToShow = maxPages >= 3 ? profile.experience : profile.experience?.slice(0, maxPages * 2) || [];

    const resumeReps = {
      ...commonReps,
      SECTION_SUMMARY: 'Professional Summary',
      SUMMARY_TEXT: formatResumeSummaryHtml(tailoring.summary, yearsExp),
      SECTION_COMPETENCIES: 'Core Competencies',
      COMPETENCIES: (Array.isArray(tailoring.core_competencies) ? tailoring.core_competencies : []).map(skill => `<span class="competency-tag">${skill}</span>`).join(''),
      SECTION_EXPERIENCE: 'Professional Experience',
      EXPERIENCE: renderExperience(experienceToShow, tailoring.experience, jdText, maxPages),
      SECTION_PROJECTS: 'Selected Achievements',
      PROJECTS: renderProjects(profile.narrative.proof_points),
      SECTION_EDUCATION: 'Education',
      EDUCATION: renderEducation(profile.education),
      SECTION_SKILLS: 'Technical Skills',
      SKILLS: renderCategorizedSkills(profile.narrative.superpowers),
      SECTION_CERTIFICATIONS: '',
      CERTIFICATIONS: '',
      PAGE_WIDTH: '800px'
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
