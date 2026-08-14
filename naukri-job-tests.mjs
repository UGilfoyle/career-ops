#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  isNaukriUrl,
  stripNaukriChrome,
  looksLikeNaukriPollution,
  naukriManualJdHint,
  canonicalNaukriUrl,
} from './naukri-job.mjs';

const polluted = `## Job description
Roles and Responsibilities
Design Angular and Node.js apps. PostgreSQL. Docker/Kubernetes.

## About company
BMW Techworks India

## Similar jobs
### Senior Software Engineer: Python Full-stack
### Full Stack Next.Js & Nest JS Professional
`;

assert.equal(isNaukriUrl('https://www.naukri.com/job-listings-fullstack-software-developer-bmw-techworks-india-pune-7-to-10-years-120826019512'), true);
assert.equal(isNaukriUrl('https://www.indeed.com/viewjob?jk=abc'), false);

const clean = stripNaukriChrome(polluted);
assert.match(clean, /Angular and Node\.js/);
assert.doesNotMatch(clean, /Python Full-stack/);
assert.doesNotMatch(clean, /Nest JS/);
assert.equal(looksLikeNaukriPollution(polluted), true);
assert.equal(looksLikeNaukriPollution(clean), false);
assert.equal(
  looksLikeNaukriPollution('Angular Node.js\n\nSimilar jobs\nJava Spring opening'),
  true,
  'any leftover Similar jobs chrome is pollution, not only Python/Nest',
);

const hint = naukriManualJdHint('https://www.naukri.com/job-listings-foo?src=x');
assert.match(hint, /paste/i);
assert.match(canonicalNaukriUrl('https://www.naukri.com/job-listings-foo?src=x'), /job-listings-foo$/);

console.log('naukri-job tests: ok');
