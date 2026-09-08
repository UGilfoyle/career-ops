#!/usr/bin/env node
// @ts-check
/**
 * Test suite for experience filter in scan.mjs.
 * Run: node test-experience-filter.mjs
 */

import { buildExperienceFilter } from './scan.mjs';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName}`);
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

section('Absent and empty configuration');
{
  const fNull = buildExperienceFilter(null);
  assert(fNull({ min: 1, max: 2 }), 'null filter passes jobs');
  assert(fNull(null), 'null filter passes null job');

  const fEmpty = buildExperienceFilter({});
  assert(fEmpty({ min: 1, max: 2 }), 'empty filter passes jobs');

  const fZeros = buildExperienceFilter({ min_years: 0, max_years: 0 });
  assert(fZeros({ min: 1, max: 20 }), 'filter with 0-0 passes jobs');
}

section('Malformed and invalid configuration');
{
  const fNegative = buildExperienceFilter({ min_years: -2, max_years: 5 });
  assert(fNegative({ min: 1, max: 2 }), 'negative min disables filter and passes');

  const fInvalid = buildExperienceFilter({ min_years: 'abc', max_years: 5 });
  assert(fInvalid({ min: 1, max: 2 }), 'NaN value disables filter and passes');

  const fInverted = buildExperienceFilter({ min_years: 10, max_years: 5 });
  assert(fInverted({ min: 1, max: 2 }), 'min > max disables filter and passes');
}

section('Conservative missing data handling');
{
  const f = buildExperienceFilter({ min_years: 4, max_years: 10 });
  assert(f(null), 'null job experience passes');
  assert(f(undefined), 'undefined job experience passes');
  assert(f({}), 'empty job experience object passes');
  assert(f({ min: null, max: null }), 'job with null bounds passes');
}

section('Bounded experience range (4 to 10 years)');
{
  const f = buildExperienceFilter({ min_years: 4, max_years: 10 });

  // Out of bounds: too junior
  assert(f({ min: 1, max: 3 }) === false, 'job 1-3 years rejected (too junior)');
  assert(f({ max: 3 }) === false, 'job max 3 years rejected (too junior)');
  assert(f(2) === false, 'job with scalar 2 years rejected (too junior)');

  // In bounds: overlap or within range
  assert(f({ min: 5, max: 8 }) === true, 'job 5-8 years passes');
  assert(f({ min: 3, max: 5 }) === true, 'job 3-5 years passes (overlaps at 4-5)');
  assert(f({ min: 8, max: 12 }) === true, 'job 8-12 years passes (overlaps at 8-10)');
  assert(f({ min: 4, max: 10 }) === true, 'exact bounds pass');
  assert(f({ min: 6 }) === true, 'job min 6 years passes');
  assert(f({ max: 8 }) === true, 'job max 8 years passes');
  assert(f(6) === true, 'job with scalar 6 years passes');

  // Out of bounds: too senior
  assert(f({ min: 12, max: 15 }) === false, 'job 12-15 years rejected (too senior)');
  assert(f({ min: 11 }) === false, 'job min 11 years rejected (too senior)');
  assert(f(14) === false, 'job with scalar 14 years rejected (too senior)');
}

section('Min-only filter (minimum 5 years, no upper bound)');
{
  const f = buildExperienceFilter({ min_years: 5, max_years: 0 });

  assert(f({ max: 3 }) === false, 'job max 3 years rejected');
  assert(f({ min: 2, max: 4 }) === false, 'job 2-4 years rejected');
  assert(f({ min: 5, max: 8 }) === true, 'job 5-8 years passes');
  assert(f({ min: 20, max: 25 }) === true, 'job 20-25 years passes');
}

section('Max-only filter (no minimum, maximum 6 years)');
{
  const f = buildExperienceFilter({ min_years: 0, max_years: 6 });

  assert(f({ min: 8 }) === false, 'job min 8 years rejected');
  assert(f({ min: 7, max: 10 }) === false, 'job 7-10 years rejected');
  assert(f({ min: 1, max: 3 }) === true, 'job 1-3 years passes');
  assert(f({ min: 4, max: 6 }) === true, 'job 4-6 years passes');
}

section('Alternative field keys (aliases)');
{
  // Using min / max instead of min_years / max_years in filter
  const fAlias = buildExperienceFilter({ min: 3, max: 7 });
  assert(fAlias({ min_years: 1, max_years: 2 }) === false, 'filter min/max alias rejects junior');
  assert(fAlias({ min_years: 4, max_years: 5 }) === true, 'filter min/max alias accepts match');
  assert(fAlias({ years: 5 }) === true, 'job years key passes');
  assert(fAlias({ years: 10 }) === false, 'job years key rejects senior');
}

console.log(`\n══════════════════════════════════════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
