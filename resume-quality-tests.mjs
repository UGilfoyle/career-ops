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
} from './resume-quality.mjs';
import {
  extractJdKeywords,
  alignResumeToJd,
  isJunkKeyword,
} from './jd-keyword-align.mjs';
import { buildHonestSummary, buildJdMatchedCompetencies } from './jd-profile-match.mjs';

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
  const source = ['Optimized SQL query patterns, cutting server CPU load by 30% on Oracle workloads.'];
  const tailored = 'Tuned database access patterns for high-volume Oracle and PostgreSQL services';
  const { bullet, enriched } = enrichBulletWithSourceMetric(tailored, source);
  assert(enriched, 'grafts metric from matching source bullet');
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
  // Explicit opt-in still allows synthesis for legacy callers
  const resume = {
    summary: 'Engineer.\nBuilds APIs.\nShips features.',
    core_competencies: ['Node.js'],
    experience: { '0': ['Built REST APIs for internal tools'] },
  };
  const { resume: polished } = polishTailoredResume(resume, [], { allowSyntheticMetrics: true, jdAlignScore: 50 });
  const b = polished.experience['0'][0].toLowerCase();
  assert(hasQuantifiedImpact(b) || b.includes('%') || /\d/.test(b), 'opt-in synthesis can add a metric');
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
  assert(exploded.some((b) => /^Developed\b/i.test(b) || /^Built\b/i.test(b)), 'uses strong past-tense verbs');
  const normalized = normalizeExperienceBulletList([wall]);
  assert(normalized.length >= 3, 'normalizeExperienceBulletList also explodes walls');
  assert(normalized.every((b) => /^[A-Z]/.test(b) && /[.!?]$/.test(b)), 'normalized bullets are proper sentences');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
