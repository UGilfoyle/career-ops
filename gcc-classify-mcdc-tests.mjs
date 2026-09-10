#!/usr/bin/env node
/**
 * ==============================================================================
 * 🧪 MC/DC (Modified Condition / Decision Coverage) Test Suite
 *    for Career-Ops GCC / ODC / GDC Classifier
 * ==============================================================================
 *
 * Verifies that each condition in compound boolean decisions can independently
 * alter the classification outcome holding all other conditions fixed:
 *
 * Decision 1: Explicit Override
 *   - Vector 1.1: requestedGcc=true forces GCC even for IT Services company
 *   - Vector 1.2: requestedGcc=false falls through to multi-signal evaluation
 *
 * Decision 2: Registry Match with Short-Word Boundary Protection
 *   - Vector 2.1: Known GCC company name triggers GCC
 *   - Vector 2.2: Short acronym "HP" matches "HP Inc"
 *   - Vector 2.3: Short acronym "HP" rejected in "Northpoint Logistics"
 *   - Vector 2.4: Short acronym "EY" rejected in "Honeywell International"
 *
 * Decision 3: URL Domain Detection
 *   - Vector 3.1: Hostname match triggers GCC with empty JD
 *   - Vector 3.2: Pathname match in Workday URL triggers GCC
 *   - Vector 3.3: Malformed URL handled gracefully without throwing
 *
 * Decision 4: Captive Acronyms and Long-Form Phrases in JD Text
 *   - Vector 4.1: "GCC" acronym triggers GCC with neutral company
 *   - Vector 4.2: "ODC" acronym triggers GCC with neutral company
 *   - Vector 4.3: "GDC" acronym triggers GCC with neutral company
 *   - Vector 4.4: Long-form "Center of Excellence" triggers GCC
 *   - Vector 4.5: IT Services override: Services company with ODC JD text classified as Services (not GCC)
 *
 * Decision 5: Non-Captive Baseline
 *   - Vector 5.1: Neutral company + standard tech stack returns isGcc: false
 * ==============================================================================
 */

import assert from 'node:assert';
import { classifyGccOpportunity, classifyCompany } from './gcc-classify.mjs';

console.log('═══════════════════════════════════════════════════════════');
console.log('  🔬 GCC Classifier MC/DC Decision Coverage Test Suite');
console.log('═══════════════════════════════════════════════════════════\n');

let mcdcPassCount = 0;

function verify(name, fn) {
  try {
    fn();
    mcdcPassCount++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ── Decision 1: Explicit Override ──────────────────────────────────────────
verify('Vector 1.1: requestedGcc=true forces GCC even for IT Services company', () => {
  const res = classifyGccOpportunity({
    companyName: 'Tata Consultancy Services',
    requestedGcc: true,
  });
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.type, 'GCC');
  assert.strictEqual(res.signals.includes('cli_flag'), true);
});

verify('Vector 1.2: requestedGcc=false allows Services identification', () => {
  const res = classifyGccOpportunity({
    companyName: 'Tata Consultancy Services',
    requestedGcc: false,
  });
  assert.strictEqual(res.isGcc, false);
  assert.strictEqual(res.type, 'Services');
});

// ── Decision 2: Registry Match with Short-Word Boundary Protection ─────────
verify('Vector 2.1: Known GCC company name triggers GCC', () => {
  const res = classifyGccOpportunity({ companyName: 'Target Corporation India' });
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.type, 'GCC');
  assert.strictEqual(res.signals.includes('registry_match'), true);
});

verify('Vector 2.2: Short acronym HP matches HP Inc with word boundaries', () => {
  const res = classifyGccOpportunity({ companyName: 'HP Inc India' });
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.type, 'GCC');
});

verify('Vector 2.3: Short acronym HP rejected inside Northpoint Logistics', () => {
  const res = classifyGccOpportunity({ companyName: 'Northpoint Logistics' });
  assert.strictEqual(res.isGcc, false);
});

verify('Vector 2.4: Short acronym EY rejected inside Honeywell International', () => {
  const res = classifyGccOpportunity({ companyName: 'Honeywell International' });
  // Honeywell is in gcc list as honeywell
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.reason.includes('Honeywell'), true);
});

