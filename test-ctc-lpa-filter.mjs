#!/usr/bin/env node
// @ts-check
/**
 * Test suite for Indian CTC/LPA parsing and normalization in scan.mjs.
 * Run: node test-ctc-lpa-filter.mjs
 */

import {
  normalizeCurrency,
  parseSalaryNumber,
  parseSalaryString,
  buildSalaryFilter,
} from './scan.mjs';

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

section('Currency Normalization');
{
  assert(normalizeCurrency('INR') === 'INR', 'INR -> INR');
  assert(normalizeCurrency('₹') === 'INR', '₹ -> INR');
  assert(normalizeCurrency('Rs.') === 'INR', 'Rs. -> INR');
  assert(normalizeCurrency('USD') === 'USD', 'USD -> USD');
  assert(normalizeCurrency('$') === 'USD', '$ -> USD');
  assert(normalizeCurrency('EUR') === 'EUR', 'EUR -> EUR');
  assert(normalizeCurrency('€') === 'EUR', '€ -> EUR');
  assert(normalizeCurrency('GBP') === 'GBP', 'GBP -> GBP');
  assert(normalizeCurrency('£') === 'GBP', '£ -> GBP');
}

section('Indian LPA and Salary Number Parsing');
{
  assert(parseSalaryNumber('30 LPA') === 3000000, '30 LPA -> 3,000,000');
  assert(parseSalaryNumber('25.5 LPA') === 2550000, '25.5 LPA -> 2,550,000');
  assert(parseSalaryNumber('35 Lacs') === 3500000, '35 Lacs -> 3,500,000');
  assert(parseSalaryNumber('40 Lakhs') === 4000000, '40 Lakhs -> 4,000,000');
  assert(parseSalaryNumber('30L') === 3000000, '30L -> 3,000,000');
  assert(parseSalaryNumber('150k') === 150000, '150k -> 150,000');
  assert(parseSalaryNumber('₹30,00,000') === 3000000, '₹30,00,000 -> 3,000,000');
  assert(parseSalaryNumber(3500000) === 3500000, 'Numeric 3,500,000 preserved');
}

section('Freeform Salary String Extraction');
{
  const r1 = parseSalaryString('₹ 25 - 40 LPA');
  assert(r1?.min === 2500000 && r1?.max === 4000000 && r1?.currency === 'INR', '₹ 25 - 40 LPA parsed');

  const r2 = parseSalaryString('20 to 35 Lacs P.A.');
  assert(r2?.min === 2000000 && r2?.max === 3500000 && r2?.currency === 'INR', '20 to 35 Lacs parsed');

  const r3 = parseSalaryString('35 LPA');
  assert(r3?.min === 3500000 && r3?.max === 3500000 && r3?.currency === 'INR', '35 LPA parsed');

  const r4 = parseSalaryString('$120k - $160k');
  assert(r4?.min === 120000 && r4?.max === 160000 && r4?.currency === 'USD', '$120k - $160k parsed');

  const r5 = parseSalaryString('₹25,00,000 - ₹40,00,000');
  assert(r5?.min === 2500000 && r5?.max === 4000000 && r5?.currency === 'INR', '₹25,00,000 - ₹40,00,000 parsed');
}

section('CTC Filter Behavior with LPA Input');
{
  const filter = buildSalaryFilter({
    min: '30 LPA',
    max: '50 LPA',
    currency: 'INR',
  });

  // Out of range: underpaid (e.g. 15-25 LPA)
  assert(filter('15 - 25 LPA') === false, '15 - 25 LPA rejected (under candidate minimum)');
  assert(filter({ min: 1800000, max: 2800000, currency: 'INR' }) === false, '18-28L INR rejected');

  // In range: overlap
  assert(filter('35 - 45 LPA') === true, '35 - 45 LPA passes (in range)');
  assert(filter('25 - 35 LPA') === true, '25 - 35 LPA passes (overlaps 30-35)');
  assert(filter('₹ 40 LPA') === true, '40 LPA passes');
  assert(filter({ min: 3200000, max: 4800000, currency: 'INR' }) === true, 'Structured 32-48L passes');

  // Currency mismatch: USD job against INR filter
  assert(filter('$150,000 - $180,000') === false, 'USD salary rejected on currency mismatch');

  // Conservative pass: missing salary
  assert(filter(null) === true, 'null salary passes');
  assert(filter('') === true, 'empty salary passes');
}

section('Western USD Filter backward compatibility');
{
  const usdFilter = buildSalaryFilter({
    min: 100000,
    max: 180000,
    currency: 'USD',
  });

  assert(usdFilter('$120k - $160k') === true, 'USD range passes');
  assert(usdFilter('$80k - $95k') === false, 'USD underpaid rejected');
  assert(usdFilter('30 LPA') === false, 'INR LPA rejected on USD filter');
}

console.log(`\n══════════════════════════════════════════════════════════════════════`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
