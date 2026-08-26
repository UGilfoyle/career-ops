#!/usr/bin/env node
/**
 * resume-tailoring-plan-tests.mjs — Robust JD tailoring engine regressions
 */
import fs from 'fs';
import {
  extractJdDomainPhrases,
  extractMustHavePreferred,
  extractJdTechKeywords,
  measureJdAlignment,
} from './jd-keyword-align.mjs';
import {
  buildTailoringPlan,
  executeTailoringPlan,
  assertPreservedEquality,
  measureMutableRoleCoverage,
  selectWeaveKeywords,
  scrubGapToolsFromMutableRoles,
  stripCoverLetterDates,
  finalizeCoverLetter,
  DEFAULT_FULL_TAILOR,
  DEFAULT_PRESERVE_VERBATIM,
} from './resume-tailoring-plan.mjs';
import { stripNaukriChrome } from './naukri-job.mjs';
import { validateResumeAlignment } from './resume-alignment-validator.mjs';
import { hydrateResumeProfile } from './profile-hydrate.mjs';

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

process.env.CAREER_OPS_USE_CI_FIXTURE = process.env.CAREER_OPS_USE_CI_FIXTURE || '1';

const hydrated = hydrateResumeProfile({});
const profile = hydrated.profile || hydrated;
// Prefer real profile when present; otherwise CI fixture
if (!profile.experience?.length) {
  console.error('No profile experience available (set config/profile.yml or CI fixture)');
  process.exit(1);
}

const INTERASLABS_JD = fs.existsSync('jds/interaslabs-js-web-scraping.txt')
  ? fs.readFileSync('jds/interaslabs-js-web-scraping.txt', 'utf8')
  : `
Job Title: JavaScript Developer
*Job Opening: JavaScript (Web scraping)*
6+ Years demonstrable Java script designing and development experience using NEST JS , ORM, puppeteer.
Hands-on experience in web sockets, microservices and message brokers.
Azure Cloud experience preferred. Postgres. REST APIs.
`;

const DELOITTE_JD = fs.existsSync('jds/deloitte-etl-testing-senior-consultant.txt')
  ? fs.readFileSync('jds/deloitte-etl-testing-senior-consultant.txt', 'utf8')
  : `
Must Have:
Strong proficiency in Python (pandas, pyodbc).
Expertise in SQL — window functions.
Oracle databases/datawarehouse.
Unix/Linux shell scripting.
Data Warehousing staging fact dimension SCD.
Jenkins, GitHub Actions, JIRA.
ETL testing source-to-target validation data reconciliation.
Good to Have: Banking.
`;

console.log('\n1. Domain / must-have extraction\n');
const domain = extractJdDomainPhrases(DELOITTE_JD, 16);
assert(domain.some((d) => /source-to-target|reconcil|etl testing|scd/i.test(d)), 'Deloitte domain phrases extracted');
const tiers = extractMustHavePreferred(DELOITTE_JD);
assert(tiers.mustHave.some((k) => /python|pandas|oracle|jenkins/i.test(k)), 'must-have bucket has stack terms');
const tech = extractJdTechKeywords(INTERASLABS_JD, 20).map((t) => t.toLowerCase());
assert(tech.includes('nestjs') || tech.includes('puppeteer') || tech.includes('javascript'), 'Interaslabs tech extracted');

console.log('\n2. Employer policy (top-4 tailor, older freeze)\n');
const planD = buildTailoringPlan(DELOITTE_JD, profile);
assert(planD.family === 'data_etl', `family data_etl (got ${planD.family})`);
assert(planD.tailorIndices.length >= 3, `tailor indices present (${planD.tailorIndices})`);
assert(planD.preserveIndices.length >= 2, `preserve indices present (${planD.preserveIndices})`);
for (const i of planD.tailorIndices) {
  const company = profile.experience[i]?.company || '';
  assert(
    DEFAULT_FULL_TAILOR.some((p) => company.toLowerCase().includes(p.toLowerCase().split(/\s+/)[0])),
    `tailor role ${i} is recent employer (${company})`,
  );
}
for (const i of planD.preserveIndices) {
  const company = profile.experience[i]?.company || '';
  assert(
    DEFAULT_PRESERVE_VERBATIM.some((p) => company.toLowerCase().includes(p.toLowerCase().split(/\s+/)[0])),
    `preserve role ${i} is older employer (${company})`,
  );
}

