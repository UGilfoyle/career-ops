#!/usr/bin/env node
/**
 * Plan-driven local resume (+ optional cover) generator.
 * Usage:
 *   node scripts/run-plan-tailor.mjs --jd jds/foo.txt --company Deloitte --role "Senior Consultant - ETL Testing"
 *   node scripts/run-plan-tailor.mjs --jd jds/foo.txt --company Interaslabs --out-basename AkashKaintura_Interaslabs
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { hydrateResumeProfile } from '../profile-hydrate.mjs';
import { formatEducationLine } from '../education-format.mjs';
import {
  buildTailoringPlan,
  executeTailoringPlan,
  repairTailoredResume,
  assertPreservedEquality,
  measureMutableRoleCoverage,
  restorePreservedEmployers,
} from '../resume-tailoring-plan.mjs';
import { validateResumeAlignment, writeAlignmentReport } from '../resume-alignment-validator.mjs';
import { buildApplicationDocumentPaths } from '../document-filename.mjs';
import { buildHtml as buildCoverHtml } from '../generate-cover-letter.mjs';
import { renderContactBarHtml } from '../resume-contact-html.mjs';
import { renderCategorizedSkills } from '../resume-skills-html.mjs';
import { formatPeriodDisplay, filterProofPointsAlreadyInExperience } from '../resume-quality.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
process.chdir(root);

function arg(flag, fallback = '') {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// .summary-block uses white-space: pre-line — emit plain escaped text with newlines
function formatResumeSummaryHtml(rawSummary) {
  const sanitized = String(rawSummary || '').replace(/\s*—\s*/g, ': ').replace(/\s*–\s*/g, ' - ');
  const lines = sanitized.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  return escapeHtml(lines.join('\n'));
}

function renderEducation(edu) {
  if (!Array.isArray(edu) || !edu.length) return '';
  return edu.map((e) => {
    const line = formatEducationLine(e) || `${e.degree || ''} | ${e.school || ''} | ${e.period || ''}`;
    return `<div>${escapeHtml(line)}</div>`;
  }).join('');
}

function renderAchievements(proofPoints) {
  if (!Array.isArray(proofPoints) || !proofPoints.length) return '';
  return `<ul>${proofPoints.map((p) => {
    const name = escapeHtml(p?.name || 'Achievement');
    const metric = escapeHtml(p?.hero_metric || '');
    return `<li><strong>${name}:</strong> ${metric}</li>`;
  }).join('')}</ul>`;
}

