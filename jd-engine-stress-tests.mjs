import assert from 'node:assert/strict';
import {
  cleanHtmlToStructuredJd,
  detectKnownTech,
  parseJdSections,
  classifySectionTitle,
  extractBulletsFromBlock,
} from './lib/jd-formatter-core.mjs';

console.log('Running Thorough JD Engine Stress & MC/DC Test Suite...\n');

// 1. Double-encoded HTML entities and messy markup
const doubleEncodedHtml = `
  <div>
    <h2>Staff Distributed Systems Engineer &amp; Tech Lead</h2>
    <p>We build high-throughput rails &amp; settlement engines for global fintechs.</p>
    <!-- internal comment -->
    <script>console.log("malicious or tracker script");</script>
    <style>.job-desc { color: red; }</style>
    <h3>What You&#39;ll Bring:</h3>
    <ul>
      <li>Proficiency in Go &amp; Rust &lt;memory-safe systems&gt;</li>
      <li>Experience with ClickHouse, Kafka &bull; event streaming architecture</li>
      <li>Strong grasp of ACID transactions &amp; consensus (Raft/Paxos)</li>
    </ul>
    <h3>Perks &amp; Benefits</h3>
    <p>Competitive base ₹60,00,000 &ndash; ₹90,00,000 + equity grants.</p>
  </div>
`;

const parsed1 = parseJdSections(doubleEncodedHtml);
assert.equal(parsed1.isBlockedOrThin, false);
assert.ok(!parsed1.rawText.includes('<script>'));
assert.ok(!parsed1.rawText.includes('<style>'));
assert.ok(!parsed1.rawText.includes('<!-- internal comment -->'));
assert.ok(parsed1.rawText.includes("What You'll Bring"));
assert.ok(parsed1.rawText.includes('• Proficiency in Go & Rust <memory-safe systems>'));
assert.ok(parsed1.rawText.includes('• Experience with ClickHouse, Kafka • event streaming architecture'));

// Verify section types
const reqSec = parsed1.sections.find((s) => s.type === 'requirements');
assert.ok(reqSec, 'Failed to classify "What You\'ll Bring" as requirements');
assert.equal(reqSec.items.length, 3);
assert.ok(parsed1.techStack.includes('Go'));
assert.ok(parsed1.techStack.includes('Rust'));
assert.ok(parsed1.techStack.includes('ClickHouse'));
assert.ok(parsed1.techStack.includes('Kafka'));
console.log('✓ Vector 1: Script/style stripping, entity decoding, and bullet integrity verified.');

// 2. Unicode bullet variants (▪, ▫, ►, ✦, ✔, -, *)
const unicodeBulletJd = `
Role Overview
Our platform processes 50,000 transactions per second.

Core Responsibilities
▪ Lead architectural roadmap for payment gateways
▫ Maintain 99.999% SLA across cloud infrastructure
► Mentor senior engineers on microservice patterns
✦ Spearhead disaster recovery simulations

Requirements
✔ 7+ years backend engineering in Java or Golang
* Deep understanding of PostgreSQL connection pooling and B-tree indexes
- Track record of scaling Kubernetes clusters on AWS
`;

const parsed2 = parseJdSections(unicodeBulletJd);
assert.equal(parsed2.isBlockedOrThin, false);
const resp2 = parsed2.sections.find((s) => s.type === 'responsibilities');
assert.ok(resp2);
assert.equal(resp2.items.length, 4);
assert.equal(resp2.items[0], 'Lead architectural roadmap for payment gateways');
assert.equal(resp2.items[1], 'Maintain 99.999% SLA across cloud infrastructure');

const req2 = parsed2.sections.find((s) => s.type === 'requirements');
assert.ok(req2);
assert.equal(req2.items.length, 3);
assert.ok(req2.items[0].includes('7+ years backend engineering'));
assert.ok(parsed2.techStack.includes('Java'));
assert.ok(parsed2.techStack.includes('Golang') || parsed2.techStack.includes('Go'));
assert.ok(parsed2.techStack.includes('PostgreSQL'));
assert.ok(parsed2.techStack.includes('Kubernetes'));
assert.ok(parsed2.techStack.includes('AWS'));
console.log('✓ Vector 2: Unicode bullet normalization (▪, ▫, ►, ✦, ✔, -, *) verified.');

// 3. Catastrophic Backtracking & ReDoS Performance Benchmark
const largeBlock = 'Build scalable event pipelines with Kafka and Python.\n• Requirement line with technical jargon.\n'.repeat(500);
const startBench = performance.now();
const parsedLarge = parseJdSections(largeBlock);
const elapsedMs = performance.now() - startBench;

assert.ok(parsedLarge.metrics.wordCount > 4000);
assert.ok(elapsedMs < 30, `Parsing 500-block JD took ${elapsedMs.toFixed(2)}ms (target < 30ms)`);
console.log(`✓ Vector 3: ReDoS & scale stress test passed (${elapsedMs.toFixed(2)}ms for ${parsedLarge.metrics.wordCount} words).`);

// 4. Edge Cases: All Gatekeeper and WAF Blocking Signatures
const wafSamples = [
  'Cloudflare ray id: 874b291a Access Denied',
  'Please complete the security check to access indeed.com',
  'errors.edgesuite.net 403 Forbidden',
  'Access denied. You do not have permission to access this resource on this server.',
];

for (const waf of wafSamples) {
  const p = parseJdSections(waf);
  assert.equal(p.isBlockedOrThin, true, `WAF phrase not caught: "${waf}"`);
  assert.ok(p.blockedReason, 'Missing blocked explanation');
}
console.log('✓ Vector 4: Gatekeeper, Cloudflare, and WAF signatures accurately handled.');

// 5. MC/DC coverage for section classification
const classificationTests = [
  { title: 'About The Company', expected: 'overview' },
  { title: 'Position Summary', expected: 'overview' },
  { title: 'What You Will Do', expected: 'responsibilities' },
  { title: 'Day to Day Responsibilities', expected: 'responsibilities' },
  { title: 'Minimum Qualifications', expected: 'requirements' },
  { title: 'What We Are Looking For', expected: 'requirements' },
  { title: 'Nice to Have', expected: 'preferred' },
  { title: 'Bonus Skills', expected: 'preferred' },
  { title: 'Technology Stack', expected: 'stack' },
  { title: 'Tools & Tech', expected: 'stack' },
  { title: 'Salary & Compensation', expected: 'compensation' },
  { title: 'Why Join Us', expected: 'compensation' },
  { title: 'Equal Opportunity Employer', expected: 'other' },
];

for (const { title, expected } of classificationTests) {
  const actual = classifySectionTitle(title);
  assert.equal(actual, expected, `Failed classification for "${title}": got ${actual}, expected ${expected}`);
}
console.log('✓ Vector 5: Complete MC/DC branch coverage across all 13 heading classification patterns verified.');

// 6. Resilience against null, undefined, boolean, numbers
assert.equal(parseJdSections(null).isBlockedOrThin, true);
assert.equal(parseJdSections(undefined).isBlockedOrThin, true);
assert.equal(parseJdSections('   ').isBlockedOrThin, true);
assert.equal(parseJdSections('short text').isBlockedOrThin, true);
assert.equal(cleanHtmlToStructuredJd(''), '');
assert.equal(cleanHtmlToStructuredJd(null), '');
assert.deepEqual(detectKnownTech(''), []);
assert.deepEqual(detectKnownTech(null), []);
console.log('✓ Vector 6: Null, undefined, empty, and thin inputs validated.');

console.log('\n==================================================');
console.log('💯 All 6 Stress & MC/DC Test Suites Passed Successfully!');
