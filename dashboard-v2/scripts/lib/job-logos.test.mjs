import assert from 'node:assert/strict';
import {
  resolvePortalKey,
  portalFaviconUrl,
  pickCompanyLogoFromCandidates,
  resolveJobLogoFields,
  isGenericOgImage,
  inferCompanyDomain,
  inferCompanyLogoUrls,
} from './job-logos.mjs';

assert.equal(resolvePortalKey('https://www.linkedin.com/jobs/view/123'), 'linkedin');
assert.equal(resolvePortalKey('https://www.hirist.com/j/abc'), 'hirist');
assert.equal(resolvePortalKey('https://boards.greenhouse.io/acme/jobs/1'), 'greenhouse');

assert.ok(portalFaviconUrl('linkedin')?.includes('linkedin.com'));

assert.equal(isGenericOgImage('https://static.licdn.com/sc/h/logo-linkedin.png'), true);
assert.equal(isGenericOgImage('https://cdn.example.com/team-photo.jpg'), false);

const picked = pickCompanyLogoFromCandidates({
  jsonLd: 'https://cdn.example.com/logo.png',
  ogImage: 'https://static.licdn.com/sc/h/logo-linkedin.png',
});
assert.equal(picked?.source, 'json-ld');

assert.equal(inferCompanyDomain('Deloitte', 'https://www.linkedin.com/jobs/1'), 'deloitte.com');
assert.equal(inferCompanyDomain('PwC India', null), 'pwc.com');
assert.equal(inferCompanyDomain('Caterpillar', null), 'caterpillar.com');
assert.equal(inferCompanyDomain('Addepar', 'https://www.linkedin.com/jobs/1'), 'addepar.com');

const addeparLogo = inferCompanyLogoUrls('Addepar', 'https://linkedin.com/jobs/1');
assert.ok(addeparLogo.primary?.includes('clearbit.com'));
assert.ok(addeparLogo.fallback?.includes('addepar.com'));

const linkedInJob = resolveJobLogoFields({
  url: 'https://www.linkedin.com/jobs/view/123',
  source: 'linkedin',
  company: 'Deloitte',
});
assert.equal(linkedInJob.portal_key, 'linkedin');
assert.equal(linkedInJob.logo_source, 'company-clearbit');
assert.ok(linkedInJob.logo_url?.includes('deloitte.com'));

const scanFields = resolveJobLogoFields({
  url: 'https://www.hirist.com/j/backend-engineer',
  source: 'hirist',
  company: 'Unknown Startup XYZ',
});
assert.equal(scanFields.portal_key, 'hirist');
assert.ok(scanFields.logo_url);

console.log('job-logos.test.mjs: all assertions passed');
