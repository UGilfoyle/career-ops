#!/usr/bin/env node
/**
 * verify-tailor-quality.mjs — offline check that polish + naming hit 90+ without DB/LLM.
 */

import { polishTailoredResume, auditResumeQuality, estimateAtsContentScore } from './resume-quality.mjs';
import { buildApplicationDocumentPaths } from './document-filename.mjs';

const sourceExperience = [
  {
    bullets: [
      'Reconfigured EC2 auto-scaling policies to reduce infrastructure costs by 30%.',
      'Cut server CPU load by 30% on Oracle workloads.',
    ],
  },
  {
    bullets: ['Reduced backend server CPU load by 35%.'],
  },
];

const resume = {
  summary: 'Senior engineer with AWS and Python experience.',
  experience: {
    '0': [
      'Implemented AWS Lambda functions for event processing',
      'Implemented Docker-based deployment workflows',
      'Led team code reviews and mentoring',
    ],
    '1': [
      'Developed React dashboards for internal operations',
      'Developed Node.js APIs for billing services',
    ],
  },
};

const before = auditResumeQuality(resume);
const scoreBefore = estimateAtsContentScore(before);
const { resume: polished, stats } = polishTailoredResume(JSON.parse(JSON.stringify(resume)), sourceExperience);
const after = auditResumeQuality(polished);
const paths = buildApplicationDocumentPaths({
  candidateName: 'Akash Kaintura',
  company: 'Stripe',
  roleTitle: 'Senior Backend Engineer',
});

const ok =
  stats.atsContentScore >= 90
  && after.repeatedVerbs.length === 0
  && after.withoutMetrics === 0
  && paths.resumePdf.endsWith('AkashKaintura_Stripe_SrBEEng.pdf')
  && paths.coverPdf.endsWith('AkashKaintura_Stripe_SrBEEng_cover.pdf');

console.log(JSON.stringify({ ok, scoreBefore, scoreAfter: stats.atsContentScore, paths }, null, 2));
process.exit(ok ? 0 : 1);
