import assert from 'node:assert/strict';
import { calculateMarketReadiness } from './readiness-calculator';

console.log('Testing Market Readiness calculation engine...');

// Test 1: Empty input
const emptyReport = calculateMarketReadiness({
  resumeContext: {},
  pipelineJobsCount: 0,
  applicationsCount: 0,
  practicePacksCount: 0,
});

assert.ok(emptyReport.score < 30, `Expected low score for empty profile, got: ${emptyReport.score}`);
assert.equal(emptyReport.tier, 'Getting Started');
assert.ok(emptyReport.checklist.length > 0);
assert.ok(emptyReport.checklist.some((item) => !item.completed));

// Test 2: Rich profile
const richReport = calculateMarketReadiness({
  resumeContext: {
    candidate: {
      full_name: 'Akash Kaintura',
      location: 'Bengaluru, India',
      linkedin: 'https://linkedin.com/in/akash',
      github: 'https://github.com/akash',
      portfolio_url: 'https://akash.dev',
    },
    narrative: {
      headline: 'Lead Distributed Systems & Full-Stack Engineer',
      exit_story: 'Experienced architect scaling high-concurrency systems.',
      superpowers: ['Distributed Systems Architecture', 'Real-time Event Streaming'],
      proof_points: [
        { name: 'Core Scale', hero_metric: 'Scaled Redis cluster to 2M ops/sec' },
        { name: 'Cost Optimization', hero_metric: 'Reduced AWS infra spend by $300k/yr' },
      ],
    },
    experience: [
      {
        role: 'Staff Engineer',
        company: 'Cloud Corp',
        bullets: [
          'Reduced API p99 latency by 45% using distributed Redis caching layer.',
          'Scaled core microservices to handle 10M+ daily active requests across 4 regions.',
          'Saved $250k annually by migrating Kubernetes clusters to Graviton instances.',
        ],
      },
      {
        role: 'Senior Software Engineer',
        company: 'Data Systems',
        bullets: [
          'Led architecture of real-time Kafka event streaming pipeline processing 100k events/sec.',
          'Increased database query performance by 4x through custom indexing and partitioning.',
        ],
      },
    ],
    skills: {
      Languages: ['TypeScript', 'Go', 'Python', 'SQL'],
      Cloud: ['AWS', 'Kubernetes', 'Docker', 'Redis', 'Kafka'],
    },
  },
  pipelineJobsCount: 8,
  applicationsCount: 6,
  practicePacksCount: 2,
  dossierEnabled: true,
});

assert.ok(richReport.score >= 88, `Expected Elite tier score >= 88, got: ${richReport.score}`);
assert.equal(richReport.tier, 'Elite (Top 5%)');
assert.equal(richReport.pillars.resume.percentage, 100);
assert.equal(richReport.pillars.interview.percentage, 100);
assert.equal(richReport.pillars.pipeline.percentage, 100);

// Test 3: Benchmark latency (< 1ms)
const start = performance.now();
for (let i = 0; i < 100; i++) {
  calculateMarketReadiness({
    pipelineJobsCount: 5,
    applicationsCount: 3,
    practicePacksCount: 1,
  });
}
const elapsed = (performance.now() - start) / 100;
console.log(`Average compute time: ${elapsed.toFixed(3)}ms per report (well under 1ms)`);
assert.ok(elapsed < 1, 'Calculation took longer than 1ms');

console.log('All Market Readiness tests passed successfully!');
