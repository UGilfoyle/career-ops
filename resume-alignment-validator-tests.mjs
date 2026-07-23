#!/usr/bin/env node

import { scoreCandidate } from './resume-alignment-validator.mjs';

let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
  } else {
    console.error(`  ❌ ${message}`);
    failed += 1;
  }
}

const profile = {
  narrative: { headline: '', exit_story: '', superpowers: [] },
  experience: [
    {
      role: 'Senior Software Engineer',
      company: 'Example',
      bullets: [
        'Built Node.js RESTful APIs and reduced latency by 30%.',
      ],
    },
  ],
};

const baseResume = {
  summary: 'Senior engineer delivering LLM services and production testing.',
  core_competencies: ['Node.js', 'RESTful API'],
  experience: {
    0: ['Built Node.js RESTful APIs and reduced latency by 30%.'],
  },
};

const fitWithNoisyGaps = {
  honest: ['Node.js', 'RESTful API'],
  gaps: ['LLM', 'Testing', 'TypeScript'],
};

const canonicalCorpus = [
  'Senior engineer delivering LLM services.',
  'Built Node.js RESTful APIs and reduced latency by 30%.',
].join('\n');

const falsePositiveCheck = scoreCandidate(
  baseResume,
  'Build Node.js RESTful APIs with LLM testing and TypeScript.',
  profile,
  fitWithNoisyGaps,
  canonicalCorpus,
);

assert(
  falsePositiveCheck.unsupported.length === 0,
  'canonical LLM evidence and generic Testing do not trigger unsupported-claim failures',
);

const fabricatedResume = {
  ...baseResume,
  core_competencies: [...baseResume.core_competencies, 'Docker'],
};
const hardSkillCheck = scoreCandidate(
  fabricatedResume,
  'Build Node.js APIs using Docker.',
  profile,
  { honest: ['Node.js'], gaps: ['Docker', 'Testing'] },
  canonicalCorpus,
);

assert(
  hardSkillCheck.unsupported.some((item) => item.term === 'Docker'),
  'new unsupported hard technology still blocks the candidate',
);
assert(
  !hardSkillCheck.unsupported.some((item) => item.term === 'Testing'),
  'generic responsibility words are never treated as hard technologies',
);

if (failed > 0) {
  console.error(`resume-alignment-validator tests: ${failed} failed`);
  process.exit(1);
}

console.log('resume-alignment-validator tests: all passed');
