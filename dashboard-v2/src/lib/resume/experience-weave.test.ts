import assert from 'node:assert/strict';
import { weaveKeywordsIntoExperience } from './experience-weave';
import type { ExperienceEntry } from './types';

function run() {
  console.log('Testing experience-weave MC/DC & edge cases...');

  // 1. Edge Case: Null, undefined, empty array inputs
  assert.deepEqual(weaveKeywordsIntoExperience(undefined, ['Kafka']), []);
  assert.deepEqual(weaveKeywordsIntoExperience([], ['Kafka']), []);
  assert.deepEqual(
    weaveKeywordsIntoExperience([{ role: 'Dev', company: 'Co', period: '2024', bullets: ['Built API.'] }], []),
    [{ role: 'Dev', company: 'Co', period: '2024', bullets: ['Built API.'] }]
  );

  // 2. MC/DC: Keyword already present in a bullet (case-insensitive) -> zero changes
  const existingExp: ExperienceEntry[] = [
    { role: 'Dev', company: 'Co', period: '2024', bullets: ['Architected Kafka event streams for telemetry.'] },
  ];
  const out1 = weaveKeywordsIntoExperience(existingExp, ['kafka']);
  assert.equal(out1[0].bullets[0], 'Architected Kafka event streams for telemetry.');

  // 3. MC/DC: Non-weavable skill (>3 words or narrative stopwords) -> must be rejected
  const baseExp: ExperienceEntry[] = [
    { role: 'Dev', company: 'Co', period: '2024', bullets: ['Designed microservices for enterprise cloud.'] },
  ];
  const out2 = weaveKeywordsIntoExperience(baseExp, [
    'experience in building high throughput backends',
    'management in production environments',
    'x', // < 2 chars
  ]);
  assert.equal(out2[0].bullets[0], 'Designed microservices for enterprise cloud.');

  // 4. MC/DC: Bullet ending in percentage/metric -> skipped from direct append
  const metricExp: ExperienceEntry[] = [
    {
      role: 'Dev',
      company: 'Co',
      period: '2024',
      bullets: [
        'Reduced database CPU utilization by 35%.',
        'Built telemetry pipelines for cloud devices.',
      ],
    },
  ];
  const out3 = weaveKeywordsIntoExperience(metricExp, ['Docker']);
  assert.equal(out3[0].bullets[0], 'Reduced database CPU utilization by 35%.');
  assert.match(out3[0].bullets[1], /\(Docker\)\.$/);

  // 5. MC/DC: Appending to bullet with existing tools paren -> merge into single paren, no double parens
  const parenExp: ExperienceEntry[] = [
    {
      role: 'Dev',
      company: 'Co',
      period: '2024',
      bullets: ['Optimized RESTful APIs throughput and response times (CI/CD).'],
    },
  ];
  const out4 = weaveKeywordsIntoExperience(parenExp, ['Kafka']);
  assert.match(out4[0].bullets[0], /\(CI\/CD, Kafka\)\.$/);
  assert.ok(!out4[0].bullets[0].includes('))'), 'Must not contain double closing parens');
  assert.ok(!out4[0].bullets[0].includes(')('), 'Must not contain adjacent parens');

  // 6. MC/DC: Unbalanced parens in input text -> sanitized cleanly
  const unclosedExp: ExperienceEntry[] = [
    {
      role: 'Dev',
      company: 'Co',
      period: '2024',
      bullets: ['Deployed microservices with high throughput (Kubernetes.'],
    },
  ];
  const out5 = weaveKeywordsIntoExperience(unclosedExp, ['Redis']);
  assert.ok(!out5[0].bullets[0].includes('(('));
  assert.ok(!out5[0].bullets[0].includes('))'));

  // 7. Edge Case: Comma-separated keyword list -> expanded and distributed
  const multiRoleExp: ExperienceEntry[] = [
    {
      role: 'Lead',
      company: 'Alpha',
      period: '2024',
      bullets: ['Built enterprise billing workflows.', 'Managed async task ingestion queues.'],
    },
    {
      role: 'Senior',
      company: 'Beta',
      period: '2023',
      bullets: ['Developed user authentication layers.', 'Created backend event streams.'],
    },
  ];
  const out6 = weaveKeywordsIntoExperience(multiRoleExp, ['PostgreSQL, TypeORM', 'Prisma']);
  const allBullets = out6.flatMap((r) => r.bullets);
  assert.ok(allBullets.some((b) => b.includes('PostgreSQL')));
  assert.ok(allBullets.some((b) => b.includes('TypeORM')));
  assert.ok(allBullets.some((b) => b.includes('Prisma')));

  console.log('experience-weave tests: all passed');
}

run();
