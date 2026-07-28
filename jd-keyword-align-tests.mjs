#!/usr/bin/env node
/**
 * jd-keyword-align-tests.mjs — Interaslabs-style Indeed JD extraction regressions
 */

import {
  normalizeJdTechAliases,
  extractJdTechKeywords,
  extractJdKeywords,
  isJunkKeyword,
  isWeavableKeyword,
  alignResumeToJd,
  measureJdAlignment,
} from './jd-keyword-align.mjs';
import {
  analyzeJdProfileFit,
  buildJdMatchedCompetencies,
  buildHonestSummary,
} from './jd-profile-match.mjs';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const INTERASLABS_JD = `
Job Title: JavaScript Developer
Company: Interaslabs
Location: Hyderabad, Telangana

*Job Opening: JavaScript (Web scraping)*

6+ Years demonstrable Java script designing and development experience using NEST JS , ORM-object relational mapping, puppeteer.

Proven experience in JS scripting
DB knowledge is a must, preferably Postgres which includes writing queries , query optimization.
Hands-on experience in building REST APIs.
Agile Scrum experience required.
Azure Cloud experience preferred, but proven cloud experience required.
Hands-on experience in web sockets, microservices and message brokers.
`;

console.log('\nJD keyword align (Interaslabs Indeed)\n');

const normalized = normalizeJdTechAliases(INTERASLABS_JD);
assert(/\bNestJS\b/.test(normalized), 'aliases NEST JS → NestJS');
assert(/\bJavaScript\b/.test(normalized), 'aliases Java script → JavaScript');
assert(/\bWebSockets\b/.test(normalized), 'aliases web sockets → WebSockets');
assert(/\bORM\b/.test(normalized), 'aliases ORM-object relational mapping → ORM');
assert(/\bREST API\b/.test(normalized), 'aliases REST APIs → REST API');
assert(/\bMessage Brokers\b/.test(normalized), 'aliases message brokers');
assert(/\bWeb Scraping\b/.test(normalized), 'aliases Web scraping');

const tech = extractJdTechKeywords(INTERASLABS_JD, 22).map((t) => t.toLowerCase());
assert(tech.includes('nestjs'), 'extract NestJS from spaced NEST JS');
assert(tech.includes('puppeteer'), 'extract Puppeteer');
assert(tech.includes('websockets'), 'extract WebSockets');
assert(tech.includes('orm'), 'extract ORM');
assert(tech.includes('postgres') || tech.includes('postgresql'), 'extract Postgres');
assert(tech.includes('azure'), 'extract Azure');
assert(tech.includes('javascript'), 'extract JavaScript');
assert(tech.includes('microservices'), 'extract microservices');
assert(!tech.includes('java'), 'do not false-positive bare Java from Java script');

const allKw = extractJdKeywords(INTERASLABS_JD, 25).map((t) => t.toLowerCase());
assert(!allKw.includes('interaslabs'), 'company name not a keyword');
assert(!allKw.includes('telangana'), 'location not a keyword');
assert(!allKw.includes('demonstrable'), 'fluff adjective not a keyword');
assert(isJunkKeyword('demonstrable'), 'demonstrable is junk');
assert(isJunkKeyword('Interaslabs'), 'Interaslabs is junk');
assert(!isWeavableKeyword('Interaslabs'), 'Interaslabs not weavable');
assert(isWeavableKeyword('NestJS'), 'NestJS is weavable');
assert(isWeavableKeyword('Puppeteer'), 'Puppeteer is weavable');

const profile = {
  narrative: {
    headline: 'Senior Software Engineer',
    superpowers: ['Monolith-to-microservices transition', 'High-throughput RESTful API design'],
  },
  experience: [
    {
      company: 'Quest Global',
      role: 'Senior Software Engineer',
      bullets: [
        'Architected Node.js and Python microservices on AWS.',
        'Optimized PostgreSQL queries cutting CPU 30%.',
      ],
    },
    {
      company: 'KOCO',
      role: 'Full-Stack Developer',
      bullets: ['Developed multi-tenant Node.js services.'],
    },
  ],
};

