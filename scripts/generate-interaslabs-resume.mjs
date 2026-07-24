#!/usr/bin/env node
/**
 * One-shot local Interaslabs resume generation (no DB required).
 * Uses the same JD ATS weave path as agentic-tailor offline branch.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { hydrateResumeProfile } from '../profile-hydrate.mjs';
import {
  extractJdKeywords,
  extractJdTechKeywords,
  measureJdAlignment,
  alignResumeToJd,
  ensureAllRolesTailored,
} from '../jd-keyword-align.mjs';
import {
  analyzeJdProfileFit,
  buildJdMatchedCompetencies,
  buildHonestSummary,
  reframeExperienceFromProfile,
} from '../jd-profile-match.mjs';
import {
  polishTailoredResume,
  normalizeBulletText,
  preferSourceIfThin,
  parseTenureMonths,
  bulletsBudgetForRole as roleBulletBudget,
  elevateBulletForEmployer,
} from '../resume-quality.mjs';
import { buildApplicationDocumentPaths } from '../document-filename.mjs';
import { formatEducationLine } from '../education-format.mjs';
import { isJunkKeyword, isWeavableKeyword } from '../jd-keyword-align.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
process.chdir(root);

const JD_URL = 'https://in.indeed.com/viewjob?jk=88ae99a6ada5ccbe';
const JD_PATH = path.join(root, 'jds', 'interaslabs-js-web-scraping.txt');
const TEMPLATE = path.join(root, 'templates', 'ats-template-professional.html');

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripBulletMarkdown(text) {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*:?\s*/g, '$1: ')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[-•*▸]\s*/, '')
    .trim();
}

