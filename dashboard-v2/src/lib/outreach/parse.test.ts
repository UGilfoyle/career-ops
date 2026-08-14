import assert from 'node:assert/strict';
import {
  buildSearchLinks,
  extractEmails,
  fallbackDraft,
  githubOrgGuess,
  hostLooksLikeJobBoard,
  inferCompanyDomain,
  inferResearchRegion,
  isPublicHttpUrl,
  newsQueryForRegion,
  parseDraftJson,
  shouldUseSec,
} from './parse';

async function run() {
  assert.equal(isPublicHttpUrl('https://stepsecurity.com/about'), true);
  assert.equal(isPublicHttpUrl('http://127.0.0.1/secret'), false);
  assert.equal(isPublicHttpUrl('file:///etc/passwd'), false);
  assert.equal(hostLooksLikeJobBoard('www.wellfound.com'), true);
  assert.equal(hostLooksLikeJobBoard('boards.greenhouse.io'), true);
  assert.equal(hostLooksLikeJobBoard('stepsecurity.io'), false);

  assert.equal(
    inferCompanyDomain({ jobUrl: 'https://wellfound.com/jobs/4566107-software-engineer' }),
    null,
  );
  assert.equal(
    inferCompanyDomain({
      jobUrl: 'https://wellfound.com/jobs/1',
      homepage: 'https://www.stepsecurity.io/',
    }),
    'stepsecurity.io',
  );
  assert.equal(inferCompanyDomain({ jobUrl: 'https://careers.stripe.com/jobs/x' }), 'careers.stripe.com');

  assert.equal(githubOrgGuess('Step Security'), 'step-security');

  assert.deepEqual(
    extractEmails('Ping jobs@stepsecurity.io and noreply@foo.com', 'stepsecurity.io'),
    ['jobs@stepsecurity.io'],
  );

  const links = buildSearchLinks('StepSecurity', 'Software Engineer', 'india');
  assert.ok(links.some((l) => l.label.includes('LinkedIn')));
  assert.ok(links[0].url.includes('gl=in'));

  assert.equal(inferResearchRegion({ jdText: 'Remote India, Bengaluru hub' }), 'india');
  assert.equal(inferResearchRegion({ jdText: 'Office in Dubai, UAE' }), 'gcc');
  assert.equal(inferResearchRegion({ jdText: 'Based in Berlin, Germany' }), 'eu');
  assert.equal(inferResearchRegion({ jdText: 'San Francisco, United States' }), 'us');
  assert.equal(inferResearchRegion({ candidateCountry: 'India' }), 'india');
  assert.equal(inferResearchRegion({ jobUrl: 'https://company.co.in/jobs/1' }), 'india');
  assert.equal(shouldUseSec('india'), false);
  assert.equal(shouldUseSec('gcc'), false);
  assert.equal(shouldUseSec('eu'), false);
  assert.equal(shouldUseSec('us'), true);
  assert.ok(newsQueryForRegion('Acme', 'india').includes('India'));

  const parsed = parseDraftJson('```json\n{"subject":"Hi","body":"Hello team","hook_used":"CISA"}\n```');
  assert.equal(parsed?.subject, 'Hi');
  assert.equal(parsed?.hook_used, 'CISA');
  assert.equal(parseDraftJson('not json'), null);

  const fb = fallbackDraft({ company: 'Acme', role: 'Backend', candidateName: 'Akash' });
  assert.ok(fb.subject.includes('Acme'));
  assert.ok(fb.body.includes('Akash'));

  console.log('outreach.parse tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
