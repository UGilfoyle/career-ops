#!/usr/bin/env node

import {
  hydrateResumeProfile,
  normalizeResumeContext,
} from './profile-hydrate.mjs';

let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
  } else {
    console.error(`  ❌ ${message}`);
    failed += 1;
  }
}

const complete = {
  narrative: { headline: 'Senior Engineer', superpowers: ['Node.js'] },
  experience: [
    { company: 'Example', role: 'Engineer', bullets: ['Built production APIs.'] },
  ],
  education: [
    { school: 'Example University', degree: 'B.Tech', period: '2014–2018' },
  ],
};

const fromString = normalizeResumeContext(JSON.stringify(complete));
assert(
  fromString.experience?.length === 1,
  'parses JSON-string resume_context from database',
);

const fromDoubleString = normalizeResumeContext(JSON.stringify(JSON.stringify(complete)));
assert(
  fromDoubleString.education?.length === 1,
  'parses double-serialized resume_context',
);

const fromNested = normalizeResumeContext({
  resume_context: JSON.stringify({
    ...complete,
    github_settings: { repo: 'example/career-ops' },
    search: { portals: ['linkedin'] },
  }),
});
assert(
  fromNested.narrative?.headline === 'Senior Engineer',
  'unwraps nested resume_context payload',
);
assert(
  fromNested.github_settings?.repo === 'example/career-ops'
    && fromNested.search?.portals?.[0] === 'linkedin',
  'preserves non-resume settings while unwrapping nested profile',
);

const hydrated = hydrateResumeProfile(JSON.stringify(complete)).profile;
assert(
  hydrated.experience?.length === 1 && hydrated.education?.length === 1,
  'hydration preserves complete serialized profile data',
);

assert(
  Object.keys(normalizeResumeContext('{bad-json')).length === 0,
  'malformed serialized profile normalizes safely to empty object',
);

const missingName = hydrateResumeProfile({
  experience: [
    { company: 'Quest Global', role: 'Senior Software Engineer', bullets: ['Built APIs.'] },
  ],
  education: [{ school: 'UU', degree: 'MCA', period: '2016 – 2018' }],
  candidate: { full_name: '' },
}).profile;
assert(
  /Akash/i.test(String(missingName.candidate?.full_name || '')),
  'hydration fills empty full_name from profile.yml or cv.md',
);

const partialExp = hydrateResumeProfile({
  experience: [
    { company: 'Quest Global Engineering Services', role: 'Senior Software Engineer', bullets: ['Built APIs.'] },
  ],
  education: [{ school: 'Uttaranchal University', degree: 'MCA', period: '2016 – 2018' }],
  candidate: { full_name: 'Akash Kaintura' },
}).profile;
assert(
  (partialExp.experience || []).some((j) => /Rubico/i.test(String(j.company || ''))),
  'hydration merges missing Rubico experience from yaml/cv without wiping existing roles',
);

if (failed > 0) {
  console.error(`profile-hydrate tests: ${failed} failed`);
  process.exit(1);
}

console.log('profile-hydrate tests: all passed');
