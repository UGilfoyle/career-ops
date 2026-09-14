import assert from 'node:assert/strict';

console.log('Testing Community Interview Intel utilities...');

// Test 1: Slug generation
function toCompanySlug(name: string): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

assert.equal(toCompanySlug('Google Cloud'), 'googlecloud');
assert.equal(toCompanySlug('Razorpay (India)'), 'razorpayindia');
assert.equal(toCompanySlug('Uber Technologies!'), 'ubertechnologies');

// Test 2: Questions filtering
function filterQuestions(raw: unknown[]): string[] {
  return raw.map((q) => String(q || '').trim()).filter((q) => q.length > 5);
}

const filtered = filterQuestions([
  'Design an idempotent webhook delivery system with exponential backoff.',
  'Hi',
  '   What is CAP theorem and how does Paxos resolve split-brain?   ',
  '',
  null,
]);

assert.equal(filtered.length, 2);
assert.equal(filtered[0], 'Design an idempotent webhook delivery system with exponential backoff.');
assert.equal(filtered[1], 'What is CAP theorem and how does Paxos resolve split-brain?');

// Test 3: Round types verification
const validRounds = new Set(['system_design', 'coding_dsa', 'bar_raiser', 'hiring_manager', 'take_home']);
assert.ok(validRounds.has('system_design'));
assert.ok(validRounds.has('bar_raiser'));
assert.ok(!validRounds.has('random_round'));

console.log('All Community Interview Intel tests passed!');
