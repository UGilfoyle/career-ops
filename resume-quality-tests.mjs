#!/usr/bin/env node
/**
 * resume-quality-tests.mjs — regression tests for resume polish helpers
 */

import {
  auditResumeQuality,
  dedupeGlobalWordFrequency,
  dedupeIntraSentenceRepetition,
  dedupeVerbStarts,
  enrichBulletWithSourceMetric,
  estimateAtsContentScore,
  hasQuantifiedImpact,
  polishTailoredResume,
  normalizeBulletText,
  normalizeExperienceBulletList,
  isBulletContinuationFragment,
  explodeWallOfTextBullets,
  scrubResumeArtifacts,
  preferSourceIfThin,
  isEmbeddedJobHeader,
  sanitizeExperienceEntries,
  parseTenureMonths,
  bulletsBudgetForRole,
  rewriteFirstPersonBullet,
  elevateBulletToSenior,
  elevateBulletToMidLevel,
  elevateBulletForEmployer,
  isSeniorToneEmployer,
} from './resume-quality.mjs';
import {
  extractJdKeywords,
  alignResumeToJd,
  isJunkKeyword,
} from './jd-keyword-align.mjs';
import { buildHonestSummary, buildJdMatchedCompetencies, reframeExperienceFromProfile } from './jd-profile-match.mjs';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${label}`);
  }
}

console.log('resume-quality tests\n');

{
  const bullets = [
    'Implemented microservices on AWS Lambda',
    'Implemented CI/CD pipelines with GitHub Actions',
    'Developed React dashboards for internal ops',
    'Developed Node.js APIs for billing',
  ];
  const { bullets: out, rotated } = dedupeVerbStarts(bullets);
  assert(rotated >= 2, 'rotates repeated implemented/developed leading verbs');
  const verbs = out.map((b) => b.split(' ')[0].toLowerCase());
  assert(new Set(verbs).size === verbs.length, 'all leading verbs are unique');
}

{
  const { text, fixes } = dedupeIntraSentenceRepetition(
    'Developed and developed scalable APIs that developed faster release cycles.',
  );
  assert(fixes >= 1, 'fixes repeated words within same sentence');
  const lower = text.toLowerCase();
  assert((lower.match(/\bdeveloped\b/g) || []).length <= 1, 'developed appears at most once after polish');
}

{
  const { texts, fixes } = dedupeGlobalWordFrequency([
    'Implemented AWS Lambda event pipelines.',
    'Implemented Docker workflows for staging.',
    'Implemented monitoring for production services.',
  ]);
  assert(fixes >= 2, 'reduces global implemented count');
  const joined = texts.join(' ').toLowerCase();
  assert((joined.match(/\bimplemented\b/g) || []).length <= 1, 'implemented used once globally');
}

{
  const source = [
    'Optimized SQL query patterns for Oracle and PostgreSQL workloads, cutting server CPU load by 30% on Oracle databases.',
  ];
  const tailored = 'Tuned SQL query patterns for high-volume Oracle and PostgreSQL services';
  const { bullet, enriched } = enrichBulletWithSourceMetric(tailored, source);
  assert(enriched, 'grafts metric from strongly overlapping source bullet');
  assert(hasQuantifiedImpact(bullet), 'enriched bullet contains a metric');
}

{
  assert(normalizeBulletText('remodeling SQL query patterns.') === 'Remodeling SQL query patterns.', 'capitalizes leading letter');
  assert(isBulletContinuationFragment('by 22% through right-sized instance optimization.'), 'detects by-fragment');
  assert(isBulletContinuationFragment('800ms to 120ms and improving throughput.'), 'detects metric fragment');
  const fixed = normalizeExperienceBulletList([
    'Cut latency from',
    '800ms to 120ms and improving RESTful APIs throughput by 3x.',
    'Optimized Oracle workloads by 30%.',
    'by 22% through right-sized instance optimization.',
  ]);
  assert(fixed.every((b) => /^[A-Z]/.test(b)), 'all merged bullets start uppercase');
  assert(fixed.length <= 3, 'fragments merged into prior bullets');
  assert(!fixed.some((b) => /^by /i.test(b)), 'no orphan by-fragments remain');
}

{
  const resume = {
    summary: 'Senior engineer who developed developed cloud platforms.\nDelivers reliable APIs and CI/CD releases.\nCollaborates with product partners through launch.',
    core_competencies: [
      'React', 'TypeScript', 'Node.js', 'AWS', 'Docker', 'PostgreSQL',
      'CI/CD', 'REST API', 'Kubernetes', 'GraphQL', 'Redis', 'Jest',
    ],
    experience: {
      '0': [
        'Implemented AWS Lambda functions for event processing',
        'Implemented Docker-based deployment workflows',
        'Led team code reviews and mentoring',
        'remodeling SQL query patterns for Oracle.',
        'by 22% through right-sized instance optimization.',
      ],
    },
  };
  const sourceExperience = [
    {
      bullets: [
        'Reconfigured EC2 auto-scaling policies to reduce infrastructure costs by 30%.',
        'Automated deployment workflows, diminishing continuous deployment failure rates by 85%.',
        'Remodeled SQL query patterns for Oracle, cutting CPU by 22% through right-sized instance optimization.',
      ],
    },
  ];
  const auditBefore = auditResumeQuality(resume);
  const { resume: polished, stats } = polishTailoredResume(resume, sourceExperience, {
    jdAlignScore: 88,
    allowSyntheticMetrics: false,
  });
  const bullets = polished.experience['0'];
  assert(bullets.every((b) => /^[A-Z]/.test(String(b).trim())), 'polish output bullets are capitalized');
  assert(bullets.every((b) => /[.!?]$/.test(String(b).trim())), 'polish output bullets end with punctuation');
  assert(!bullets.some((b) => /^by /i.test(String(b).trim())), 'polish merges by-fragments');
  const joined = [...bullets, polished.summary].join(' ').toLowerCase();
  assert((joined.match(/\bimplemented\b/g) || []).length <= 1, 'polish caps global implemented');
  assert(stats.wordRepetitionsFixed > 0 || stats.verbsRotated > 0, 'polish reports repetition fixes');
  const auditAfter = auditResumeQuality(polished);
  assert(
    estimateAtsContentScore(auditAfter, {
      jdAlignScore: 88,
      competencyCount: 12,
      summaryLines: 3,
    }) >= estimateAtsContentScore(auditBefore, { jdAlignScore: 88, competencyCount: 12, summaryLines: 3 }),
    'ATS content score improves after polish',
  );
  assert(stats.atsContentScore >= 90, 'polish reaches 90+ ATS content score without synthetic metrics');
  assert(stats.allowSyntheticMetrics === false, 'synthetic metrics disabled by default');
  // Must not invent stock metrics like "10,000+ concurrent"
  assert(!joined.includes('10,000+'), 'does not invent 10k concurrent metric');
  assert(!joined.includes('99.99%'), 'does not invent 99.99% uptime metric');
}

{
  // Synthetic metrics permanently disabled — even with opt-in flag
  const resume = {
    summary: 'Engineer.\nBuilds APIs.\nShips features.',
    core_competencies: ['Node.js'],
    experience: { '0': ['Built REST APIs for internal tools'] },
  };
  const { resume: polished } = polishTailoredResume(resume, [], { allowSyntheticMetrics: true, jdAlignScore: 50 });
  const b = polished.experience['0'][0].toLowerCase();
  assert(!b.includes('10,000+'), 'never invents 10k concurrent even with allowSyntheticMetrics');
  assert(!b.includes('99.99%'), 'never invents uptime even with allowSyntheticMetrics');
  assert(!b.includes('by 20%'), 'never invents stock throughput %');
}

{
  assert(isJunkKeyword('Find'), 'Find is junk keyword');
  assert(isJunkKeyword('Apply'), 'Apply is junk keyword');
  const jd = `Find jobs\nSign in\nRequirements:\n- Find candidates with React and TypeScript\n- Node.js and PostgreSQL\n- AWS experience`;
  const kws = extractJdKeywords(jd, 20);
  assert(!kws.some((k) => /^find$/i.test(k)), 'JD keywords never include Find');
  const comps = buildJdMatchedCompetencies(kws, { narrative: { superpowers: ['React'] }, experience: [] }, jd);
  assert(!comps.some((c) => /^find$/i.test(c)), 'competencies never include Find');
  assert(comps.some((c) => /react/i.test(c)), 'competencies still include React');
  const summary = buildHonestSummary('', 7, kws, jd);
  assert(!/\bFind\b/.test(summary), 'summary never says Find');
  assert(/React|TypeScript|Node/i.test(summary), 'summary names real JD tech');

  const dirty = {
    summary: 'Senior Software Engineer with 7+ years shipping production systems in Find.',
    core_competencies: ['Find', 'React', 'TypeScript'],
    experience: {
      '0': [
        'Mean time to recovery by 60% during production incidents using Find.',
        'Partnered with React.js frontend teams to build GraphQL RESTful APIs layers.',
        'Reduced database response times by 40% By 45% and improved page load times.',
      ],
    },
  };
  const { resume: cleaned } = polishTailoredResume(dirty, [], { jdAlignScore: 80 });
  const blob = JSON.stringify(cleaned);
  assert(!/\bFind\b/.test(blob), 'polish strips Find artifacts');
  assert(!/GraphQL RESTful/i.test(blob), 'polish fixes GraphQL RESTful mashup');
  assert(!/40%\s*By\s*45%/i.test(blob), 'polish removes double metric By 45%');
  assert(!cleaned.core_competencies.includes('Find'), 'Find removed from competencies');
}

{
  const scrubbed = scrubResumeArtifacts(
    'Cut latency from 800Ms to 120ms (Find) And PostgreSQL, by 40% By 45%.'
  );
  assert(!/\bFind\b/.test(scrubbed), 'scrub removes (Find)');
  assert(/800ms/.test(scrubbed), 'scrub normalizes Ms → ms');
  assert(!/By 45%/i.test(scrubbed), 'scrub removes duplicate By 45%');
  assert(/ and /i.test(scrubbed), 'scrub lowercases mid-sentence And');
}

{
  const merged = normalizeExperienceBulletList([
    'Cut API latency',
    '800Ms to 120ms and improving RESTful APIs throughput by 3x (Find) and PostgreSQL.',
  ]);
  assert(merged.length === 1, 'long metric fragment merges into prior bullet');
  assert(!/\bFind\b/.test(merged[0]), 'merged bullet has no Find');
  assert(/800ms/i.test(merged[0]), 'merged bullet keeps latency metric');
}

{
  const wall = `As a Backend and Frontend Developer, I was responsible for developing and maintaining multiple client projects using Laravel, Node.js, and React.js. I also worked closely with designers to implement responsive UI using Tailwind CSS. My work involved building GraphQL APIs, writing Jest tests, and deploying services on AWS with MongoDB.`;
  const exploded = explodeWallOfTextBullets([wall]);
  assert(exploded.length >= 3, `Rubico-style wall splits into 3+ bullets (got ${exploded.length})`);
  assert(exploded.every((b) => !/^As a /i.test(b)), 'no essay "As a …" openings remain');
  assert(exploded.every((b) => !/^I\s/i.test(b)), 'no leading first-person I');
  assert(exploded.every((b) => !/^Owned developing/i.test(b)), 'no Owned developing gerund leftovers');
  assert(exploded.some((b) => /^(Developed|Built|Engineered|Partnered|Delivered)\b/i.test(b)), 'uses strong past-tense verbs');
  const normalized = normalizeExperienceBulletList([wall]);
  assert(normalized.length >= 3, 'normalizeExperienceBulletList also explodes walls');
  assert(normalized.every((b) => /^[A-Z]/.test(b) && /[.!?]$/.test(b)), 'normalized bullets are proper sentences');
  assert(normalized.every((b) => !/^(Helped|Worked on|Assisted)\b/i.test(b)), 'normalized mid bullets scrub junior fluff');
  assert(normalized.some((b) => /^(Developed|Built|Delivered|Partnered|Engineered)\b/i.test(b)), 'normalized mid bullets keep competent IC verbs');
  assert(normalized.every((b) => !/multiple client projects/i.test(b)), 'no junior client-projects phrasing');
}

{
  // (a) KOCO-style orphan fragments must merge / not render as standalone crumbs
  assert(isBulletContinuationFragment('Logic into scalable, highly available Node.js services.'), 'detects Logic into fragment');
  assert(isBulletContinuationFragment('Integrity through rigorous algorithmic validation with zero data loss.'), 'detects Integrity through fragment');
  assert(isBulletContinuationFragment('Authentication flows that processed 1,000+ daily transactions.'), 'detects Authentication flows fragment');
  const koco = normalizeExperienceBulletList([
    'Authored the complete backend architecture for a multi-tenant platform, synthesizing.',
    'Logic into scalable, highly available Node.js services.',
    'Formulated complex Python ETL scripts to migrate legacy records, preserving.',
    'Integrity through rigorous algorithmic validation with zero data loss.',
  ]);
  assert(!koco.some((b) => /^Logic into/i.test(b)), 'no orphan Logic into bullet');
  assert(!koco.some((b) => /^Integrity through/i.test(b)), 'no orphan Integrity through bullet');
  assert(koco.every((b) => /^[A-Z]/.test(b) && b.length >= 40), 'KOCO merged bullets are complete sentences');

  const artisans = normalizeExperienceBulletList([
    'Developed and deployed backend endpoints using Node.js/Express, integrating third-party payment gateways and',
    'Authentication flows that processed 1,000+ daily transactions with zero security incidents.',
  ]);
  assert(artisans.length === 1, 'Artisanssoft authentication fragment merges into prior bullet');
  assert(/payment gateways/i.test(artisans[0]) && /Authentication flows|authentication flows/i.test(artisans[0]), 'merged payment + auth flows');
}

{
  // (b) Rubico wall → ≥3 good bullets without orphans; prefer source when tailored is thin
  const rubicoSource = [
    'Developed backend web systems end-to-end, from MongoDB schema design through RESTful API construction for major client deliverables.',
    'Owned core application infrastructure for client projects, taking responsibility from data modeling through API delivery and release readiness.',
    'Provisioned Amazon Web Services infrastructure (EC2, S3) for application hosting and object storage across client environments.',
    'Established secure deployment practices by configuring server firewalls and OS patch management routines on hosted environments.',
  ];
  const thinTailored = [
    'Developed backend systems using Laravel and Node.js, and building the frontend.',
    'Deployed on AWS.',
  ];
  const fixedGrammar = rewriteFirstPersonBullet(thinTailored[0]);
  assert(!/\band building\b/i.test(fixedGrammar), 'rewrites and building → and built');
  assert(/\band built\b/i.test(fixedGrammar), 'contains and built');

  const recovered = preferSourceIfThin(thinTailored, rubicoSource, { minCount: 3, maxBullets: 4 });
  assert(recovered.length >= 3, `Rubico thin tailored recovers ≥3 bullets (got ${recovered.length})`);
  assert(!recovered.some((b) => isBulletContinuationFragment(b)), 'recovered Rubico bullets have no orphan fragments');
  assert(recovered.every((b) => b.length >= 60), 'recovered Rubico bullets are substantive');
}

{
  // (c) Tenure budget ≥3 for 2-year role even at late role index
  const tenure = parseTenureMonths('Sep 2019 – Sep 2021');
  assert(tenure >= 24, `Rubico tenure parses to ~24 months (got ${tenure})`);
  const budget = bulletsBudgetForRole(5, { tenureMonths: tenure, maxPages: 2 });
  assert(budget >= 3, `2-year role at index 5 gets ≥3 bullet budget (got ${budget})`);
  assert(budget >= 4, `24+ month role prefers 4 bullet budget (got ${budget})`);
  assert(bulletsBudgetForRole(5, { tenureMonths: 12, maxPages: 2 }) === 2, 'short late role still capped at 2 without tenure floor');
}

{
  // Senior summary: kadak, not soft filler
  const summary = buildHonestSummary('', 7, ['React', 'TypeScript', 'Node.js', 'AWS'],
    'Senior Software Engineer React TypeScript Node.js AWS microservices');
  assert(/Senior Software Engineer/i.test(summary), 'summary opens with senior title');
  assert(/7\+\s*years/i.test(summary), 'summary states 7+ years');
  assert(/React|TypeScript|Node/i.test(summary), 'summary names JD stack');
  assert(!/collaborate with product partners/i.test(summary), 'summary rejects soft collaborate filler');
  assert(/own|lead|architect|reliab|SDLC|mentor/i.test(summary), 'summary uses ownership/senior language');
  const summaryLines = summary.split('\n').filter(Boolean);
  assert(summaryLines.length >= 3 && summaryLines.length <= 4, `summary is 3–4 lines (got ${summaryLines.length})`);
}

{
  // Reframe respects tenure floor for multi-year older role
  const exp = [
    { role: 'SSE', company: 'A', period: 'Jul 2025 – Present', bullets: ['Owned microservices on AWS cutting costs by 30%.'] },
    { role: 'SSE', company: 'B', period: 'Feb 2025 – Jun 2025', bullets: ['Built React dashboards with TypeScript.'] },
    { role: 'SE', company: 'C', period: 'Aug 2023 – Oct 2024', bullets: ['Tuned SQL cutting CPU by 35%.'] },
    { role: 'SE', company: 'D', period: 'Aug 2022 – Jul 2023', bullets: ['Integrated Kafka reconciliation for payments.'] },
    { role: 'FS', company: 'E', period: 'Oct 2021 – Jul 2022', bullets: ['Authored Node.js multi-tenant backend architecture.'] },
    {
      role: 'SD',
      company: 'Rubico IT Pvt Ltd',
      period: 'Sep 2019 – Sep 2021',
      bullets: [
        'Developed backend web systems end-to-end, from MongoDB schema design through RESTful API construction for major client deliverables.',
        'Owned core application infrastructure for client projects, taking responsibility from data modeling through API delivery and release readiness.',
        'Provisioned Amazon Web Services infrastructure (EC2, S3) for application hosting and object storage across client environments.',
        'Established secure deployment practices by configuring server firewalls and OS patch management routines on hosted environments.',
      ],
    },
  ];
  const reframed = reframeExperienceFromProfile(exp, 'Node.js AWS MongoDB APIs', ['Node.js', 'AWS', 'MongoDB'], 6);
  assert((reframed['5'] || []).length >= 3, `reframe gives Rubico ≥3 bullets (got ${(reframed['5'] || []).length})`);
}

{
  // LinkedIn / senior elevation bar (function itself)
  assert(
    /^Engineered\b/i.test(elevateBulletToSenior('Developed backend systems using Laravel and Node.js.')),
    'Developed → Engineered',
  );
  assert(
    /^Diagnosed\b/i.test(elevateBulletToSenior('Analyzed performance bottlenecks in backend services.')),
    'Analyzed → Diagnosed',
  );
  assert(
    /^Drove\b/i.test(elevateBulletToSenior('Helped the team ship APIs.')),
    'Helped → Drove',
  );
  assert(
    !/multiple client projects/i.test(elevateBulletToSenior('Owned multiple client projects on AWS.')),
    'client projects → production platforms',
  );
  assert(
    /^Led peer code reviews/i.test(elevateBulletToSenior('Conducted peer code reviews and mentored juniors.')),
    'Conducted code reviews → Led peer code reviews',
  );
  assert(
    /^Drove payment gateway integrations at Artisanssoft\.?$/i.test(
      elevateBulletToSenior('Assisted Artisanssoft with payment gateway integrations.'),
    ),
    'Assisted Company with X → Drove X at Company (senior fn)',
  );

  // Company-aware gating
  assert(isSeniorToneEmployer('Quest Global'), 'Quest Global is senior-tone employer');
  assert(isSeniorToneEmployer('INTVERSE'), 'INTVERSE is senior-tone employer');
  assert(isSeniorToneEmployer('Glidewell Dental'), 'Glidewell is senior-tone employer');
  assert(isSeniorToneEmployer('Srijan Technologies'), 'Srijan is senior-tone employer');
  assert(!isSeniorToneEmployer('KOCO'), 'KOCO is mid-tone employer');
  assert(!isSeniorToneEmployer('Rubico IT Pvt Ltd'), 'Rubico is mid-tone employer');
  assert(!isSeniorToneEmployer('Artisanssoft'), 'Artisanssoft is mid-tone employer');

  const seniorJobs = [
    ['Developed backend systems using Python.', 'Quest Global'],
    ['Helped ship React dashboards.', 'INTVERSE'],
    ['Analyzed SQL bottlenecks cutting CPU 35%.', 'Glidewell'],
    ['Built Node.js payment features.', 'Srijan'],
  ];
  for (const [bullet, company] of seniorJobs) {
    const out = elevateBulletForEmployer(bullet, company);
    assert(!/^(Developed|Helped|Assisted|Worked on|Analyzed|Built)\b/i.test(out), `senior elevates openings at ${company}`);
  }
  assert(/^Engineered\b/i.test(elevateBulletForEmployer('Developed APIs on Node.js.', 'Quest')), 'Quest Developed → Engineered');
  assert(/^Drove\b/i.test(elevateBulletForEmployer('Helped ship dashboards.', 'INTVERSE')), 'INTVERSE Helped → Drove');

  const midJobs = [
    ['Helped deploy applications on AWS.', 'KOCO'],
    ['Assisted with payment gateway integrations.', 'Artisanssoft'],
    ['Worked on multi-tenant Node.js architecture.', 'KOCO'],
    ['Developed MongoDB APIs and AWS hosting.', 'Rubico'],
    ['Built REST endpoints for client deliverables.', 'Rubico'],
  ];
  for (const [bullet, company] of midJobs) {
    const out = elevateBulletForEmployer(bullet, company);
    assert(!/^(Helped|Assisted|Worked on)\b/i.test(out), `mid scrubs junior fluff at ${company}`);
    assert(!/^(Architected|Owned|Drove|Mentored)\b/i.test(out), `mid avoids senior escalation at ${company}`);
  }
  assert(/^Developed\b/i.test(elevateBulletForEmployer('Developed MongoDB APIs.', 'Rubico')), 'Rubico keeps Developed');
  assert(/^Built\b/i.test(elevateBulletForEmployer('Worked on payment gateways.', 'Artisanssoft')), 'Artisanssoft Worked on → Built');
  assert(/^Delivered\b/i.test(elevateBulletToMidLevel('Helped deploy applications on AWS.')), 'mid Helped → Delivered');
  assert(/^Developed\b/i.test(elevateBulletToMidLevel('Developed backend systems using Laravel.')), 'mid keeps Developed');
  assert(
    /^Implemented payment gateway integrations at Artisanssoft\.?$/i.test(
      elevateBulletForEmployer('Assisted Artisanssoft with payment gateway integrations.', 'Artisanssoft'),
    ),
    'mid Assisted Company with X → Implemented X at Company (not Drove)',
  );

  const juniorishSenior = normalizeExperienceBulletList([
    'Developed backend systems using Laravel and Node.js, and building the frontend with React.js.',
    'Helped deploy applications on AWS.',
    'Worked on payment gateway integrations with measurable throughput.',
  ], 'Quest Global');
  assert(juniorishSenior.every((b) => !/^(Developed|Helped|Worked on|Assisted)\b/i.test(b)), 'normalize elevates junior openings for senior employer');
  assert(juniorishSenior.every((b) => !/\band building\b/i.test(b)), 'and building fixed under senior polish');

  const juniorishMid = normalizeExperienceBulletList([
    'Developed backend systems using Laravel and Node.js, and building the frontend with React.js.',
    'Helped deploy applications on AWS.',
    'Worked on payment gateway integrations with measurable throughput.',
  ], 'KOCO');
  assert(juniorishMid.every((b) => !/^(Helped|Worked on|Assisted)\b/i.test(b)), 'mid normalize scrubs junior fluff');
  assert(juniorishMid.some((b) => /^Developed\b/i.test(b)), 'mid normalize keeps Developed');
  assert(juniorishMid.every((b) => !/^(Architected|Owned|Drove)\b/i.test(b)), 'mid normalize avoids senior verbs');
  assert(juniorishMid.every((b) => !/\band building\b/i.test(b)), 'and building fixed under mid polish');

  // Per-employer samples — senior vs mid (no blanket senior on all 7)
  const seniorOnly = [
    ['Developed backend systems using Python.', 'Quest Global'],
    ['Helped ship React dashboards.', 'INTVERSE'],
    ['Analyzed SQL bottlenecks cutting CPU 35%.', 'Glidewell'],
    ['Built Node.js payment features.', 'Srijan'],
  ].map(([b, c]) => elevateBulletForEmployer(b, c));
  assert(seniorOnly.length === 4, 'four senior employer samples');
  assert(seniorOnly.every((b) => !/^(Developed|Helped|Assisted|Worked on|Analyzed|Built)\b/i.test(b)), 'senior employers elevated');

  const midOnly = [
    ['Worked on multi-tenant Node.js architecture.', 'KOCO'],
    ['Developed MongoDB APIs and AWS hosting.', 'Rubico'],
    ['Assisted with payment gateway integrations.', 'Artisanssoft'],
  ].map(([b, c]) => elevateBulletForEmployer(b, c));
  assert(midOnly.length === 3, 'three mid employer samples');
  assert(midOnly.every((b) => !/^(Helped|Assisted|Worked on)\b/i.test(b)), 'mid employers scrub junior fluff');
  assert(midOnly.every((b) => !/^(Architected|Owned|Drove|Mentored)\b/i.test(b)), 'mid employers not forced to senior verbs');
  assert(midOnly.some((b) => /^Developed\b/i.test(b)), 'Rubico Developed preserved');

  // explode default maxOut=6 must not drop a 7th discrete short bullet
  const sevenDiscrete = [
    'Built APIs for Quest Global on Python.',
    'Shipped React dashboards at INTVERSE.',
    'Tuned Glidewell SQL bottlenecks cutting CPU 35%.',
    'Delivered Srijan Node.js payment features.',
    'Built KOCO multi-tenant Node.js architecture.',
    'Developed Rubico MongoDB APIs and AWS hosting.',
    'Implemented Artisanssoft payment gateway integrations.',
  ];
  assert(explodeWallOfTextBullets(sevenDiscrete).length === 7, 'explode preserves 7 discrete employer samples');
}

{
  assert(isEmbeddedJobHeader('Rubico IT Pvt Ltd - Software Developer Sep 2019 - Sep 2021'), 'detects embedded Rubico job header');
  assert(!isEmbeddedJobHeader('Developed backend web systems end-to-end from MongoDB schema design through RESTful API construction.'), 'does not flag normal bullet');
  const cleaned = sanitizeExperienceEntries([
    {
      role: 'Full-Stack Developer',
      company: 'KOCO Schools',
      period: 'Oct 2021 – Jul 2022',
      bullets: [
        'Authored backend architecture for multi-tenant platform.',
        'Rubico IT Pvt Ltd - Software Developer Sep 2019 - Sep 2021',
        'Formulated Python ETL scripts for legacy migration.',
      ],
    },
    {
      role: 'Software Developer',
      company: 'Rubico IT Pvt Ltd',
      period: 'Sep 2019 – Sep 2021',
      bullets: ['Developed backend web systems end-to-end.'],
    },
  ]);
  assert(!cleaned[0].bullets.some((b) => /Rubico IT/i.test(b)), 'strips nested job header from KOCO bullets');

  const dropped = normalizeExperienceBulletList([
    'Orchestrated deployment workflows that reduced.',
    'Cut incident resolution time from 45.',
  ]);
  assert(dropped.length === 0, 'drops incomplete truncated bullets after normalize');

  const mergedPrevent = normalizeExperienceBulletList([
    'Implemented rate limiting on APIs.',
    'Preventing abuse and ensuring stable throughput under peak load.',
  ]);
  assert(mergedPrevent.length === 1, 'merges Preventing fragment into prior bullet');
  assert(!mergedPrevent.some((b) => /^Preventing\b/i.test(b)), 'no standalone Preventing bullet');

  const screenshot = sanitizeExperienceEntries([
    {
      role: 'Full-Stack Developer',
      company: 'KOCO Schools',
      period: 'Oct 2021 – Jul 2022',
      bullets: [
        'Authored the complete backend architecture for a multi-tenant platform, synthesizing complex business logic into scalable, highly available Node.js services Integrity through rigorous validation.',
        'Rubico IT Pvt Ltd - Software Developer Sep 2019 - Sep 2021',
        'Developed comprehensive backend web systems spanning from MongoDB schema design to RESTful API.',
      ],
    },
    {
      role: 'Software Developer',
      company: 'Rubico IT Pvt Ltd',
      period: 'Sep 2019 – Sep 2021',
      bullets: [
        'Developed backend web systems end-to-end, from MongoDB schema design through RESTful API construction for major client deliverables.',
      ],
    },
  ]);
  const kocoJob = screenshot.find((j) => /KOCO/i.test(j.company));
  const rubicoJob = screenshot.find((j) => /Rubico/i.test(j.company));
  assert(kocoJob && rubicoJob, 'KOCO and Rubico jobs kept');
  assert(!kocoJob.bullets.some((b) => /Rubico IT/i.test(b)), 'KOCO has no Rubico header bullet');
  assert(!kocoJob.bullets.some((b) => /MongoDB schema design/i.test(b)), 'KOCO has no Rubico MongoDB bullet');
  assert(rubicoJob.bullets.some((b) => /MongoDB/i.test(b)), 'Rubico keeps MongoDB bullet');
  assert(!/services Integrity through/i.test(kocoJob.bullets.join(' ')), 'Integrity mid-sentence repaired');

  const amexScreenshot = normalizeExperienceBulletList([
    'Authored the complete backend architecture for a multi-tenant platform serving 25,000+ active users, synthesizing complex business logic into scalable, highly available Node.js services.',
    'Integrity through rigorous algorithmic validation with zero data loss.',
    'Developed comprehensive backend web systems spanning from MongoDB schema design to RESTful API.',
    'Construction, directly Owning the core infrastructure for 3 major client deliverables.',
  ]);
  assert(!amexScreenshot.some((b) => /Integrity through/i.test(b)), 'drops Integrity orphan fragment');
  assert(!amexScreenshot.some((b) => /Construction,\s+directly/i.test(b)), 'drops Construction, directly garbled bullet');
  assert(amexScreenshot.some((b) => /multi-tenant platform/i.test(b)), 'keeps clean KOCO architecture bullet');
}


console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
