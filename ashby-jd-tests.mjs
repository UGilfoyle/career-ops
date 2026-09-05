import assert from 'node:assert/strict';
import {
  parseAshbyJobRef,
  htmlToPlainJd,
  formatAshbyJobText,
  fetchAshbyJobDescription,
} from './ashby-jd.mjs';

const bureau = parseAshbyJobRef(
  'https://jobs.bureau.id/?ashby_jid=ace77ea0-a254-48b3-bc53-d36426344383',
);
assert.deepEqual(bureau, {
  slug: 'bureau',
  jobId: 'ace77ea0-a254-48b3-bc53-d36426344383',
});

const canonical = parseAshbyJobRef(
  'https://jobs.ashbyhq.com/bureau/ace77ea0-a254-48b3-bc53-d36426344383',
);
assert.deepEqual(canonical, bureau);

assert.equal(parseAshbyJobRef('https://jobs.ashbyhq.com/bureau'), null);
assert.equal(parseAshbyJobRef('https://example.com/jobs/1'), null);

const text = formatAshbyJobText({
  title: 'Senior Data Engineer',
  location: 'Bangalore',
  descriptionHtml: '<p>About Bureau</p><ul><li>Kafka</li><li>Python</li></ul>',
});
assert.match(text, /Job Title: Senior Data Engineer/);
assert.match(text, /Kafka/);
assert.ok(!text.includes('<p>'));
assert.ok(htmlToPlainJd('<p>Hello</p>').includes('Hello'));

const fakeFetch = async () => ({
  ok: true,
  json: async () => ({
    jobs: [
      {
        id: 'ace77ea0-a254-48b3-bc53-d36426344383',
        title: 'Senior Data Engineer',
        location: 'Remote',
        descriptionHtml: '<p>'.repeat(5) + 'Build event pipelines with Kafka and Python for risk decisioning. '.repeat(8),
      },
    ],
  }),
});
const fetched = await fetchAshbyJobDescription(
  'https://jobs.bureau.id/?ashby_jid=ace77ea0-a254-48b3-bc53-d36426344383',
  fakeFetch,
);
assert.ok(fetched.text.length > 120);
assert.match(fetched.text, /Senior Data Engineer/);
assert.match(fetched.text, /Kafka/);

console.log('ashby-jd-tests: ok');
