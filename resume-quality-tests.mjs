#!/usr/bin/env node
/**
 * resume-quality-tests.mjs — regression tests for resume polish helpers
 */

import {
  dedupeVerbStarts,
  enrichBulletWithSourceMetric,
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
  assert(rotated >= 2, 'rotates repeated implemented/developed verbs');
  const verbs = out.map((b) => b.split(' ')[0].toLowerCase());
  assert(new Set(verbs).size === verbs.length, 'all leading verbs are unique');
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
  const { resume: polished, stats } = polishTailoredResume(resume, sourceExperience);
  const bullets = polished.experience['0'];
  const verbs = bullets.map((b) => b.split(' ')[0].toLowerCase());
  assert(new Set(verbs).size === verbs.length, 'polishTailoredResume dedupes verbs');
  assert(stats.verbsRotated > 0, 'polish reports verb rotations');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
