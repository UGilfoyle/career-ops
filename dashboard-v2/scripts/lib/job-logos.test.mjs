import assert from 'node:assert/strict';
import {
  resolvePortalKey,
  portalFaviconUrl,
  pickCompanyLogoFromCandidates,
  resolveJobLogoFields,
  isGenericOgImage,
} from './job-logos.mjs';

assert.equal(resolvePortalKey('https://www.linkedin.com/jobs/view/123'), 'linkedin');
assert.equal(resolvePortalKey('https://www.hirist.com/j/abc'), 'hirist');
assert.equal(resolvePortalKey('https://jobs.workable.com/j/abc'), 'workable');
assert.equal(resolvePortalKey('https://boards.greenhouse.io/acme/jobs/1'), 'greenhouse');

assert.ok(portalFaviconUrl('linkedin')?.includes('linkedin.com'));
assert.ok(portalFaviconUrl('hirist')?.includes('hirist.com'));

assert.equal(isGenericOgImage('https://static.licdn.com/sc/h/logo-linkedin.png'), true);
assert.equal(isGenericOgImage('https://cdn.example.com/team-photo.jpg'), false);

const picked = pickCompanyLogoFromCandidates({
  jsonLd: 'https://cdn.example.com/logo.png',
  ogImage: 'https://static.licdn.com/sc/h/logo-linkedin.png',
});
assert.equal(picked?.source, 'json-ld');

const ogOnly = pickCompanyLogoFromCandidates({
  ogImage: 'https://cdn.example.com/og.jpg',
});
assert.equal(ogOnly?.source, 'og-image');

const scanFields = resolveJobLogoFields({
  url: 'https://www.hirist.com/j/backend-engineer',
  source: 'hirist',
});
assert.equal(scanFields.portal_key, 'hirist');
assert.equal(scanFields.logo_source, 'portal-favicon');
assert.ok(scanFields.logo_url?.includes('hirist.com'));

console.log('job-logos.test.mjs: all assertions passed');
