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
assert.equal(base, 'AkashKainturaStripeSrBEEng');

const paths = buildApplicationDocumentPaths({
  candidateName: name,
  company,
  roleTitle: 'Senior Backend Engineer',
});
assert.equal(paths.resumePdf, 'output/AkashKainturaStripeSrBEEng.pdf');
assert.equal(paths.coverPdf, 'output/AkashKainturaStripeSrBEEngcover.pdf');
assert.equal(paths.resumeHtml, 'output/AkashKainturaStripeSrBEEng.html');
assert.equal(paths.coverHtml, 'output/AkashKainturaStripeSrBEEngcover.html');

assert.equal(
  buildDownloadFilename({ candidateName: name, company, roleTitle: 'Senior Backend Engineer', kind: 'resume' }),
  'AkashKainturaStripeSrBEEng.pdf',
);
assert.equal(
  buildDownloadFilename({ candidateName: name, company, roleTitle: 'Senior Backend Engineer', kind: 'cover' }),
  'AkashKainturaStripeSrBEEngcover.pdf',
);

console.log('document-filename-tests: ok');
