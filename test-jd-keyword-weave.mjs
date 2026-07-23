#!/usr/bin/env node
/**
 * Regression: JD keyword weave must not dump junk skills or "applying X in production".
 */
import assert from 'assert';
import {
  extractJdKeywords,
  alignResumeToJd,
  isWeaveableKeyword,
  filterWeaveableKeywords,
} from './jd-keyword-align.mjs';
import {
  analyzeJdProfileFit,
  buildHonestCompetencies,
  buildHonestSummary,
} from './jd-profile-match.mjs';
import { hydrateResumeProfile } from './profile-hydrate.mjs';

const hersheyJd = `
Job Title: Senior Software Development Engineer
Company: The Hershey Company
Location: Pune

Requirements:
- Strong experience with React and TypeScript
- Backend services with NestJS and Node.js
- Cloud experience with Azure
- Docker containers and GitLab CI pipelines
- RESTful API design and microservices
- Unit testing and high-traffic web applications

Responsibilities:
- Build scalable software applications and platforms
- Design RESTful APIs for enterprise systems
- Partner with frontend teams on React applications
`;

const junk = extractJdKeywords(hersheyJd, 25);
assert.ok(!junk.some((k) => /^(software|applications?|development)$/i.test(k)), `junk leaked: ${junk.join(', ')}`);
assert.ok(junk.some((k) => /react/i.test(k)), 'expected React');
assert.ok(junk.some((k) => /node/i.test(k)), 'expected Node');
assert.ok(junk.some((k) => /nestjs|nest\.?js/i.test(k)), 'expected NestJS');
assert.ok(isWeaveableKeyword('NestJS'));
assert.ok(!isWeaveableKeyword('Software'));
assert.ok(!isWeaveableKeyword('applications'));

const profile = hydrateResumeProfile({}).profile;
const fit = analyzeJdProfileFit(hersheyJd, profile);
assert.ok(fit.honest.length >= 4, `expected transferable honest terms, got: ${fit.honest.join(', ')}`);
assert.ok(
  fit.honest.some((k) => /nestjs|azure|docker|react|typescript|node/i.test(k)),
  `expected JD stack via transfer synonyms, got: ${fit.honest.join(', ')}`
);

const comps = buildHonestCompetencies(fit.honest, profile, hersheyJd);
assert.ok(comps.length >= 6, `competencies too thin: ${comps.join(' | ')}`);
assert.ok(!comps.some((c) => /^(software|applications)$/i.test(c)), `junk competency: ${comps.join(' | ')}`);
assert.ok(
  comps.some((c) => /restful api design|microservices|ci\/cd|full-stack/i.test(c)),
  `expected capability phrases, got: ${comps.join(' | ')}`
);

const summary = buildHonestSummary('', 7, fit.honest, hersheyJd);
assert.ok(!/Core stacks:\s*Software/i.test(summary), summary);
assert.ok(/React|TypeScript|Node|Nest|Docker|Azure/i.test(summary), summary);

const draft = {
  summary: 'Senior engineer building backends.',
  core_competencies: ['RESTful API Design'],
  experience: {
    0: ['Architected mission-critical enterprise features utilizing Python and Node.js.'],
  },
};
const { resume, stats } = alignResumeToJd(draft, [...junk, 'Software', 'applications'], []);
const corpus = JSON.stringify(resume);
assert.ok(!/, applying .+ in production/i.test(corpus), corpus);
assert.ok(!/Core stacks:\s*Software/i.test(corpus), corpus);
assert.ok(!resume.core_competencies.some((c) => /^(software|applications)$/i.test(c)), resume.core_competencies);
assert.ok(filterWeaveableKeywords(['Software', 'React', 'applications']).join(',') === 'React');

console.log('✓ weave/competency regression passed');
console.log(`  keywords: ${junk.slice(0, 10).join(', ')}`);
console.log(`  honest:   ${fit.honest.slice(0, 10).join(', ')}`);
console.log(`  comps:    ${comps.slice(0, 10).join(' | ')}`);
console.log(`  aligned:  competencies+${stats.competenciesAdded}, bullets+${stats.bulletsAligned}`);