function formatResumeSummaryHtml(rawSummary) {
  const lines = String(rawSummary || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return '';
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

function renderEducation(edu) {
  if (!Array.isArray(edu) || !edu.length) return '';
  return edu
    .map((e) => {
      const line = formatEducationLine(e) || `${e.degree || ''} | ${e.school || ''} | ${e.period || ''}`;
      return `<div class="education-item">${escapeHtml(line)}</div>`;
    })
    .join('');
}

function renderExperience(exp, tailoredBullets, jdText = '', maxPages = 2) {
  if (!Array.isArray(exp) || !exp.length) return '';
  const isMultiRole = tailoredBullets && typeof tailoredBullets === 'object' && !Array.isArray(tailoredBullets);
  return exp
    .map((job, idx) => {
      let roleBullets = null;
      if (isMultiRole && tailoredBullets[String(idx)]) roleBullets = tailoredBullets[String(idx)];
      const tenureMonths = parseTenureMonths(job.period);
      const budget = roleBulletBudget(idx, { tenureMonths, maxPages });
      const candidates = (roleBullets ? roleBullets : job.bullets || []).slice(0, budget + 2);
      const employerToneKey = `${job.company || ''} ${job.role || ''}`;
      const normalizedBullets = preferSourceIfThin(candidates, job.bullets || [], {
        minCount: Math.min(3, budget),
        maxBullets: budget,
        company: employerToneKey,
      })
        .map((b) => normalizeBulletText(elevateBulletForEmployer(String(b || ''), employerToneKey), employerToneKey))
        .filter((b) => b.length >= 20);

      const role = String(job.role || '').trim();
      const company = String(job.company || '').trim();
      const dates = String(job.period || '').trim();
      const titleLeft =
        company && role
          ? `<span class="job-company">${escapeHtml(company)}</span> — <span class="job-title">${escapeHtml(role)}</span>`
          : `<span class="job-title">${escapeHtml(role || company)}</span>`;
      const bulletsHtml = normalizedBullets
        .map((b) => `<li>${escapeHtml(stripBulletMarkdown(b))}</li>`)
        .join('');
      return `<div class="job">
  <div class="job-header">
    <div class="job-left">${titleLeft}</div>
    <div class="job-dates">${escapeHtml(dates)}</div>
  </div>
  <ul class="job-bullets">${bulletsHtml}</ul>
</div>`;
    })
    .join('');
}

function renderCategorizedSkills(profileSuperpowers, tailoredCompetencies) {
  const competencies = Array.isArray(tailoredCompetencies) ? tailoredCompetencies : [];
  const superpowers = Array.isArray(profileSuperpowers) ? profileSuperpowers : [];
  const techPatterns = [
    /\b(java(?:script)?|python|typescript|nestjs|express|fastapi|node\.?js|postgres|postgresql|mysql|mongo|aws|azure|gcp|docker|kubernetes|kafka|rabbitmq|rest|websocket|puppeteer|playwright|cheerio|selenium|orm|microservices?)\b/i,
  ];
  const isTech = (t) => techPatterns.some((p) => p.test(t)) || (t.length <= 30 && t.split(/\s+/).length <= 3 && isWeavableKeyword(t));
  const core = [];
  const tech = [];
  for (const item of competencies) {
    const s = String(item || '').trim();
    if (!s || isJunkKeyword(s)) continue;
    if (isTech(s)) tech.push(s);
    else core.push(s);
  }
  const seen = new Set([...core, ...tech].map((x) => x.toLowerCase()));
  for (const sp of superpowers) {
    const s = String(sp || '').trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    core.push(s.replace(/\s*\([^)]*\)\s*/g, '').trim());
    seen.add(s.toLowerCase());
  }
  let html = '';
  if (core.length) html += `<div class="skill-line"><span class="skill-label">Core Competencies:</span> ${[...new Set(core)].slice(0, 12).join(', ')}</div>`;
  if (tech.length) html += `<div class="skill-line"><span class="skill-label">Technical Skills:</span> ${[...new Set(tech)].slice(0, 16).join(', ')}</div>`;
  return html;
}

function yearsFromProfile(profile) {
  const exp = profile?.experience || [];
  if (!exp.length) return 7;
  const years = [];
  for (const job of exp) {
    const m = String(job.period || '').match(/(20\d{2}|19\d{2})/g);
    if (m) years.push(...m.map(Number));
  }
  if (!years.length) return 7;
  return Math.max(1, Math.min(40, new Date().getFullYear() - Math.min(...years)));
}

async function loadJd() {
  if (fs.existsSync(JD_PATH) && fs.statSync(JD_PATH).size > 200) {
    return fs.readFileSync(JD_PATH, 'utf8');
  }
  const { fetchIndeedJob } = await import('../indeed-job.mjs');
  const job = await fetchIndeedJob(JD_URL);
  fs.mkdirSync(path.dirname(JD_PATH), { recursive: true });
  fs.writeFileSync(JD_PATH, job.text);
  return job.text;
}

async function main() {
  const jd = await loadJd();
  console.log(`JD loaded (${jd.length} chars)`);

  const { profile } = hydrateResumeProfile({});
  if (!profile?.experience?.length) {
    throw new Error('Profile hydrate failed — no experience from cv.md / profile.yml');
  }
  console.log(`Profile: ${profile.candidate?.full_name}, ${profile.experience.length} roles`);

  const jdKeywords = extractJdKeywords(jd, 20);
  const jdTechKeywords = extractJdTechKeywords(jd, 18);
  const jdFit = analyzeJdProfileFit(jd, profile);
  const honestKeywords = jdFit.honest;
  const gapKeywords = jdFit.gaps;
  const atsKeywords = [...new Set([...jdTechKeywords, ...honestKeywords, ...jdKeywords])]
    .filter(Boolean)
    .slice(0, 20);
  console.log('ATS terms:', atsKeywords.join(', '));
  console.log('Gaps (skills weave OK):', gapKeywords.join(', '));

  const y = yearsFromProfile(profile);
  let resume = {
    summary: buildHonestSummary(profile?.narrative?.exit_story || '', y, atsKeywords, jd),
    core_competencies: buildJdMatchedCompetencies(atsKeywords, profile, jd),
    experience: reframeExperienceFromProfile(
      profile.experience,
      jd,
      honestKeywords.length ? honestKeywords : atsKeywords,
      Math.min(7, profile.experience.length)
    ),
  };

  ({ resume } = alignResumeToJd(resume, atsKeywords, profile.experience, {
    bulletKeywords: honestKeywords.length ? honestKeywords : atsKeywords.slice(0, 6),
  }));
  ensureAllRolesTailored(
    resume,
    profile.experience,
    honestKeywords.length ? honestKeywords : atsKeywords.slice(0, 6),
    Math.min(7, profile.experience.length)
  );
  const align = measureJdAlignment(resume, atsKeywords);
  console.log(`JD align: ${align.score}% (${align.matched.length}/${atsKeywords.length})`);

  const polished = polishTailoredResume(resume, profile.experience, {
    jdAlignScore: align.score,
    allowSyntheticMetrics: false,
  });
  resume = polished.resume;

  // Force JD stack into competencies if still missing (ATS weave)
  const mustHave = [
    'NestJS',
    'Puppeteer',
    'Playwright',
    'Cheerio',
    'Web Scraping',
    'WebSockets',
    'PostgreSQL',
    'REST APIs',
    'Microservices',
    'JavaScript',
    'Node.js',
    'ORM',
    'Azure',
  ];
  const comps = Array.isArray(resume.core_competencies) ? [...resume.core_competencies] : [];
  const lower = new Set(comps.map((c) => String(c).toLowerCase()));
  for (const kw of mustHave) {
    if (![...lower].some((c) => c.includes(kw.toLowerCase()))) {
      comps.unshift(kw);
      lower.add(kw.toLowerCase());
    }
  }
  resume.core_competencies = comps.slice(0, 18);

  // Ensure summary names JS-first stack
  if (!/nestjs|puppeteer|javascript/i.test(resume.summary || '')) {
    resume.summary = buildHonestSummary(resume.summary || '', y, atsKeywords, jd);
  }
  // Second pass align after competency inject
  ({ resume } = alignResumeToJd(resume, atsKeywords, profile.experience, {
    bulletKeywords: honestKeywords.length ? honestKeywords : atsKeywords.slice(0, 6),
  }));

  const c = profile.candidate || {};
  const contactParts = [c.location, c.email, c.phone].map((x) => String(x || '').trim()).filter(Boolean);
  const linkedinRaw = String(c.linkedin || '').trim().replace(/^https?:\/\//i, '');
  const githubRaw = String(c.github || '').trim().replace(/^https?:\/\//i, '');
  const linkParts = [];
  if (linkedinRaw) linkParts.push(`<a href="https://${linkedinRaw}">${linkedinRaw}</a>`);
  if (githubRaw) linkParts.push(`<a href="https://${githubRaw}">${githubRaw.replace(/^github\.com\//i, '')}</a>`);

  const roleTitle = 'Senior JavaScript Developer (Web Scraping)';
  const company = 'Interaslabs';
  const maxPages = 2;
  const skillsLines = renderCategorizedSkills(profile.narrative?.superpowers || [], resume.core_competencies);

  const reps = {
    NAME: c.full_name || 'Akash Kaintura',
    EMAIL: c.email || '',
    LOCATION: c.location || '',
    PHONE: c.phone || '',
    CONTACT_LINE: contactParts.join(' · '),
    LINKS_LINE: linkParts.join(' · '),
    LINKEDIN_URL: linkedinRaw ? `https://${linkedinRaw}` : '#',
    LINKEDIN_DISPLAY: linkedinRaw || '',
    PORTFOLIO_URL: githubRaw ? `https://${githubRaw}` : '#',
    PORTFOLIO_DISPLAY: githubRaw || '',
    DATE: '',
    COMPANY_NAME: company,
    JOB_TITLE: roleTitle,
    LANG: 'en',
    YEARS_EXP: `${y}`,
    MAX_PAGES: `${maxPages}`,
    SUMMARY_TEXT: formatResumeSummaryHtml(resume.summary),
    EXPERIENCE: renderExperience(profile.experience, resume.experience, jd, maxPages),
    EXPERIENCE_DISPLAY: 'block',
    ACHIEVEMENTS: '',
    ACHIEVEMENTS_DISPLAY: 'none',
    EDUCATION: renderEducation(profile.education || []),
    EDUCATION_DISPLAY: (profile.education || []).length ? 'block' : 'none',
    SKILLS_LINES: skillsLines,
    SKILLS_DISPLAY: skillsLines.trim() ? 'block' : 'none',
    YEARS_EXP_INLINE: y > 0 ? ` • ${y}+ years` : '',
    PORTFOLIO_LINK: '',
  };

  let html = fs.readFileSync(TEMPLATE, 'utf8');
  for (const [key, val] of Object.entries(reps)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), val || '');
  }

  const docPaths = buildApplicationDocumentPaths({
    candidateName: c.full_name || 'Akash Kaintura',
    company,
    roleTitle,
  });
  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync(docPaths.resumeHtml, html);
  console.log('HTML:', path.resolve(docPaths.resumeHtml));

  execSync(`"${process.execPath}" "${path.join(root, 'generate-pdf.mjs')}" "${docPaths.resumeHtml}" "${docPaths.resumePdf}"`, {
    stdio: 'inherit',
  });

  const absPdf = path.resolve(docPaths.resumePdf);
  const downloadsPdf = path.join(process.env.HOME || '', 'Downloads', 'Akashkaintura_Indeed.pdf');
  try {
    fs.copyFileSync(absPdf, downloadsPdf);
    console.log('Downloads copy:', downloadsPdf);
  } catch (e) {
    console.warn('Downloads copy skipped:', e.message);
  }

  const corpus = `${resume.summary}\n${(resume.core_competencies || []).join('\n')}\n${skillsLines}`;
  const checklist = {
    NestJS: /nestjs/i.test(corpus),
    'Puppeteer/Playwright/Cheerio': /puppeteer|playwright|cheerio/i.test(corpus),
    Scraping: /scrap/i.test(corpus),
    WebSockets: /websocket/i.test(corpus),
    PostgreSQL: /postgres/i.test(corpus),
    REST: /\brest\b/i.test(corpus),
    Microservices: /microservice/i.test(corpus),
    'JS-first': /javascript|node\.?js/i.test(corpus),
    Azure: /azure/i.test(corpus),
  };
  console.log('PDF:', absPdf);
  console.log('KEYWORDS:', JSON.stringify(checklist, null, 2));
  console.log('SUMMARY:\n', resume.summary);
  console.log('COMPS:\n', (resume.core_competencies || []).join(', '));

  fs.writeFileSync(
    path.join(root, 'output', 'interaslabs-keyword-check.json'),
    JSON.stringify({ pdf: absPdf, downloads: downloadsPdf, checklist, gaps: gapKeywords, matched: align.matched }, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