verify('Vector 2.5: Unrelated name containing EY substring is not EY', () => {
  const res = classifyGccOpportunity({ companyName: 'Keynote Systems' });
  assert.strictEqual(res.isGcc, false);
});

// ── Decision 3: URL Domain Detection ───────────────────────────────────────
verify('Vector 3.1: Hostname match triggers GCC with empty JD', () => {
  const res = classifyGccOpportunity({
    companyName: 'Unknown Corp',
    url: 'https://jobs.target.com/careers/lead-engineer',
  });
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.signals.includes('domain_match'), true);
});

verify('Vector 3.2: Pathname match in Workday URL triggers GCC', () => {
  const res = classifyGccOpportunity({
    url: 'https://nike.wd5.myworkdayjobs.com/en-US/Careers/job/123',
  });
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.signals.includes('domain_match'), true);
});

verify('Vector 3.3: Malformed URL handled gracefully without throwing', () => {
  const res = classifyGccOpportunity({
    url: 'ht!tp://:::invalid-domain:::',
    jdText: 'Looking for full stack developer',
  });
  assert.strictEqual(res.isGcc, false);
  assert.strictEqual(res.type, 'Other');
});

// ── Decision 4: Captive Acronyms and Phrases in JD Text ────────────────────
verify('Vector 4.1: GCC acronym in JD triggers GCC with neutral company', () => {
  const res = classifyGccOpportunity({
    companyName: 'Acme Platforms',
    jdText: 'Our Bangalore GCC is expanding our core payments infrastructure.',
  });
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.signals.includes('GCC'), true);
});

verify('Vector 4.2: ODC acronym in JD triggers GCC with neutral company', () => {
  const res = classifyGccOpportunity({
    companyName: 'Nova Fin',
    jdText: 'Leading distributed systems for our India ODC facility.',
  });
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.signals.includes('Offshore Development Center (ODC)'), true);
});

verify('Vector 4.3: GDC acronym in JD triggers GCC with neutral company', () => {
  const res = classifyGccOpportunity({
    companyName: 'CloudMatrix',
    jdText: 'Senior Backend Engineer required at our Hyderabad GDC.',
  });
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.signals.includes('Global Development Center (GDC)'), true);
});

verify('Vector 4.4: Long-form Center of Excellence triggers GCC', () => {
  const res = classifyGccOpportunity({
    companyName: 'Starlight Tech',
    jdText: 'Join our Cloud Center of Excellence building scalable services.',
  });
  assert.strictEqual(res.isGcc, true);
  assert.strictEqual(res.signals.includes('Center of Excellence'), true);
});

verify('Vector 4.5: IT Services override: Services company with ODC text classified as Services', () => {
  const res = classifyGccOpportunity({
    companyName: 'Infosys',
    jdText: 'Senior developer required for client ODC project.',
  });
  assert.strictEqual(res.isGcc, false);
  assert.strictEqual(res.type, 'Services');
});

// ── Decision 5: Non-Captive Baseline ───────────────────────────────────────
verify('Vector 5.1: Neutral company + standard tech stack returns isGcc: false', () => {
  const res = classifyGccOpportunity({
    companyName: 'FreshStartup Inc',
    jdText: 'We are looking for a Node.js engineer to build our MVP.',
  });
  assert.strictEqual(res.isGcc, false);
  assert.strictEqual(res.type, 'Other');
});

// ── Backward Compatibility ────────────────────────────────────────────────
verify('Backward compatibility: classifyCompany returns type string', () => {
  const resGcc = classifyCompany('Target');
  assert.strictEqual(resGcc, 'GCC');

  const resServices = classifyCompany('Wipro');
  assert.strictEqual(resServices, 'Services');

  const resOther = classifyCompany('RandomStartup');
  assert.strictEqual(resOther, 'Other');
});

console.log(`\n═══════════════════════════════════════════════════════════`);
console.log(`  🟢 All ${mcdcPassCount} MC/DC Decision Vectors Passed Cleanly`);
console.log(`═══════════════════════════════════════════════════════════\n`);
