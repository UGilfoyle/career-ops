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
} from './resume-quality.mjs';

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
  const resume = {
    summary: 'Senior engineer who developed developed cloud platforms.',
    experience: {
      '0': [
        'Implemented AWS Lambda functions for event processing',
        'Implemented Docker-based deployment workflows',
        'Led team code reviews and mentoring',
      ],
    },
  };
  const sourceExperience = [
    {
      bullets: [
        'Reconfigured EC2 auto-scaling policies to reduce infrastructure costs by 30%.',
        'Automated deployment workflows, diminishing continuous deployment failure rates by 85%.',
      ],
    },
  ];
  const auditBefore = auditResumeQuality(resume);
  const { resume: polished, stats } = polishTailoredResume(resume, sourceExperience);
  const bullets = polished.experience['0'];
  const joined = [...bullets, polished.summary].join(' ').toLowerCase();
  assert((joined.match(/\bimplemented\b/g) || []).length <= 1, 'polish caps global implemented');
  assert(stats.wordRepetitionsFixed > 0 || stats.verbsRotated > 0, 'polish reports repetition fixes');
  const auditAfter = auditResumeQuality(polished);
  assert(
    estimateAtsContentScore(auditAfter) >= estimateAtsContentScore(auditBefore),
    'ATS content score improves after polish',
  );
  assert(auditAfter.repeatedWords.length <= auditBefore.repeatedWords.length, 'fewer repeated words after polish');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
