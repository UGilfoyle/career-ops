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
  cleanSkillToken,
} from './jd-keyword-align.mjs';
import {
  analyzeJdProfileFit,
  buildJdMatchedCompetencies,
  buildHonestSummary,
} from './jd-profile-match.mjs';
import { renderCategorizedSkills } from './resume-skills-html.mjs';

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
assert(cleanSkillToken('TypeScript)') === 'TypeScript', 'strips trailing paren');
assert(cleanSkillToken('IAM)') === 'IAM', 'strips trailing paren on IAM');
assert(cleanSkillToken('Go (Golang)') === 'Go (Golang)', 'keeps balanced Go (Golang)');

const rubyJd = `
Senior Backend Engineer
Requirements: Ruby, TypeScript), IAM), AWS Lambda, Aurora, GCP, LLM, Node.js, Redis, PostgreSQL
`;
const rubyComps = buildJdMatchedCompetencies(extractJdKeywords(rubyJd, 20), profile, rubyJd, 16);
const rubyText = rubyComps.join(' | ');
assert(!/ruby/i.test(rubyText), `do not list unproven Ruby (got ${rubyText})`);
assert(!/TypeScript\)/i.test(rubyText), 'no TypeScript) fragment');
assert(!/IAM\)/i.test(rubyText), 'no IAM) fragment');
assert(/node|typescript|postgres|redis|aws/i.test(rubyText), 'keeps proven backend stack');

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
// JD-first: gap stack may appear in experience weave for ATS
assert(
  /nestjs|puppeteer|javascript|node/i.test(JSON.stringify(aligned.experience) + aligned.summary + (aligned.core_competencies || []).join(' ')),
  'JD-first resume mirrors NestJS/Puppeteer/JS stack somewhere in output'
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
const interraFit = analyzeJdProfileFit(INTERRA_JD, profile);
assert(!interraFit.honest.some((h) => /devexpress|telerik/i.test(h)), 'DevExpress/Telerik not false-honest via Express');
const interraComps = buildJdMatchedCompetencies(extractJdKeywords(INTERRA_JD, 25), profile, INTERRA_JD, 16);
const interraText = interraComps.join(' ').toLowerCase();
assert(/\.net|c#|azure|rest/i.test(interraText), 'Interra competencies keep real Microsoft stack');
assert(!/what you|computer science|related field|cursor|claude|gpt/i.test(interraText), 'Interra competencies exclude chrome and editor tools');
const interraSummary = buildHonestSummary('', 7, interraFit.honest, INTERRA_JD);
assert(!/what you|computer science|full stack experience/i.test(interraSummary), 'Interra summary excludes chrome');
assert(/\.net|c#|azure|sql|jquery|rest/i.test(interraSummary), 'Interra summary mirrors JD Microsoft stack');
assert(!/\bcursor\b|\bclaude code\b|\bgpts?\b/i.test(interraSummary), 'Interra summary excludes editor tools');

console.log('\nAmerican Express brand must never become Express skill\n');
const AMEX_JD = `
Software Engineer I - Oracle Cloud HCM - CET Services @ American Express
As part of Team Amex, you'll help define the future of American Express.
Joining Amex Tech means shaping contribution with the Powerful Backing of American Express.
Prior experience of Oracle HCM Configuration. Agile methodology. BIP. Alert Composer.
`;
const amexTech = extractJdTechKeywords(AMEX_JD, 20).map((t) => t.toLowerCase());
const amexKw = extractJdKeywords(AMEX_JD, 25).map((t) => t.toLowerCase());
assert(!amexTech.includes('express'), 'Amex JD tech extractor does not emit Express');
assert(!amexKw.includes('express'), 'Amex JD keywords do not emit Express');
assert(!amexKw.includes('american express') && !amexKw.includes('amex') && !amexKw.includes('american'), 'Amex brand names are junk');
assert(isJunkKeyword('American Express'), 'American Express is junk');
assert(isJunkKeyword('Amex'), 'Amex is junk');
const nodeExpressJd = 'Backend Engineer. Strong Node.js and Express middleware experience. REST APIs.';
assert(
  extractJdTechKeywords(nodeExpressJd, 10).some((t) => /^express$/i.test(t)),
  'Real Node Express still extracts'
);
assert(
  !/express|american express|amex/i.test(
    renderCategorizedSkills(
      ['Monolith-to-microservices transition'],
      ['American Express', 'Express', 'Oracle'],
      AMEX_JD,
    ),
  ),
  'skills HTML never emits Amex Express brand'
);

console.log('\nLever WFH hardware boilerplate junk filter\n');
const SPREETAIL_HARDWARE = `
Software Engineer-III @ Spreetail
This is a remote position and requires candidates to have an available work-from-home setup.
Desktop/Laptop system requirements:
- 4th generation or higher, at least Intel i3 or equivalent processor;
- at least 4GB RAM;
- Windows 10 and above or MAC OSX operating system
- You are required to provide your own dual monitors
A strong and stable internet connection (DSL, cable or fiber wired internet service)
PC Headset
A high-definition (HD) external or integrated webcam with at least 720p resolution.
`;
assert(isJunkKeyword('provide your own dual'), 'provide your own dual is junk');
assert(isJunkKeyword('dual monitors'), 'dual monitors is junk');
assert(isJunkKeyword('operating system'), 'operating system is junk');
assert(isJunkKeyword('internet connection'), 'internet connection is junk');
assert(isJunkKeyword('webcam'), 'webcam is junk');
const leverKw = extractJdKeywords(SPREETAIL_HARDWARE, 25).map((t) => t.toLowerCase());
assert(
  !leverKw.some((k) => /provide your own dual|dual monitors|webcam|internet connection|operating system/.test(k)),
  `extract drops WFH hardware chrome (got ${leverKw.filter((k) => /provide your own dual|dual monitors|webcam|internet connection|operating system/.test(k)).join(',')})`
);

console.log('\nSentence-fragment / prose keyword filter\n');
const SPREETAIL_PROSE = `
Software Engineer-III @ Spreetail
Success in this role looks like:
* Engineers on your workstream shipping confidently because designs and technical direction are clear
* Reduced manual intervention in exception handling within your area through automation and AI-assisted detection
* Design docs and technical decisions that Staff engineers can review quickly and trust
* Faster onboarding of new 3PL clients through well-built, reusable components
Requirements:
* Experience with event-driven architecture and distributed systems
* AWS and observability
`;
assert(isJunkKeyword('area through automation and'), 'mid-sentence fragment is junk');
assert(isJunkKeyword('because designs and technical'), 'leading-conjunction prose is junk');
assert(isJunkKeyword('engineers can review quickly'), 'verb clause is junk');
assert(isJunkKeyword('direction are clear'), 'are-clause is junk');
assert(isJunkKeyword('your workstream shipping confidently'), 'leading-pronoun prose is junk');
assert(isJunkKeyword('docs and technical decisions'), 'docs and ... fragment is junk');
assert(!isJunkKeyword('event-driven architecture'), 'event-driven architecture is NOT junk');
assert(!isJunkKeyword('distributed systems'), 'distributed systems is NOT junk');
assert(!isJunkKeyword('reusable components'), 'reusable components is NOT junk');
assert(!isJunkKeyword('AWS'), 'AWS is NOT junk');
const spreetailKw = extractJdKeywords(SPREETAIL_PROSE, 25).map((t) => t.toLowerCase());
assert(
  !spreetailKw.some((k) => /through automation and|review quickly|designs and technical|are clear|workstream shipping/.test(k)),
  `extract drops Spreetail sentence fragments (got ${spreetailKw.filter((k) => /through automation and|review quickly|designs and technical|are clear|workstream shipping/.test(k)).join(',')})`
);
assert(
  spreetailKw.some((k) => /event-driven|distributed systems|aws|observability/.test(k)),
  'extract keeps real skills'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