console.log('\n3. Execute plan — frozen equality + skills ATS\n');
const pkgD = executeTailoringPlan(planD, profile, { jdText: DELOITTE_JD, companyName: 'Deloitte' });
const frozen = assertPreservedEquality(pkgD.resume, pkgD.preservedSnapshot);
assert(frozen.pass, 'KOCO/Rubico/Artisanssoft unchanged after execute');
const comps = (pkgD.resume.core_competencies || []).join(' ').toLowerCase();
assert(/etl|python|oracle|jenkins|pandas|sql|jira/i.test(comps), 'Deloitte competencies carry JD stack');
assert(/etl|python|oracle|reconcil|warehouse|sql/i.test(pkgD.resume.summary), 'Deloitte summary carries JD framing');

const pkgI = executeTailoringPlan(buildTailoringPlan(INTERASLABS_JD, profile), profile, {
  jdText: INTERASLABS_JD,
  companyName: 'Interaslabs',
});
const compsI = (pkgI.resume.core_competencies || []).join(' ').toLowerCase();
assert(/nestjs|puppeteer|javascript|websocket|azure|postgres/i.test(compsI), 'Interaslabs competencies carry JD stack');

console.log('\n4. Keyword sprinkle trap\n');
const sprinkleResume = {
  summary: 'Generic engineer.',
  core_competencies: planD.keywords.atsMirror.slice(0, 12),
  experience: Object.fromEntries(
    (profile.experience || []).map((_, i) => [String(i), ['Built generic services for clients.']]),
  ),
};
const sprinkle = validateResumeAlignment({
  jdText: DELOITTE_JD,
  profile,
  finalResume: sprinkleResume,
  llmDraft: sprinkleResume,
  plan: planD,
  preservedSnapshot: pkgD.preservedSnapshot,
  atsMin: 50,
});
assert(sprinkle.verdict === 'FAIL', 'sprinkle trap fails when mutable roles lack JD terms');

console.log('\n5. Mutable coverage + dashboard wrapper parity stub\n');
const mut = measureMutableRoleCoverage(pkgD.resume, planD, [
  ...(planD.keywords.weave || []),
  ...(planD.keywords.honest || []),
  ...(planD.keywords.domain || []),
]);
assert(mut.rolesWithHit >= 3, `at least 3 mutable roles hit JD weave terms (got ${mut.rolesWithHit})`);
// Ratio depends on weave-list size vs profile; require meaningful hits + floor.
assert(mut.matched.length >= 4, `at least 4 weave/domain hits (got ${mut.matched.length})`);
assert(mut.matchRatio >= 0.20, `mutable coverage ≥20% (got ${mut.score}%)`);
assert(
  mut.matched.some((m) => /etl|reconcil|source-to-target|validat|python|oracle/i.test(m)),
  `mutable matched includes ETL/domain terms (${mut.matched.slice(0, 6).join(', ')})`,
);
const mutableCorpus = planD.tailorIndices
  .map((i) => (pkgD.resume.experience?.[String(i)] || []).join('\n'))
  .join('\n')
  .toLowerCase();
assert(
  /etl|reconcil|source-to-target|data completeness|warehouse/i.test(mutableCorpus),
  'mutable role bullets carry ETL domain language',
);
assert(fs.existsSync('dashboard-v2/scripts/agentic-tailor.mjs'), 'dashboard wrapper exists');
const wrapper = fs.readFileSync('dashboard-v2/scripts/agentic-tailor.mjs', 'utf8');
assert(/agentic-tailor\.mjs/.test(wrapper) && /spawn/.test(wrapper), 'dashboard wrapper spawns root engine');
assert(!/async function tailorPackage/.test(wrapper), 'dashboard wrapper is not a full fork');

