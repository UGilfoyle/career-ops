#!/usr/bin/env node
import fs from 'fs';
import {
  analyzeJdProfileFit,
  reframeExperienceFromProfile,
  buildHonestCompetencies,
  buildHonestSummary,
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
console.log('\n=== GAPS (will NOT claim) ===');
console.log(fit.gaps.join(', ') || '(none)');
console.log('\n=== COMPETENCIES ===');
console.log(buildHonestCompetencies(fit.honest, profile, jd).join(' | '));
console.log('\n=== SUMMARY ===');
console.log(buildHonestSummary('', 7, fit.honest, jd));
console.log('\n=== ROLE 0 BULLETS ===');
const exp = reframeExperienceFromProfile(profile.experience, jd, fit.honest, 2);
for (const b of exp['0'] || []) console.log(' •', b);

// Assert no fabrication
const resumeText = [
  buildHonestSummary('', 7, fit.honest, jd),
  buildHonestCompetencies(fit.honest, profile, jd).join(' '),
  ...(exp['0'] || []),
].join(' ').toLowerCase();

const forbidden = ['.net', 'c#', 'redux'];
const leaked = forbidden.filter((t) => resumeText.includes(t));
if (leaked.length) {
  console.error('\nFAIL: fabricated terms on resume:', leaked.join(', '));
  process.exit(1);
}
if (!fit.gaps.some((g) => g.toLowerCase().includes('.net') || g.toLowerCase() === 'c#')) {
  console.warn('WARN: .NET/C# not listed in gaps — extraction may need tuning');
}
if (fit.honest.length < 2) {
  console.error('FAIL: too few honest keywords');
  process.exit(1);
}
console.log('\nOK: no .NET / C# / Redux fabrication');
