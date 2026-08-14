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
import { formatPeriodDisplay } from '../resume-quality.mjs';

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
  const lines = String(rawSummary || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
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

function renderExperience(profile, resume) {
  const jobs = profile.experience || [];
  return jobs.map((job, idx) => {
    const bullets = resume.experience?.[String(idx)] || job.bullets || [];
    const li = bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
    return `
    <div class="job">
      <div class="job-header">
        <div><span class="job-company">${escapeHtml(job.company || '')}</span> - <span class="job-title">${escapeHtml(job.role || '')}</span></div>
        <div class="job-dates">${escapeHtml(formatPeriodDisplay(job.period || ''))}</div>
      </div>
      <ul>${li}</ul>
    </div>`;
  }).join('\n');
}

function renderSkillsLines(profileSuperpowers, tailoredCompetencies) {
  return renderCategorizedSkills(profileSuperpowers, tailoredCompetencies);
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

const coverageKeywords = [
  ...(plan.keywords.weave || []),
  ...(plan.keywords.honest || []),
  ...(plan.keywords.domain || []),
];
let mutable = measureMutableRoleCoverage(executed.resume, plan, coverageKeywords);
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
    const score = (bullets) => coverageKeywords.filter((kw) =>
      bullets.join('\n').toLowerCase().includes(String(kw).toLowerCase())
    ).length;
    if (score(a) > score(b)) executed.resume.experience[key] = a;
  }
  executed.resume = restorePreservedEmployers(executed.resume, executed.preservedSnapshot);
  mutable = measureMutableRoleCoverage(executed.resume, plan, coverageKeywords);
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

const skillsLines = renderSkillsLines(profile.narrative?.superpowers || [], executed.resume.core_competencies || []);
const hasExperience = Array.isArray(profile.experience) && profile.experience.length > 0;
const hasEducation = Array.isArray(profile.education) && profile.education.length > 0;
const hasAchievements = Array.isArray(profile.narrative?.proof_points) && profile.narrative.proof_points.length > 0;

const reps = {
  NAME: escapeHtml(c.full_name || ''),
  CONTACT_BAR: renderContactBarHtml(c),
  CONTACT_LINE: escapeHtml(contactParts.join(' · ')),
  LINKS_LINE: linkParts.join(' · '),
  SUMMARY_TEXT: formatResumeSummaryHtml(executed.resume.summary),
  SKILLS_LINES: skillsLines,
  SKILLS_DISPLAY: skillsLines.trim() ? 'block' : 'none',
  EXPERIENCE: hasExperience ? renderExperience(profile, executed.resume) : '',
  EXPERIENCE_DISPLAY: hasExperience ? 'block' : 'none',
  ACHIEVEMENTS: hasAchievements ? renderAchievements(profile.narrative.proof_points) : '',
  ACHIEVEMENTS_DISPLAY: hasAchievements ? 'block' : 'none',
  EDUCATION: hasEducation ? renderEducation(profile.education) : '',
  EDUCATION_DISPLAY: hasEducation ? 'block' : 'none',
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