const fit = analyzeJdProfileFit(INTERASLABS_JD, profile);
assert(fit.gaps.some((g) => /nestjs|puppeteer/i.test(g)), 'NestJS/Puppeteer listed as honest gaps');
assert(!fit.honest.some((h) => /puppeteer/i.test(h)), 'do not claim Puppeteer as proven without CV');
assert(!fit.honest.some((h) => /^orm$/i.test(h)), 'do not claim ORM via substring false-positive');

const comps = buildJdMatchedCompetencies([...fit.honest, ...fit.gaps], profile, INTERASLABS_JD, 16);
const compText = comps.join(' ').toLowerCase();
assert(/nestjs/.test(compText), 'competencies include NestJS for ATS');
assert(/puppeteer/.test(compText), 'competencies include Puppeteer for ATS');
assert(/azure/.test(compText), 'competencies include Azure');
assert(/websocket/.test(compText), 'competencies include WebSockets');
assert(!/interaslabs|telangana|demonstrable/.test(compText), 'competencies exclude junk');

const summary = buildHonestSummary('', 7, fit.honest, INTERASLABS_JD);
assert(/nestjs|javascript|puppeteer|postgres/i.test(summary), 'summary leads with JD stack');
assert(/scrap|automat|extract|javascript/i.test(summary), 'summary framing matches scraping JD');
assert(!summary.includes('—'), 'summary has no em-dash spam');

const atsKeywords = extractJdTechKeywords(INTERASLABS_JD, 18);
const base = {
  summary,
  core_competencies: comps,
  experience: {
    0: ['Architected Node.js microservices on AWS.', 'Optimized PostgreSQL queries.'],
    1: ['Developed multi-tenant Node.js services.'],
  },
};
const { resume: aligned } = alignResumeToJd(base, atsKeywords, profile.experience, {
  bulletKeywords: fit.honest,
});
const alignment = measureJdAlignment(aligned, atsKeywords);
assert(alignment.matchRatio >= 0.85, `aligned resume covers ≥85% JD tech (got ${Math.round(alignment.matchRatio * 100)}%)`);
assert(
  !/built nestjs|puppeteer at quest|scraping pipeline at/i.test(JSON.stringify(aligned.experience)),
  'experience does not invent NestJS/Puppeteer production claims'
);

console.log('\nJD chrome / Interra Ashby junk filter\n');
const INTERRA_JD = `
Software Developer @ Interra Health
What You'll Do:
Design cloud-native applications using .NET Framework and Azure services.
What You'll Bring:
Bachelor's degree in computer science or a technology-related field; or equivalent experience with at least 7-10 years of full stack experience in Microsoft .NET MVC C#, and Microsoft SQL Server, jQuery, and experience with RESTful APIs.
Hands-on experience with Microsoft Azure. Telerik/DevExpress. Unit testing. Agile/scrum.
`;
assert(isJunkKeyword('What You'), 'What You is junk');
assert(isJunkKeyword('computer science or a technology-related field'), 'degree phrase is junk');
assert(isJunkKeyword('full stack experience'), 'full stack experience prose is junk');
assert(isJunkKeyword("What You'll Bring"), 'What You\'ll Bring is junk');
const interraKw = extractJdKeywords(INTERRA_JD, 25).map((t) => t.toLowerCase());
assert(!interraKw.some((k) => /what you|computer science|related field|full stack experience/.test(k)), 'extract drops Interra chrome');
const interraComps = buildJdMatchedCompetencies(extractJdKeywords(INTERRA_JD, 25), profile, INTERRA_JD, 16);
const interraText = interraComps.join(' ').toLowerCase();
assert(/\.net|c#|azure|rest/i.test(interraText), 'Interra competencies keep real Microsoft stack');
assert(!/what you|computer science|related field|cursor|claude|gpt/i.test(interraText), 'Interra competencies exclude chrome and editor tools');
const interraSummary = buildHonestSummary('', 7, ['RESTful API', 'Unit testing'], INTERRA_JD);
assert(!/what you|computer science|full stack experience/i.test(interraSummary), 'Interra summary excludes chrome');
assert(!/\bcursor\b|\bclaude code\b|\bgpts?\b/i.test(interraSummary), 'Interra summary excludes editor tools');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
