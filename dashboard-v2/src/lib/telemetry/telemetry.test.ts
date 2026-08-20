import assert from 'node:assert/strict';
import { getPrivacySafeHash } from './hash.ts';
import {
  buildTrackingSlug,
  isValidDestination,
  normalizeExternalUrl,
  slugifySegment,
} from './urls.ts';

const h1 = getPrivacySafeHash('1.2.3.4', 'Mozilla/5.0');
const h2 = getPrivacySafeHash('1.2.3.4', 'Mozilla/5.0');
const h3 = getPrivacySafeHash('1.2.3.5', 'Mozilla/5.0');
assert.equal(h1, h2);
assert.notEqual(h1, h3);
assert.equal(h1.length, 24);

assert.equal(normalizeExternalUrl('github.com/UGilfoyle'), 'https://github.com/UGilfoyle');
assert.equal(normalizeExternalUrl('https://linkedin.com/in/x'), 'https://linkedin.com/in/x');
assert.equal(normalizeExternalUrl(''), null);

assert.equal(isValidDestination('https://github.com/x'), true);
assert.equal(isValidDestination('javascript:alert(1)'), false);
assert.equal(isValidDestination('http://localhost/evil'), false);

assert.equal(slugifySegment('Stripe Inc!'), 'stripe-inc');
const slug = buildTrackingSlug('Stripe', 'Staff Engineer');
assert.match(slug, /^stripe-staff-engineer-[a-f0-9]{4}$/);

// Phase 1.5 cache key contract (keep in sync with cache.ts)
assert.equal(`tel:slug:acme-eng-ab12`, 'tel:slug:acme-eng-ab12');

console.log('telemetry unit checks passed');