console.log('\n6. Alignment of executed package\n');
const align = measureJdAlignment(pkgD.resume, planD.keywords.atsMirror.slice(0, 12));
assert(align.matchRatio >= 0.5, `executed package covers ≥50% ATS mirror (got ${Math.round(align.matchRatio * 100)}%)`);

console.log('\n7. Generic future JD (backend) — not Deloitte/Interaslabs\n');
const GENERIC_BACKEND_JD = `
Job Title: Senior Backend Engineer
Requirements:
- Design and develop event-driven microservices with Kafka and Redis
- Build high-throughput RESTful APIs using Node.js and TypeScript
- Own observability (Grafana, Prometheus) and incident response
- Experience with AWS, Docker, CI/CD, and auto-scaling
- Strong PostgreSQL and system design skills
Nice to have:
- GraphQL, gRPC
`;
const planB = buildTailoringPlan(GENERIC_BACKEND_JD, profile);
assert(planB.family === 'backend_platform' || planB.family === 'unknown' || planB.family === 'fullstack',
  `generic backend family detected (got ${planB.family})`);
assert(
  (planB.keywords.domain || []).some((d) => /event-driven|observability|auto-scaling|message|high-throughput|restful/i.test(d))
  || (planB.keywords.atsMirror || []).some((d) => /kafka|redis|node|observability|event/i.test(d)),
  'generic JD extracts domain/stack terms dynamically',
);
const pkgB = executeTailoringPlan(planB, profile, { jdText: GENERIC_BACKEND_JD, companyName: 'Acme' });
const frozenB = assertPreservedEquality(pkgB.resume, pkgB.preservedSnapshot);
assert(frozenB.pass, 'frozen employers unchanged on generic backend JD');
const mutB = measureMutableRoleCoverage(pkgB.resume, planB, [
  ...(planB.keywords.weave || []),
  ...(planB.keywords.honest || []),
  ...(planB.keywords.domain || []),
]);
assert(mutB.rolesWithHit >= 2, `generic JD hits ≥2 mutable roles (got ${mutB.rolesWithHit})`);
assert(mutB.matchRatio >= 0.25, `generic JD mutable coverage ≥25% (got ${mutB.score}%)`);
const compsB = (pkgB.resume.core_competencies || []).join(' ').toLowerCase();
assert(/node|kafka|redis|postgres|aws|typescript|observ/i.test(compsB), 'generic JD competencies carry stack');
assert(/kafka|event|api|observ|node|aws|postgres/i.test(pkgB.resume.summary), 'generic JD summary carries framing');

