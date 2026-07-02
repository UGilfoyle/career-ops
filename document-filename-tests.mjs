import assert from 'node:assert/strict';
import {
  buildApplicationDocumentBasename,
  buildApplicationDocumentPaths,
  buildDownloadFilename,
  shortenRoleTitle,
} from './document-filename.mjs';

const name = 'Akash Kaintura';
const company = 'Stripe';

assert.equal(shortenRoleTitle('Senior Backend Engineer'), 'SrBEEng');
assert.equal(shortenRoleTitle('Staff Engineer'), 'StaffEng');
assert.equal(shortenRoleTitle('Senior Software Engineer'), 'SrSWEng');

const base = buildApplicationDocumentBasename({
  candidateName: name,
  company,
  roleTitle: 'Senior Backend Engineer',
});
assert.equal(base, 'AkashKaintura_Stripe_SrBEEng');

const paths = buildApplicationDocumentPaths({
  candidateName: name,
  company,
  roleTitle: 'Senior Backend Engineer',
});
assert.equal(paths.resumePdf, 'output/AkashKaintura_Stripe_SrBEEng.pdf');
assert.equal(paths.coverPdf, 'output/AkashKaintura_Stripe_SrBEEng_cover.pdf');
assert.equal(paths.resumeHtml, 'output/AkashKaintura_Stripe_SrBEEng.html');
assert.equal(paths.coverHtml, 'output/AkashKaintura_Stripe_SrBEEng_cover.html');

assert.equal(
  buildDownloadFilename({ candidateName: name, company, roleTitle: 'Senior Backend Engineer', kind: 'resume' }),
  'AkashKaintura_Stripe_SrBEEng.pdf',
);
assert.equal(
  buildDownloadFilename({ candidateName: name, company, roleTitle: 'Senior Backend Engineer', kind: 'cover' }),
  'AkashKaintura_Stripe_SrBEEng_cover.pdf',
);

console.log('document-filename-tests: ok');
