import assert from 'assert';
import {
  detectPersonaTrack,
  applyPersonaTrackToProfile,
  TRACK_A_ID,
  TRACK_B_ID,
} from './resume-persona-track.mjs';

console.log('🧪 Testing resume-persona-track...');

// 1. Test Track A detection from Python/Data Platform JD
const pythonJd = `
Role: Senior Data Platform Engineer
Requirements:
- 5+ years experience with Python, Linux internals, and high-throughput microservices.
- Advanced PostgreSQL at scale (PgBouncer, query optimization, partitioning, autovacuum).
- Experience building in-house telemetry ingestion pipelines and event streaming with Kafka.
`;
const detectedA = detectPersonaTrack(pythonJd);
assert.strictEqual(detectedA.trackId, TRACK_A_ID, 'Expected Track A for Python/Data Platform JD');
assert.strictEqual(detectedA.source, 'auto');
assert(detectedA.scoreA > detectedA.scoreB, 'Track A score should exceed Track B');
console.log('  ✅ Track A auto-detection from JD passed');

// 2. Test Track B detection from Node/TypeScript JD
const nodeJd = `
Role: Lead Backend Engineer (Cloud Services)
Requirements:
- Strong expertise with TypeScript, Node.js, and Bun runtime performance.
- Experience with Redis caching, PostgreSQL, Docker, and Kubernetes on AWS.
- Background in API design, microservices architecture, and technical mentorship.
`;
const detectedB = detectPersonaTrack(nodeJd);
assert.strictEqual(detectedB.trackId, TRACK_B_ID, 'Expected Track B for Node/TS JD');
assert.strictEqual(detectedB.source, 'auto');
assert(detectedB.scoreB > detectedA.scoreB, 'Track B score should be higher');
console.log('  ✅ Track B auto-detection from JD passed');

// 3. Test explicit CLI overrides
const overrideA = detectPersonaTrack(nodeJd, 'data');
assert.strictEqual(overrideA.trackId, TRACK_A_ID, 'Expected CLI override to Track A');
assert.strictEqual(overrideA.source, 'cli');

const overrideB = detectPersonaTrack(pythonJd, 'node');
assert.strictEqual(overrideB.trackId, TRACK_B_ID, 'Expected CLI override to Track B');
assert.strictEqual(overrideB.source, 'cli');
console.log('  ✅ CLI overrides passed');

// 4. Test profile reframing
const mockProfile = {
  candidate: { full_name: 'Test Candidate' },
  narrative: {
    headline: 'Default Headline',
    exit_story: 'Default Exit Story',
    superpowers: ['Default'],
    tracks: {
      track_a: {
        headline: 'Track A Headline — Linux, Python, PostgreSQL',
        exit_story: 'Track A Exit Story',
        superpowers: ['Linux', 'Python', 'PostgreSQL'],
        proof_points: [{ name: 'Scale', hero_metric: 'Millions/day' }],
        experience_reframes: {
          quest: {
            role: 'Senior Backend Engineer (SKF Telemetry)',
            bullets: ['Telemetry ingestion on Linux into PostgreSQL'],
          },
        },
      },
      track_b: {
        headline: 'Track B Headline — Node.js, Bun, TypeScript',
        exit_story: 'Track B Exit Story',
        superpowers: ['Node.js', 'Bun', 'TypeScript'],
        proof_points: [{ name: 'Latency', hero_metric: '-40%' }],
      },
    },
  },
  experience: [
    {
      company: 'Quest Global',
      role: 'Lead Backend Engineer',
      bullets: ['Original Node.js bullet'],
    },
  ],
  education: [
    { school: 'Univ', degree: 'MCA', period: '2016-2018' },
  ],
};

const reframedA = applyPersonaTrackToProfile(mockProfile, TRACK_A_ID);
assert.strictEqual(reframedA.narrative.headline, 'Track A Headline — Linux, Python, PostgreSQL');
assert.strictEqual(reframedA.experience[0].role, 'Senior Backend Engineer (SKF Telemetry)');
assert.strictEqual(reframedA.experience[0].bullets[0], 'Telemetry ingestion on Linux into PostgreSQL');
assert.strictEqual(reframedA.education[0].degree, 'MCA — STEM', 'Education should be annotated with — STEM');
console.log('  ✅ Profile reframing for Track A passed');

const reframedB = applyPersonaTrackToProfile(mockProfile, TRACK_B_ID);
assert.strictEqual(reframedB.narrative.headline, 'Track B Headline — Node.js, Bun, TypeScript');
assert.strictEqual(reframedB.narrative.superpowers[0], 'Node.js');
assert.strictEqual(reframedB.education[0].degree, 'MCA — STEM');
console.log('  ✅ Profile reframing for Track B passed');

console.log('🎉 All resume-persona-track tests passed!');