console.log('\n8. Engine is company-agnostic (no Deloitte hardcode path)\n');
const planSrc = fs.readFileSync('resume-tailoring-plan.mjs', 'utf8');
assert(!/deloitte/i.test(planSrc), 'resume-tailoring-plan.mjs has no Deloitte hardcode');
assert(!/if \(plan\?\.family === 'data_etl'/.test(planSrc), 'no data_etl-only weave hardcode');

console.log('\n9. Frozen-restore evaluation — LLM draft missing frozen roles\n');
// Repro of the Spreetail/Lever CI failure: fallback LLM returned only the 4
// tailor roles; preserved employers (4,5,6) were absent from the raw draft.
// The frozen check + mutable coverage must be judged against the resume as it
// would be saved (frozen roles restored), not the raw LLM output.
const llmDroppedFrozen = JSON.parse(JSON.stringify(pkgD.resume));
for (const i of planD.preserveIndices) {
  delete llmDroppedFrozen.experience[String(i)];
}
const restoredEval = validateResumeAlignment({
  jdText: DELOITTE_JD,
  profile,
  finalResume: pkgD.resume,
  llmDraft: llmDroppedFrozen,
  plan: planD,
  preservedSnapshot: pkgD.preservedSnapshot,
  atsMin: 50,
});
assert(
  !(restoredEval.reasons || []).some((r) => /Frozen employers changed/.test(r)),
  `no false frozen-employer FAIL when LLM draft drops frozen roles (got ${(restoredEval.reasons || []).join('; ')})`,
);

console.log('\n10. BMW-style fullstack JD — Angular is a gap, not a Quest bullet\n');
const BMW_JD = `
Job Title: Fullstack Software Developer
BMW Techworks India — Pune — 7 to 10 years
Roles and Responsibilities:
Design and develop Angular and Node.js applications with high availability, performance, security, and scalability.
Job Requirements:
JavaScript, TypeScript, Angular, Node.js, PostgreSQL, Docker, Kubernetes, AWS EC2, AWS S3.
`;
const planBmw = buildTailoringPlan(BMW_JD, profile);
const weaveBmw = selectWeaveKeywords(planBmw, profile).join(' ').toLowerCase();
assert(!/\bangular\b/.test(weaveBmw), `Angular stays out of bullet weave (got ${weaveBmw})`);
assert(
  (planBmw.keywords.gaps || []).some((k) => /angular/i.test(k))
    || !(profileCorpusTextSafe(profile).includes('angular')),
  'Angular is treated as a gap unless already in the profile',
);
const pkgBmw = executeTailoringPlan(planBmw, profile, {
  jdText: BMW_JD,
  companyName: 'BMW Techworks India',
});
const mutableBmw = planBmw.tailorIndices
  .map((i) => (pkgBmw.resume.experience?.[String(i)] || []).join('\n'))
  .join('\n');
assert(!/\bAngular\b/i.test(mutableBmw), 'mutable bullets do not invent Angular');
assert(!/\bNestJS\b/i.test(mutableBmw), 'mutable bullets do not invent NestJS from similar-jobs chrome');
const compsBmw = (pkgBmw.resume.core_competencies || []).join(' ');
assert(/\bNode\.?js\b/i.test(compsBmw) || /\bTypeScript\b/i.test(compsBmw), 'BMW competencies keep honest stack');
assert(
  /\bAngular\b/i.test(compsBmw) || (planBmw.keywords.gaps || []).some((k) => /angular/i.test(k)),
  'Angular is ATS-listed in competencies or recorded as a gap',
);

const pollutedBmw = `${BMW_JD}

## Similar jobs
### Senior Software Engineer: Python Full-stack
### Full Stack Next.Js & Nest JS Professional
`;
const cleanBmwJd = stripNaukriChrome(pollutedBmw);
assert(!/Python Full-stack|Nest JS|Next\.Js/i.test(cleanBmwJd), 'Naukri similar-jobs chrome stripped before tailor');
const planClean = buildTailoringPlan(cleanBmwJd, profile);
const pkgClean = executeTailoringPlan(planClean, profile, {
  jdText: cleanBmwJd,
  companyName: 'BMW Techworks India',
});
const mutableClean = planClean.tailorIndices
  .map((i) => (pkgClean.resume.experience?.[String(i)] || []).join('\n'))
  .join('\n');
assert(!/\bNestJS\b/i.test(mutableClean), 'stripped Naukri JD does not NestJS-stuff Quest');
assert(!/\bNext\.js\b/i.test(mutableClean), 'stripped Naukri JD does not Next.js-stuff Quest');
assert(!/\bAngular\b/i.test(mutableClean), 'stripped Naukri JD still does not invent Angular in bullets');

const lied = JSON.parse(JSON.stringify(pkgBmw.resume));
const qKey = String(planBmw.tailorIndices[0] || 0);
lied.experience[qKey] = [
  'Architected Angular dashboards for the BMW stack.',
  ...(lied.experience[qKey] || []),
];
const scrubbedLie = scrubGapToolsFromMutableRoles(lied, planBmw, profile);
const scrubbedQuest = (scrubbedLie.experience[qKey] || []).join('\n');
assert(!/\bAngular\b/i.test(scrubbedQuest), 'scrub strips invented Angular from Quest');

function profileCorpusTextSafe(p) {
  const parts = [];
  for (const role of p?.experience || []) {
    for (const b of role?.bullets || []) parts.push(String(b));
  }
  parts.push(...(p?.narrative?.superpowers || []).map(String));
  return parts.join('\n').toLowerCase();
}

console.log('\n12. Cummins AWS platform — no fake stack / no parenthetical dumps\n');
const CUMMINS_JD = fs.existsSync('jds/cummins-aws-platform-engineer-principal.txt')
  ? fs.readFileSync('jds/cummins-aws-platform-engineer-principal.txt', 'utf8')
  : 'AWS Platform Engineer Principal. Terraform, CloudFormation, IAM, VPC, CloudWatch, Jenkins.';
const planC = buildTailoringPlan(CUMMINS_JD, profile);
assert(planC.family === 'devops_sre', `Cummins family is devops_sre (got ${planC.family})`);
assert(/aws platform engineer/i.test(planC.displayTitle), `Cummins title is AWS platform (got ${planC.displayTitle})`);
const pkgC = executeTailoringPlan(planC, profile, { jdText: CUMMINS_JD, companyName: 'Cummins' });
const summaryC = String(pkgC.resume.summary || '');
const expC = Object.values(pkgC.resume.experience || {}).flat().join('\n');
assert(!/\(\s*WebSockets|\(\s*\.NET|\(\s*DynamoDB|\(\s*GCP\s*\)/i.test(summaryC), 'summary has no parenthetical keyword dump');
assert(!/\b\.NET\b/i.test(summaryC + expC) || /dotnet|\.net/.test(profileCorpusTextSafe(profile)), 'does not invent .NET');
assert(!/\bDynamoDB\b/i.test(expC), 'does not invent DynamoDB into experience');
assert(!/\bFastAPI\b/i.test(expC), 'does not invent FastAPI into experience');
assert(!/\bOracle\b/i.test(expC) || /\boracle\b/i.test(profileCorpusTextSafe(profile)), 'does not invent Oracle into experience');
assert(!/\bspearhead/i.test(summaryC + expC), 'no spearhead cliché');
assert(/terraform|cloudformation|cloudwatch|iam|vpc|jenkins/i.test(summaryC + expC), 'Cummins resume surfaces proven AWS platform tools');
const compsC = (pkgC.resume.core_competencies || []).join(' ');
assert(/Terraform|CloudWatch|CloudFormation|AWS/i.test(compsC), 'Cummins competencies keep proven AWS stack ahead of JD-gap crumbs');

console.log('\n13. Cover letter finalize — JD-aligned, no date, no paren spam\n');
const letterC = String(pkgC.cover_letter || '');
assert(letterC.length > 120, 'cover letter has substance');
assert(!/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i.test(letterC), 'cover letter has no date line');
assert(!/\(\s*WebSockets|\(\s*DynamoDB/i.test(letterC), 'cover letter has no paren keyword spam');
assert(/cummins|aws|terraform|cloudwatch|platform/i.test(letterC), 'cover letter mentions JD/company stack');
assert(!/quest, intverse, glidewell, and srijan maps directly/i.test(letterC), 'cover letter is not the old generic template');

// exit_story must not seed summaries when LLM summary is empty
const pollutedProfile = JSON.parse(JSON.stringify(profile));
pollutedProfile.narrative = {
  ...(pollutedProfile.narrative || {}),
  exit_story:
    '(WebSockets, Jenkins) (CI/CD) 7+ years building production-grade distributed systems (DynamoDB, REST API, Azure).',
};
const pkgNoExit = executeTailoringPlan(planC, pollutedProfile, { jdText: CUMMINS_JD, companyName: 'Cummins' });
assert(!/WebSockets/i.test(String(pkgNoExit.resume.summary || '')), 'exit_story paren spam does not leak into summary');
assert(!/\(DynamoDB/i.test(String(pkgNoExit.resume.summary || '')), 'exit_story trailing paren dump does not leak');

console.log('\n14. iDirect C++/Linux/satellite — JD-shaped resume, not TypeScript dump\n');
const IDIRECT_JD = `
We are in search for an Software Engineer at ST Engineering iDirect.
Technical Requirements
Hands-on experience developing, designing, and testing multi-threaded and multi-process applications on Linux, with strong working knowledge of C++
Proven experience with solving real-time embedded issues, including threading, optimization, memory management, interrupt handling
Knowledge of networking protocols (TCP/IP), Sockets programming
Understanding of 3GPP standards, 5G architecture desired
Experience with cloud technologies (AWS/Azure) desired
Working experience with tools such as GDB and Valgrind
Experience with Jira and Jenkins desired
Scripting using shell scripting or Python desired
Experience/ knowledge in satellite/ terrestrial communications systems is desired
Experience developing unit tests, integration tests, including CI/CD pipeline desired
`;
const planId = buildTailoringPlan(IDIRECT_JD, profile);
assert(planId.family === 'embedded_systems', `iDirect family is embedded_systems (got ${planId.family})`);
assert(!/full[-\s]?stack/i.test(planId.displayTitle), `iDirect title is not Full-Stack (got ${planId.displayTitle})`);
const cppExtract = extractJdTechKeywords(IDIRECT_JD, 24).join(' ');
assert(/c\+\+/i.test(cppExtract), `C++ extracted from iDirect JD (got ${cppExtract})`);
const pkgId = executeTailoringPlan(planId, profile, { jdText: IDIRECT_JD, companyName: 'ST Engineering iDirect' });
const summaryId = String(pkgId.resume.summary || '');
const expId = Object.values(pkgId.resume.experience || {}).flat().join('\n');
const compsId = (pkgId.resume.core_competencies || []).join(' ');
const letterId = String(pkgId.cover_letter || '');
assert(!/\bTypeScript\b/i.test(summaryId), `iDirect summary is not TypeScript-led (got ${summaryId.slice(0, 180)})`);
assert(!/\(TypeScript\)\s*\(Python\)|\(TypeScript\)\(Python\)/i.test(expId), 'no stacked TypeScript/Python paren dumps');
assert(/Linux|Python|Jenkins|AWS|Azure|CI\/CD/i.test(summaryId), 'iDirect summary names honest overlap stack');
assert(/c\+\+/i.test(compsId), `C++ listed in skills for ATS (got ${compsId})`);
assert(/Linux|Jenkins|Python/i.test(compsId), 'skills keep Linux/Jenkins/Python overlap');
assert(!/\bc\+\+\b/i.test(expId), 'does not invent C++ into experience bullets');
assert(!/\bGDB\b/i.test(expId) || /\bgdb\b/i.test(profileCorpusTextSafe(profile)), 'does not invent GDB into experience');
assert(!/\bValgrind\b/i.test(expId), 'does not invent Valgrind into experience');
assert(/linux|python|jenkins|ci\/cd|aws|azure/i.test(letterId), 'cover letter maps honest overlap');
assert(/idirect|satellite|linux|c\+\+/i.test(letterId), 'cover letter is about this posting');
assert(!/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i.test(letterId), 'iDirect cover letter has no date');
assert(!/—/.test(letterId), 'cover letter has no em-dash');
assert(!/\btypescript\b|\breact\.?js\b/i.test(letterId), 'cover letter is not a TypeScript/React letter');

const datedLlm = `August 26, 2026\n\nI am a TypeScript React full-stack engineer.\n\nI ship Next.js dashboards.\n\nThanks.`;
const professional = finalizeCoverLetter({
  llmText: datedLlm,
  plan: planId,
  profile,
  companyName: 'ST Engineering iDirect',
  jdText: IDIRECT_JD,
  resume: pkgId.resume,
});
assert(!/august/i.test(professional), 'dated LLM letter is stripped or replaced');
assert(!/\btypescript\b/i.test(professional), 'off-JD TypeScript LLM letter is rejected for embedded JD');
assert(stripCoverLetterDates('August 26, 2026\nHello') === 'Hello', 'stripCoverLetterDates removes calendar date');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
