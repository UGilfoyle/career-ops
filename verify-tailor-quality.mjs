#!/usr/bin/env node
/**
 * verify-tailor-quality.mjs — offline check that polish + naming hit 90+ without DB/LLM.
 * Honest mode: grafted metrics only (no synthetic %). ATS floor is content score, not 100% metric density.
 */

import { polishTailoredResume, auditResumeQuality, estimateAtsContentScore } from './resume-quality.mjs';
import { buildApplicationDocumentPaths } from './document-filename.mjs';

const sourceExperience = [
  {
    company: 'Quest Global',
    bullets: [
      'Reconfigured EC2 auto-scaling policies to reduce infrastructure costs by 30%.',
      'Cut server CPU load by 30% on Oracle workloads.',
      'Shipped AWS Lambda event processors with 99.9% success rate.',
    ],
  },
  {
    company: 'INTVERSE',
    bullets: [
      'Reduced backend server CPU load by 35%.',
      'Delivered Node.js APIs handling 1,000+ daily transactions.',
    ],
  },
];

const resume = {
  summary: [
    'Senior Backend Engineer with 7+ years owning AWS, Python, and Node.js systems.',
    'Drive cloud cost and reliability work with measurable production outcomes.',
    'Own CI/CD, reviews, and mentoring so teams ship reliable software faster.',
  ].join('\n'),
  core_competencies: [
    'AWS', 'Python', 'Node.js', 'Docker', 'Lambda', 'CI/CD',
    'PostgreSQL', 'Oracle', 'Microservices', 'REST APIs',
    'GitHub Actions', 'System Design',
  ],
  experience: {
    '0': [
      'Reconfigured EC2 auto-scaling policies on AWS to cut infrastructure spend',
      'Cut Oracle workload CPU load with query and capacity tuning',
      'Shipped AWS Lambda event processors for production traffic',
      'Led team code reviews and mentoring across backend services',
    ],
    '1': [
      'Reduced backend server CPU load on Node.js APIs',
      'Delivered Node.js APIs for billing and operations traffic',
      'Cut API latency with PostgreSQL indexing',
    ],
  },
};

const before = auditResumeQuality(resume);
const scoreBefore = estimateAtsContentScore(before);
const { resume: polished, stats } = polishTailoredResume(
  JSON.parse(JSON.stringify(resume)),
  sourceExperience,
  { jdAlignScore: 92, allowSyntheticMetrics: false },
);
const after = auditResumeQuality(polished);
const paths = buildApplicationDocumentPaths({
  candidateName: 'Akash Kaintura',
  company: 'Stripe',
  roleTitle: 'Senior Backend Engineer',
});

const ok =
  stats.atsContentScore >= 90
  && after.repeatedVerbs.length === 0
  && paths.resumePdf.endsWith('AkashKaintura_Stripe_SrBEEng.pdf')
  && paths.coverPdf.endsWith('AkashKaintura_Stripe_SrBEEng_cover.pdf');

console.log(JSON.stringify({
  ok,
  scoreBefore,
  scoreAfter: stats.atsContentScore,
  withoutMetrics: after.withoutMetrics,
  metricsEnriched: stats.metricsEnriched,
  paths,
}, null, 2));
process.exit(ok ? 0 : 1);
