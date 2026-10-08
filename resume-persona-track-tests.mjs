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
- Strong expertise with TypeScript, Node.js, and stream runtime performance.
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
assert.strictEqual(reframedA.education[0].degree, 'MCA, STEM', 'Education should be annotated with , STEM');
console.log('  ✅ Profile reframing for Track A passed');

const reframedB = applyPersonaTrackToProfile(mockProfile, TRACK_B_ID);
assert.strictEqual(reframedB.narrative.headline, 'Track B Headline — Node.js, Bun, TypeScript');
assert.strictEqual(reframedB.narrative.superpowers[0], 'Node.js');
assert.strictEqual(reframedB.education[0].degree, 'MCA, STEM');
console.log('  ✅ Profile reframing for Track B passed');

// 5. Test Java Full Stack auto-detection and built-in reframing
const javaJd = `
Role: Senior Full Stack Java Developer
Requirements:
- 7+ years of experience with Java, Spring Boot, and cloud microservices.
- Strong proficiency in modern front-end frameworks (React or Angular).
- Hands-on experience with Kafka or RabbitMQ event streaming and PostgreSQL.
- Experience with Docker, Kubernetes, and AWS deployment.
`;
const detectedJava = detectPersonaTrack(javaJd);
assert.strictEqual(detectedJava.trackId, 'java_fullstack', 'Expected java_fullstack for Java/Spring/React JD');
const reframedJava = applyPersonaTrackToProfile(mockProfile, 'java_fullstack');
assert.strictEqual(reframedJava.experience[0].role, 'Senior Full Stack Java Developer');
assert(reframedJava.experience[0].bullets[0].includes('Java and Spring Boot'));
assert(reframedJava.experience[0].tech_stack.includes('Java'));
assert(reframedJava.narrative.superpowers.some((s) => s.includes('Java & Spring Boot')));
console.log('  ✅ Java Full Stack detection and reframing passed');

// 6. Test Python FastAPI Full Stack auto-detection and reframing
const fastapiJd = `
Role: Senior Python Full Stack Developer
Requirements:
- 7+ years experience with Python and FastAPI asynchronous microservices.
- Experience building React and TypeScript dashboards.
- Deep experience with PostgreSQL, Redis, Docker, and Azure / AWS / GCP.
`;
const detectedFastapi = detectPersonaTrack(fastapiJd);
assert.strictEqual(detectedFastapi.trackId, 'python_fastapi', 'Expected python_fastapi for FastAPI/React JD');
const reframedFastapi = applyPersonaTrackToProfile(mockProfile, 'python_fastapi');
assert.strictEqual(reframedFastapi.experience[0].role, 'Senior Python Backend Engineer');
assert(reframedFastapi.experience[0].bullets[0].includes('Python ingestion engines'));
assert(reframedFastapi.experience[0].tech_stack.includes('FastAPI'));
console.log('  ✅ Python FastAPI detection and reframing passed');

// 7. Test .NET C# Azure auto-detection and reframing
const dotnetJd = `
Role: Senior Backend Developer (.NET / C#)
Requirements:
- 7+ years building enterprise microservices with C#, .NET Core, and ASP.NET.
- Azure Cloud Services (Functions, Azure Service Bus, App Services).
- Microsoft SQL Server, PostgreSQL, Redis, and distributed systems.
`;
const detectedDotnet = detectPersonaTrack(dotnetJd);
assert.strictEqual(detectedDotnet.trackId, 'dotnet_azure', 'Expected dotnet_azure for .NET/C#/Azure JD');
const reframedDotnet = applyPersonaTrackToProfile(mockProfile, 'dotnet_azure');
assert.strictEqual(reframedDotnet.experience[0].role, 'Senior Backend Engineer');
assert(reframedDotnet.experience[0].bullets[0].includes('microservices on Linux and Azure'));
assert(reframedDotnet.experience[0].tech_stack.includes('.NET Core'));
console.log('  ✅ .NET C# Azure detection and reframing passed');

// 8. Test Senior Full Stack Generalist auto-detection and reframing
const fullstackJd = `
Role: Senior Full Stack Developer
Requirements:
- 7+ years building full-stack web applications and scalable APIs.
- React, TypeScript, modern frontend state management, and backend services.
- PostgreSQL, Redis, Docker, and automated CI/CD pipelines.
`;
const detectedFullstack = detectPersonaTrack(fullstackJd);
assert.strictEqual(detectedFullstack.trackId, 'senior_fullstack', 'Expected senior_fullstack for generalist Full Stack JD');
const reframedFullstack = applyPersonaTrackToProfile(mockProfile, 'senior_fullstack');
assert.strictEqual(reframedFullstack.experience[0].role, 'Senior Full Stack Engineer');
assert(reframedFullstack.experience[0].tech_stack.includes('React'));
console.log('  ✅ Senior Full Stack detection and reframing passed');

// 9. Test Rubico role title, Artisanssoft role title, and Kafka chronology across presets
const fullMockProfile = {
  experience: [
    { company: 'Quest Global', role: 'Lead Backend Engineer' },
    { company: 'INTVERSE IT Services', role: 'Senior Full Stack Developer' },
    { company: 'Glidewell Software Services', role: 'Software Engineer 2' },
    { company: 'Srijan Technologies', role: 'Software Engineer' },
    { company: 'Athena & Tully Pte', role: 'Full-Stack Developer' },
    { company: 'Rubico IT Pvt Ltd', role: 'Associate Software Engineer' },
    { company: 'Artisanssoft', role: 'Associate Developer' },
  ],
};

for (const track of ['java_fullstack', 'python_fastapi', 'dotnet_azure', 'track_b', 'senior_fullstack']) {
  const p = applyPersonaTrackToProfile(fullMockProfile, track);
  const rubico = p.experience.find((e) => e.company.includes('Rubico'));
  const artisans = p.experience.find((e) => e.company.includes('Artisans'));
  const athena = p.experience.find((e) => e.company.includes('Athena'));
  assert.strictEqual(rubico.role, 'Associate Software Engineer', `Rubico role should be Associate Software Engineer in ${track}`);
  assert.strictEqual(artisans.role, 'Associate Developer', `Artisanssoft role should be Associate Developer in ${track}`);
  assert(!rubico.tech_stack.includes('Kafka'), `Kafka must NOT be in Rubico for ${track}`);
  assert(!artisans.tech_stack.includes('Kafka'), `Kafka must NOT be in Artisanssoft for ${track}`);
  assert(athena.tech_stack.includes('Kafka'), `Kafka should be present from Athena onwards for ${track}`);
}
console.log('  ✅ Rubico / Artisanssoft / Kafka chronology verification passed across all presets');

console.log('🎉 All resume-persona-track tests passed!');
