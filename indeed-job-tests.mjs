#!/usr/bin/env node
/**
 * indeed-job-tests.mjs — unit tests for Indeed URL parse + _initialData extraction
 */

import assert from 'assert';
import {
  isIndeedUrl,
  extractIndeedJobKey,
  canonicalIndeedUrl,
  parseIndeedInitialData,
  jobFromIndeedInitialData,
  htmlToPlainText,
  fetchIndeedJob,
  extractBalancedJson,
  looksLikeUsableJd,
  indeedManualJdHint,
  IndeedFetchError,
} from './indeed-job.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

console.log('\nindeed-job tests\n');

test('detects Indeed hosts', () => {
  assert.ok(isIndeedUrl('https://in.indeed.com/viewjob?jk=abcdef0123456789'));
  assert.ok(isIndeedUrl('https://www.indeed.com/rc/clk?jk=abcdef0123456789&bb=x'));
  assert.ok(!isIndeedUrl('https://linkedin.com/jobs/view/123'));
});

test('extracts jk from viewjob / rc/clk / fromjk', () => {
  assert.strictEqual(
    extractIndeedJobKey('https://in.indeed.com/viewjob?jk=44f9305d780a77e8&from=share'),
    '44f9305d780a77e8'
  );
  assert.strictEqual(
    extractIndeedJobKey('https://www.indeed.com/rc/clk?jk=AABBCCDDEEFF0011&bb=tracking'),
    'aabbccddeeff0011'
  );
  assert.strictEqual(
    extractIndeedJobKey('https://www.indeed.com/pagead/clk?fromjk=44f9305d780a77e8&xkcb=1'),
    '44f9305d780a77e8'
  );
  assert.strictEqual(extractIndeedJobKey('https://example.com/job'), null);
});

test('canonicalizes to clean viewjob URL', () => {
  assert.strictEqual(
    canonicalIndeedUrl('https://in.indeed.com/rc/clk?jk=44f9305d780a77e8&bb=noise&from=serp'),
    'https://in.indeed.com/viewjob?jk=44f9305d780a77e8'
  );
  assert.strictEqual(
    canonicalIndeedUrl('https://www.indeed.com/viewjob?jk=44f9305d780a77e8&utm_source=x'),
    'https://www.indeed.com/viewjob?jk=44f9305d780a77e8'
  );
});

test('parses _initialData and builds job text', () => {
  const fixture = `
<!DOCTYPE html><html><body><script>
window._initialData={"jobKey":"44f9305d780a77e8","jobTitle":"Senior Engineer","jobLocation":"Pune",
"jobInfoWrapperModel":{"jobInfoModel":{"jobInfoHeaderModel":{"jobTitle":"Senior Engineer","companyName":"Acme Corp","formattedLocation":"Pune, MH"},
"sanitizedJobDescription":"<p>Build APIs with <b>Node.js</b> and React for production systems.</p><ul><li>Own CI/CD pipelines end to end</li><li>Ship reliable services with monitoring</li></ul>"}}};
</script></body></html>`;

  const data = parseIndeedInitialData(fixture);
  assert.ok(data);
  assert.strictEqual(data.jobKey, '44f9305d780a77e8');

  const job = jobFromIndeedInitialData(data, {
    jk: '44f9305d780a77e8',
    canonicalUrl: 'https://www.indeed.com/viewjob?jk=44f9305d780a77e8',
  });
  assert.ok(job);
  assert.strictEqual(job.title, 'Senior Engineer');
  assert.strictEqual(job.company, 'Acme Corp');
  assert.ok(job.text.includes('Node.js'));
  assert.ok(job.text.includes('Own CI/CD'));
  assert.ok(job.text.length > 80);
});

test('htmlToPlainText strips tags', () => {
  assert.strictEqual(htmlToPlainText('<p>Hello&nbsp;<b>world</b></p>'), 'Hello world');
});

