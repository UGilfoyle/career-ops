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

function formatResumeSummaryHtml(rawSummary) {
  const lines = String(rawSummary || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

function renderEducation(edu) {
  if (!Array.isArray(edu) || !edu.length) return '';
  return edu.map((e) => {
    const line = formatEducationLine(e) || `${e.degree || ''} | ${e.school || ''} | ${e.period || ''}`;
    return `<div class="education-item">${escapeHtml(line)}</div>`;
  }).join('');
}

function renderExperience(profile, resume) {
  const jobs = profile.experience || [];
  return jobs.map((job, idx) => {
    const bullets = resume.experience?.[String(idx)] || job.bullets || [];
    const li = bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
    return `
    <div class="job">
      <div class="job-header">
        <div class="job-title-company">
          <span class="job-title">${escapeHtml(job.role || '')}</span>
          <span class="company-name">${escapeHtml(job.company || '')}</span>
        </div>
        <div class="job-date">${escapeHtml(job.period || '')}</div>
      </div>
      <ul class="job-bullets">${li}</ul>
    </div>`;
  }).join('\n');
}

function renderCompetencies(comps) {
  return (comps || []).map((c) => `<span class="competency-tag">${escapeHtml(c)}</span>`).join('');
}

function renderSkills(comps) {
  const tech = (comps || []).slice(0, 14).join(', ');
  return `<p><strong>Technical Skills:</strong> ${escapeHtml(tech)}</p>`;
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
const reps = {
  NAME: escapeHtml(c.full_name || ''),
  EMAIL: escapeHtml(c.email || ''),
  PHONE: escapeHtml(c.phone || ''),
  LOCATION: escapeHtml(c.location || ''),
  LINKEDIN_URL: escapeHtml(c.linkedin ? `https://${String(c.linkedin).replace(/^https?:\/\//, '')}` : ''),
  LINKEDIN_DISPLAY: escapeHtml(c.linkedin || ''),
  GITHUB_URL: escapeHtml(c.github ? `https://${String(c.github).replace(/^https?:\/\//, '')}` : ''),
  GITHUB_DISPLAY: escapeHtml(c.github || ''),
  SUMMARY_TEXT: formatResumeSummaryHtml(executed.resume.summary),
  COMPETENCIES: renderCompetencies(executed.resume.core_competencies),
  EXPERIENCE: renderExperience(profile, executed.resume),
  EDUCATION: renderEducation(profile.education),
  SKILLS: renderSkills(executed.resume.core_competencies),
  SECTION_SUMMARY: 'Professional Summary',
  SECTION_COMPETENCIES: 'Core Competencies',
  SECTION_EXPERIENCE: 'Professional Experience',
  SECTION_EDUCATION: 'Education',
  SECTION_SKILLS: 'Technical Skills',
  SECTION_PROJECTS: '',
  PROJECTS: '',
  SECTION_CERTIFICATIONS: '',
  CERTIFICATIONS: '',
  LANG: 'en',
  PAGE_WIDTH: '210mm',
};

let html = template;
for (const [k, v] of Object.entries(reps)) {
  html = html.replace(new RegExp(`{{${k}}}`, 'g'), v ?? '');
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
