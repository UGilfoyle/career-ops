import assert from 'node:assert/strict';
import { buildEngagementFollowup } from './followup.ts';

const strong = buildEngagementFollowup({
  company: 'Stripe',
  role: 'Staff Backend',
  viewCount: 2,
  clickCount: 2,
  dwellSec: 120,
  clicksGh: 1,
  clicksLi: 0,
  lastEngagedAt: new Date(),
  appliedAt: new Date(Date.now() - 3 * 24 * 3600_000),
});
assert.equal(strong.priority, 'now');
assert.match(strong.subject, /Staff Backend/);
assert.match(strong.hook, /GitHub/);

const fresh = buildEngagementFollowup({
  company: 'Uber',
  role: 'Senior FE',
  viewCount: 1,
  clickCount: 0,
  dwellSec: 20,
  clicksGh: 0,
  clicksLi: 0,
  lastEngagedAt: new Date(),
  appliedAt: new Date(),
});
assert.equal(fresh.priority, 'wait');
assert.ok(fresh.suggested_wait_hours >= 2);

console.log('followup unit checks passed');