function renderExperience(profile, resume, jdText = '') {
  const jobs = profile.experience || [];
  const jdLower = String(jdText || '').toLowerCase();
  return jobs.map((job, idx) => {
    const bullets = resume.experience?.[String(idx)] || job.bullets || [];
    const li = bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
    // Filter tech_stack to JD-relevant items; show all if no JD
    const rawStack = Array.isArray(job.tech_stack) ? job.tech_stack : [];
    const techMatchesJd = (tech) => {
      const t = String(tech || '').trim().toLowerCase();
      if (!t) return false;
      if (t === 'c#' || t === 'csharp') return /\bc#(?=[^\w]|$)/i.test(jdLower) || /\bcsharp\b/i.test(jdLower);
      if (t === '.net' || t === '.net core' || t === 'dotnet' || t === 'asp.net') {
        return /(?:^|[^\w])(?:\.net|dotnet)\b/i.test(jdLower) || /\basp\.net\b/i.test(jdLower);
      }
      if (t === 'c++' || t === 'cpp') return /c\+\+/i.test(jdLower);
      if (t === 'rabbitmq') return jdLower.includes('rabbitmq') || jdLower.includes('rabbit mq') || jdLower.includes('rabbit-mq');
      if (t === 'fastapi') return jdLower.includes('fastapi') || jdLower.includes('fast api');
      if (t === 'iot' && (/\biot\b/.test(jdLower) || jdLower.includes('internet of things'))) return true;
      if (t === 'mqtt' && /\bmqtt\b/.test(jdLower)) return true;
      if (t === 'openai' || t === 'openai api') return /\bopenai\b/.test(jdLower) || /\bchatgpt\b/.test(jdLower);
      if (t === 'k8s' && (/\bk8s\b/.test(jdLower) || jdLower.includes('kubernetes'))) return true;
      if (t === 'kubernetes' && (jdLower.includes('kubernetes') || /\bk8s\b/.test(jdLower))) return true;
      if (t === 'aws' && (/\baws\b/.test(jdLower) || jdLower.includes('amazon web services'))) return true;
      if (t === 'azure' && /\bazure\b/.test(jdLower)) return true;
      if (t === 'gcp' && (/\bgcp\b/.test(jdLower) || jdLower.includes('google cloud'))) return true;
      if (t === 'microservices' && /\bmicroservice/.test(jdLower)) return true;
      if (t === 'rest api' || t === 'restful apis' || t === 'rest') return /\brest/.test(jdLower);
      if (t === 'node.js' || t === 'nodejs' || t === 'node') return /\bnode(?:\.?js)?\b/.test(jdLower);
      if (t === 'react' || t === 'react.js' || t === 'reactjs') return /\breact(?:\.?js)?\b/.test(jdLower);
      if (t === 'java') return /\bjava\b/.test(jdLower);
      if (t === 'python') return /\bpython\b/.test(jdLower);
      if (t === 'spring' || t === 'spring boot') return /\bspring(?:\s*boot)?\b/.test(jdLower);
      if (t === 'kafka') return /\bkafka\b/.test(jdLower);
      if (t === 'sql server' || t === 'mssql') return /sql\s*server|mssql/i.test(jdLower);
      if (t.length <= 3) {
        return new RegExp(`(?<![A-Za-z0-9])${t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'i').test(jdLower);
      }
      return jdLower.includes(t);
    };
    const filtered = jdLower.length > 40
      ? rawStack.filter(techMatchesJd)
      : rawStack;
    const techLine = filtered.length
      ? `\n      <div class="job-tech">${escapeHtml(filtered.join(', '))}</div>`
      : '';
    return `
    <div class="job">
      <div class="job-header">
        <div><span class="job-company">${escapeHtml(job.company || '')}</span> - <span class="job-title">${escapeHtml(job.role || '')}</span></div>
        <div class="job-dates">${escapeHtml(formatPeriodDisplay(job.period || ''))}</div>
      </div>${techLine}
      <ul>${li}</ul>
    </div>`;
  }).join('\n');
}

function renderSkillsLines(profileSuperpowers, tailoredCompetencies, jdText = '') {
  return renderCategorizedSkills(profileSuperpowers, tailoredCompetencies, jdText);
}

const jdPath = arg('--jd');
const company = arg('--company', 'Company');
const role = arg('--role', '');
const outBase = arg('--out-basename', '');
const copyDownloads = process.argv.includes('--downloads');
const withCover = !process.argv.includes('--no-cover');

if (!jdPath || !fs.existsSync(jdPath)) {
  console.error('Usage: node scripts/run-plan-tailor.mjs --jd <path> --company <name> [--role <title>] [--out-basename X] [--downloads]');
  process.exit(1);
}

const jdText = fs.readFileSync(jdPath, 'utf8');
const hydrated = hydrateResumeProfile({});
const profile = hydrated.profile || hydrated;
if (!profile.experience?.length) {
  console.error('No experience loaded from profile.yml / cv.md');
  process.exit(1);
}

const plan = buildTailoringPlan(jdText, profile);
let executed = executeTailoringPlan(plan, profile, {
  jdText,
  companyName: company,
});

const gapSet = new Set(
  (plan.keywords?.gaps || []).map((g) => String(g).toLowerCase().trim())
);
const candidateKeywords = (plan.keywords?.honest?.length
  ? plan.keywords.honest
  : (plan.keywords?.weave || []));
const coverageKeywords = candidateKeywords.filter((kw) => {
  const lower = String(kw).toLowerCase().trim();
  return !gapSet.has(lower) && !gapSet.has('.' + lower) && !gapSet.has(lower.replace(/^\./, ''));
});
const activeCoverage = coverageKeywords.length
  ? coverageKeywords
  : (plan.keywords?.weave || []).filter((kw) => {
      const lower = String(kw).toLowerCase().trim();
      return !gapSet.has(lower);
    });

let mutable = measureMutableRoleCoverage(executed.resume, plan, activeCoverage);
const minRatio = plan.validation?.mutableCoverageMin ?? 0.35;
if (mutable.matchRatio < minRatio) {
  console.warn(`⚠ Mutable coverage ${mutable.score}% < ${Math.round(minRatio * 100)}% — repair pass`);
  const repairedResume = repairTailoredResume(executed.resume, plan, profile, jdText);
  executed = executeTailoringPlan(plan, profile, {
    jdText,
    companyName: company,
    llmSummary: repairedResume.summary,
    llmCoverLetter: executed.cover_letter,
  });
  // Keep the stronger of re-execute vs direct repair for mutable roles
  for (const idx of plan.tailorIndices) {
    const key = String(idx);
    const a = repairedResume.experience?.[key] || [];
    const b = executed.resume.experience?.[key] || [];
    const score = (bullets) => activeCoverage.filter((kw) =>
      bullets.join('\n').toLowerCase().includes(String(kw).toLowerCase())
    ).length;
    if (score(a) > score(b)) executed.resume.experience[key] = a;
  }
  executed.resume = restorePreservedEmployers(executed.resume, executed.preservedSnapshot);
  mutable = measureMutableRoleCoverage(executed.resume, plan, activeCoverage);
}

const alignment = validateResumeAlignment({
  jdText,
  profile,
  finalResume: executed.resume,
  llmDraft: executed.resume,
  meta: { company, role: role || plan.displayTitle },
  plan,
  preservedSnapshot: executed.preservedSnapshot,
});

const frozen = assertPreservedEquality(executed.resume, executed.preservedSnapshot);

console.log(`Plan family=${plan.family} tailor=[${plan.tailorIndices}] freeze=[${plan.preserveIndices}]`);
console.log(`Frozen equality: ${frozen.pass ? 'PASS' : 'FAIL'}`);
console.log(`Mutable coverage: ${mutable.score}% matched=${mutable.matched.slice(0, 8).join(', ')}`);
console.log(`Alignment: ${alignment.verdict}`);

if (!frozen.pass) {
  console.error('Generation blocked: frozen employers were modified — refusing output.');
  process.exit(1);
}
if (alignment.verdict !== 'PASS' || mutable.matchRatio < minRatio) {
  // Warn and continue — user directive: always produce the resume, flag quality issues.
  console.warn('⚠ Quality warnings (resume still generated):');
  if (alignment.verdict !== 'PASS') {
    for (const r of alignment.reasons || []) console.warn(`  - ${r}`);
  }
  if (mutable.matchRatio < minRatio) {
    console.warn(`  - mutable ${mutable.score}% < ${Math.round(minRatio * 100)}% missing=${mutable.missing.slice(0, 10).join(', ')}`);
  }
}

if (!fs.existsSync('output')) fs.mkdirSync('output');

const docs = buildApplicationDocumentPaths({
  candidateName: profile.candidate?.full_name || 'Candidate',
  company,
  roleTitle: role || plan.displayTitle || 'Role',
});
const resumeHtmlPath = outBase
  ? path.join('output', `${outBase}.html`)
  : docs.resumeHtml;
const resumePdfPath = outBase
  ? path.join('output', `${outBase}.pdf`)
  : docs.resumePdf;

const template = fs.readFileSync('templates/ats-template-professional.html', 'utf8');
const c = profile.candidate || {};
if (!String(c.email || '').trim()) {
  console.error('Resume export blocked: candidate email missing in profile.yml');
  process.exit(1);
}
const contactParts = [c.location, c.email, c.phone].map((x) => String(x || '').trim()).filter(Boolean);
const linkedinRaw = String(c.linkedin || '').trim().replace(/^https?:\/\//i, '');
const githubRaw = String(c.github || '').trim().replace(/^https?:\/\//i, '');
const linkParts = [];
if (linkedinRaw) linkParts.push(`<a href="https://${escapeHtml(linkedinRaw)}">${escapeHtml(linkedinRaw)}</a>`);
if (githubRaw) linkParts.push(`<a href="https://${escapeHtml(githubRaw)}">${escapeHtml(githubRaw.replace(/^github\.com\//i, ''))}</a>`);

const skillsLines = renderSkillsLines(
  profile.narrative?.superpowers || [],
  executed.resume.core_competencies || [],
  jdText,
);
const hasSkills = Boolean(skillsLines && skillsLines.trim().length > 0);

const hasExperience = Array.isArray(profile.experience) && profile.experience.length > 0;
const experienceHtml = hasExperience ? renderExperience(profile, executed.resume, jdText) : '';
const hasExpContent = Boolean(experienceHtml && experienceHtml.trim().length > 0);

const hasEducation = Array.isArray(profile.education) && profile.education.length > 0;
const educationHtml = hasEducation ? renderEducation(profile.education) : '';
const hasEduContent = Boolean(educationHtml && educationHtml.trim().length > 0);

const filteredProofPoints = filterProofPointsAlreadyInExperience(
  profile.narrative?.proof_points,
  profile.experience
);
const achievementsHtml = renderAchievements(filteredProofPoints);
const hasAchievements = Boolean(achievementsHtml && achievementsHtml.trim().length > 0);

const reps = {
  NAME: escapeHtml(c.full_name || ''),
  CONTACT_BAR: renderContactBarHtml(c),
  CONTACT_LINE: escapeHtml(contactParts.join(' · ')),
  LINKS_LINE: linkParts.join(' · '),
  SUMMARY_TEXT: formatResumeSummaryHtml(executed.resume.summary),
  SKILLS_LINES: skillsLines,
  SKILLS_DISPLAY: hasSkills ? 'block' : 'none',
  EXPERIENCE: experienceHtml,
  EXPERIENCE_DISPLAY: hasExpContent ? 'block' : 'none',
  ACHIEVEMENTS: achievementsHtml,
  ACHIEVEMENTS_DISPLAY: hasAchievements ? 'block' : 'none',
  EDUCATION: educationHtml,
  EDUCATION_DISPLAY: hasEduContent ? 'block' : 'none',
};

let html = template;
for (const [k, v] of Object.entries(reps)) {
  html = html.replace(new RegExp(`{{${k}}}`, 'g'), v ?? '');
}
// Any remaining {{PLACEHOLDER}} would render literally — fail loudly instead
const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
if (leftover) {
  console.warn(`⚠ Unreplaced template placeholders: ${[...new Set(leftover)].join(', ')}`);
  html = html.replace(/\{\{[A-Z_]+\}\}/g, '');
}
fs.writeFileSync(resumeHtmlPath, html);
execSync(`node generate-pdf.mjs "${resumeHtmlPath}" "${resumePdfPath}" --format=a4`, { stdio: 'inherit' });

const written = writeAlignmentReport(
  { ...alignment, plan: { ...alignment.plan, mutableCoverage: mutable, frozenCheck: frozen } },
  resumeHtmlPath,
);
console.log(`Resume PDF: ${resumePdfPath}`);
console.log(`Alignment: ${written.mdPath}`);

if (withCover) {
  const coverPdf = outBase
    ? path.join('output', `${outBase}_cover.pdf`)
    : docs.coverPdf;
  const payload = {
    candidate: {
      name: c.full_name,
      email: c.email,
      phone: c.phone,
      location: c.location,
      linkedin: c.linkedin,
      github: c.github,
    },
    letter: {
      role_title: role || plan.displayTitle,
      company,
      city: c.location || '',
      date: new Date().toISOString().slice(0, 10),
      opening: String(executed.cover_letter || '').split(/\n\n/)[0] || '',
      profile_intro: String(executed.cover_letter || '').split(/\n\n/)[1] || '',
      achievements: [],
      problems_section: '',
      closing: String(executed.cover_letter || '').split(/\n\n/)[2] || '',
    },
    output_path: coverPdf,
  };
  // Prefer body HTML via cover template if achievements empty
  const coverHtml = buildCoverHtml(payload);
  const coverHtmlPath = coverPdf.replace(/\.pdf$/i, '.html');
  fs.writeFileSync(coverHtmlPath, coverHtml);
  execSync(`node generate-pdf.mjs "${coverHtmlPath}" "${coverPdf}" --format=a4`, { stdio: 'inherit' });
  console.log(`Cover PDF: ${coverPdf}`);
  if (copyDownloads && process.env.HOME) {
    fs.copyFileSync(coverPdf, path.join(process.env.HOME, 'Downloads', path.basename(coverPdf).replace(/^AkashKaintura_/, 'Akashkaintura_')));
  }
}

if (copyDownloads && process.env.HOME) {
  const dest = path.join(
    process.env.HOME,
    'Downloads',
    path.basename(resumePdfPath).replace(/^AkashKaintura_/, 'Akashkaintura_'),
  );
  fs.copyFileSync(resumePdfPath, dest);
  console.log(`Copied: ${dest}`);
}

if (alignment.verdict !== 'PASS' && !process.argv.includes('--allow-fail')) {
  // Output already written — report the warnings without failing the run.
  console.warn(`⚠ Alignment verdict: ${alignment.verdict} (resume generated anyway)`);
}