test('extractBalancedJson handles nested braces in strings', () => {
  const src = 'prefix{"a":{"b":"}x{"},"c":1}suffix';
  const json = extractBalancedJson(src, src.indexOf('{'));
  assert.strictEqual(json, '{"a":{"b":"}x{"},"c":1}');
  assert.deepStrictEqual(JSON.parse(json), { a: { b: '}x{' }, c: 1 });
});

await testAsync('fetchIndeedJob uses mobile endpoint + parses response', async () => {
  const jk = '44f9305d780a77e8';
  const html = `<html><script>window._initialData={"jobKey":"${jk}",
"jobInfoWrapperModel":{"jobInfoModel":{"jobInfoHeaderModel":{"jobTitle":"Backend Eng","companyName":"TestCo","formattedLocation":"Remote"},
"sanitizedJobDescription":"<p>${'Requirements: TypeScript Node PostgreSQL Docker Kubernetes AWS '.repeat(3)}</p>"}}};</script></html>`;

  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      text: async () => html,
    };
  };

  const job = await fetchIndeedJob(`https://in.indeed.com/viewjob?jk=${jk}`, { fetchImpl });
  assert.ok(calls[0].includes('/m/basecamp/viewjob'));
  assert.ok(calls[0].includes(`jk=${jk}`));
  assert.strictEqual(job.company, 'TestCo');
  assert.strictEqual(job.title, 'Backend Eng');
  assert.ok(job.text.includes('TypeScript'));
});

await testAsync('fetchIndeedJob rejects missing jk', async () => {
  await assert.rejects(
    () => fetchIndeedJob('https://in.indeed.com/jobs?q=engineer'),
    /job key/
  );
});

test('looksLikeUsableJd accepts a real description', () => {
  const jd = [
    'Software Developer at Spreetail',
    'About the role: you will build and ship backend services.',
    'Requirements: 5+ years of experience with Node.js, PostgreSQL, and AWS.',
    'Responsibilities include owning services end to end and mentoring engineers.',
    'x'.repeat(400),
  ].join('\n');
  assert.strictEqual(looksLikeUsableJd(jd), true);
});

test('looksLikeUsableJd rejects Indeed listing chrome', () => {
  // Company jobs listing page: long enough, but no requirements/responsibilities.
  const chrome = [
    'Spreetail jobs',
    'Sign in Employers / Post Job Start of main content',
    'Upload your resume Salary guide Career guide Help Centre',
    'Filter by location Full-time Part-time Contract',
    'View all jobs Company reviews Find salaries',
  ].join('\n').repeat(6);
  assert.ok(chrome.length > 400);
  assert.strictEqual(looksLikeUsableJd(chrome), false);
});

test('looksLikeUsableJd rejects short text and Cloudflare block pages', () => {
  assert.strictEqual(looksLikeUsableJd('Requirements: Node.js'), false);
  const blocked = `Additional Verification Required ${'cloudflare '.repeat(80)} requirements`;
  assert.strictEqual(looksLikeUsableJd(blocked), false);
});

test('indeedManualJdHint gives canonical URL and manual steps', () => {
  const hint = indeedManualJdHint(
    'https://in.indeed.com/cmp/Spreetail/jobs?jk=3a7abba7ebdc2a31&start=0'
  );
  assert.ok(hint.includes('https://in.indeed.com/viewjob?jk=3a7abba7ebdc2a31'));
  assert.ok(/--file \.\/jd\.txt/.test(hint));
  assert.ok(/paste/i.test(hint));
});

await testAsync('blocked Indeed fetch throws a flagged IndeedFetchError', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, text: async () => 'blocked' });
  await assert.rejects(
    () => fetchIndeedJob('https://in.indeed.com/viewjob?jk=3a7abba7ebdc2a31', { fetchImpl }),
    (err) => {
      assert.ok(err instanceof IndeedFetchError);
      assert.strictEqual(err.indeedBlocked, true);
      assert.ok(/HTTP 403/.test(err.message));
      assert.ok(/add-job\.mjs/.test(err.message));
      return true;
    }
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
