#!/usr/bin/env node
/**
 * verify-tailor-quality.mjs — offline check that polish + naming hit 88+ without DB/LLM.
 */

import fs from 'fs';
import path from 'path';
import { polishTailoredResume, auditResumeQuality, estimateAtsContentScore } from './resume-quality.mjs';
import { buildApplicationDocumentPaths } from './document-filename.mjs';

const DEBUG_LOG = path.join('.cursor', 'debug-977bca.log');

function agentLog(location, message, data, hypothesisId) {
  const line = JSON.stringify({
    sessionId: '977bca',
    runId: 'verify-post-fix',
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
  });
  fs.mkdirSync('.cursor', { recursive: true });
  fs.appendFileSync(DEBUG_LOG, `${line}\n`);
}

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
  stats.atsContentScore >= 88
  && after.repeatedVerbs.length === 0
  && after.withoutMetrics === 0
  && paths.resumePdf.endsWith('AkashKaintura_Stripe_SrBEEng.pdf')
  && paths.coverPdf.endsWith('AkashKaintura_Stripe_SrBEEng_cover.pdf');

agentLog('verify-tailor-quality.mjs', 'verification result', {
  scoreBefore,
  scoreAfter: stats.atsContentScore,
  stats,
  repeatedVerbs: after.repeatedVerbs,
  withoutMetrics: after.withoutMetrics,
  resumePdf: paths.resumePdf,
  coverPdf: paths.coverPdf,
  ok,
}, 'verify');

console.log(JSON.stringify({ ok, scoreBefore, scoreAfter: stats.atsContentScore, paths }, null, 2));
process.exit(ok ? 0 : 1);
