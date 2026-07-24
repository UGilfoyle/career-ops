#!/usr/bin/env node
import {
  analyzeJdProfileFit,
  reframeExperienceFromProfile,
  buildJdMatchedCompetencies,
  buildHonestSummary,
  inferRoleTitleFromJd,
} from './jd-profile-match.mjs';
import { hydrateResumeProfile } from './profile-hydrate.mjs';

const jd = `Design, implement, and scale backend services in .NET Core and front-end applications with React, Redux, TypeScript, and modern JavaScript.
Working with Cursor and Github Copilot and creating AI agents that use latest LLM Models.
Advance CI/CD pipelines. Build unit, integration, and end-to-end tests.
6+ years full-stack (React, Redux, TypeScript, JavaScript. C#, .NET Core, RESTful APIs, event-driven architectures).`;

const profile = hydrateResumeProfile({}).profile;
const fit = analyzeJdProfileFit(jd, profile);

console.log('=== HONEST KEYWORDS ===');
console.log(fit.honest.join(', ') || '(none)');
console.log('\n=== GAPS (skills OK for ATS; not invented in experience) ===');
console.log(fit.gaps.join(', ') || '(none)');
console.log('\n=== COMPETENCIES (JD ATS match) ===');
const comps = buildJdMatchedCompetencies(fit.honest, profile, jd);
console.log(comps.join(' | '));
console.log('\n=== SUMMARY ===');
const summary = buildHonestSummary('', 7, fit.honest, jd);
console.log(summary);
console.log('\n=== ROLE 0 BULLETS ===');
const exp = reframeExperienceFromProfile(profile.experience, jd, fit.honest, 2);
for (const b of exp['0'] || []) console.log(' •', b);

// Experience bullets must stay factual — no invented gap-stack project claims
const experienceText = (exp['0'] || []).join(' ').toLowerCase();
const forbiddenInExperience = ['.net', 'c#', 'redux'];
const leakedExp = forbiddenInExperience.filter((t) => experienceText.includes(t));
if (leakedExp.length) {
  console.error('\nFAIL: fabricated gap terms in experience bullets:', leakedExp.join(', '));
  process.exit(1);
}

// Competencies must be JD-rich (ATS), not sparse
if (comps.length < 8) {
  console.error('\nFAIL: competencies too sparse for ATS:', comps.length);
  process.exit(1);
}
const compText = comps.join(' ').toLowerCase();
if (!compText.includes('react') || !compText.includes('typescript')) {
  console.error('\nFAIL: competencies missing core JD frontend terms');
  process.exit(1);
}
if (/\b(software|applications)\b/i.test(comps.join('|'))) {
  console.error('\nFAIL: junk competency tokens present');
  process.exit(1);
}

// Summary Zety bar
const summaryLines = summary.split('\n').filter(Boolean);
if (summaryLines.length < 3 || summaryLines.length > 4) {
  console.error('\nFAIL: summary must be 3–4 lines, got', summaryLines.length);
  process.exit(1);
}
if (!/react|typescript|javascript|node/i.test(summary)) {
  console.error('\nFAIL: summary missing named JD tech');
  process.exit(1);
}
if (/passionate about|results-oriented|proven track record|leveraged|spearheaded/i.test(summary)) {
  console.error('\nFAIL: summary contains banned clichés');
  process.exit(1);
}
const title = inferRoleTitleFromJd(jd, 7);
if (!/full-stack|software engineer/i.test(title)) {
  console.error('\nFAIL: unexpected role title', title);
  process.exit(1);
}
if (!summary.startsWith(title)) {
  console.error('\nFAIL: summary should open with role title:', title);
  process.exit(1);
}

// Bullets: capitalized complete sentences; no corporate-speak verbs
for (const b of exp['0'] || []) {
  if (!/^[A-Z]/.test(b) || !/[.!?]$/.test(b)) {
    console.error('\nFAIL: bullet not a complete capitalized sentence:', b);
    process.exit(1);
  }
  if (/\b(spearhead|leveraged?|utiliz(?:ed|ing))\b/i.test(b)) {
    console.error('\nFAIL: bullet contains banned corporate verb:', b);
    process.exit(1);
  }
}

if (!fit.gaps.some((g) => g.toLowerCase().includes('.net') || g.toLowerCase() === 'c#')) {
  console.warn('WARN: .NET/C# not listed in gaps — extraction may need tuning');
}
if (fit.honest.length < 2) {
  console.error('FAIL: too few honest keywords');
  process.exit(1);
}
console.log('\nOK: ATS competencies are JD-rich; experience bullets stay factual; summary hits Zety bar');
