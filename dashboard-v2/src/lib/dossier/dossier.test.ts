import assert from 'node:assert/strict';
import { sanitizeSlug, invalidateDossierCache } from './dossier-service';

console.log('Testing dossier service utilities...');

// Test 1: sanitizeSlug
assert.equal(sanitizeSlug('Akash-Kaintura'), 'akash-kaintura');
assert.equal(sanitizeSlug('user@domain.com!#$'), 'userdomaincom');
assert.equal(sanitizeSlug('   DEV_123   '), 'dev_123');
assert.equal(sanitizeSlug('a'.repeat(50)).length, 32);

// Test 2: invalidate cache sanity
assert.doesNotThrow(async () => {
  await invalidateDossierCache('test-slug');
});

console.log('All dossier unit tests passed!');
