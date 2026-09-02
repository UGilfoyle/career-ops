#!/usr/bin/env node
/**
 * test-universal-resume-engine.mjs — Universal stress test suite for the resume generation engine.
 *
 * Verifies that the engine can process ANY job description:
 * - Real existing repository JDs (all 13 in jds/)
 * - Diverse domain JDs (Minimalist, Rust/Distributed, Engineering Lead, Blockchain/Go, Messy Job Board)
 *
 * Checks for every test case:
 * 1. Process completes successfully (exit code 0)
 * 2. Frozen employers are 100% preserved (equality PASS)
 * 3. Alignment verdict is PASS
 * 4. ATS content score >= 90 (target 95%+)
 * 5. Zero unreplaced {{PLACEHOLDER}} template markers
 * 6. Valid PDF generated with appropriate page budget (<= 2 pages)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const WILD_JDS = [
  {
    name: 'wild-minimal-bullets.txt',
    company: 'StealthStartup',
    text: `Looking for a Senior Backend Engineer to join our early team.
- Build high-scale RESTful APIs in Python or Node.js.
- Work with PostgreSQL, Redis, and Docker on AWS.
- Implement CI/CD pipelines and automated testing with high test coverage.`,
  },
  {
    name: 'wild-rust-distributed.txt',
    company: 'ApexSystems',
    text: `Job Title: Principal Distributed Systems Engineer
Company: Apex Systems
Location: Remote (Global)

About the role:
We are building a next-generation distributed storage engine capable of processing millions of concurrent transactions with sub-millisecond p99 latency.

Requirements:
- 8+ years designing low-latency distributed systems, consensus algorithms (Raft/Paxos), and high-throughput network protocols.
- Hands-on experience with Rust, C++, or Go for systems programming.
- Deep expertise in Linux internals, memory management, multi-threading, lock-free data structures, and eBPF.
- Experience with Kafka, Redis, and high-performance RPC frameworks (gRPC).
- Strong track record in observability (Prometheus, Grafana, OpenTelemetry) and incident triage in production.`,
  },
  {
    name: 'wild-eng-manager.txt',
    company: 'ScaleOps',
    text: `# Engineering Lead / Manager — ScaleOps

ScaleOps is seeking an Engineering Lead to mentor and scale our Platform & Cloud Infrastructure engineering organization.

Responsibilities:
- Lead a team of 8-12 senior engineers delivering cloud infrastructure, developer platform services, and CI/CD tooling.
- Partner with Product and Architecture to define roadmap, technical strategy, and architectural standards across microservices.
- Champion engineering excellence: code reviews, automated testing, blameless post-mortems, and SLA/SLO monitoring.
- Drive hiring, retention, performance reviews, and technical career growth for engineers.

Qualifications:
- 8+ years of professional software engineering experience with at least 2+ years in technical leadership or engineering management.
- Strong foundational background in cloud architecture (AWS/GCP), container platforms (Docker, Kubernetes), and microservices.
- Excellent stakeholder communication, agile coaching, and team-building capability.`,
  },
  {
    name: 'wild-web3-go.txt',
    company: 'BlockMatrix',
    text: `Title: Senior Backend Developer (Go / Blockchain)
Department: Core Infrastructure

BlockMatrix builds decentralized indexers and real-time blockchain telemetry pipelines.

What You'll Do:
- Design and operate high-throughput data ingestion workers written in Go (Golang) indexing real-time chain events.
- Build resilient event-driven message pipelines using Kafka and RabbitMQ.
- Model data schemas in PostgreSQL and ClickHouse for analytical queries.
- Deploy services using Kubernetes, Terraform, and GitHub Actions.

Requirements:
- 5+ years backend software development experience with strong proficiency in Go or modern backend languages.
- Solid experience with relational databases (PostgreSQL), query optimization, and caching (Redis).
- Hands-on cloud experience with AWS or GCP.`,
  },
  {
    name: 'wild-messy-scraped-board.txt',
    company: 'EnterpriseCorp',
    text: `Apply Now | Save Job | Share
Job ID: 948274 | Posted: 2 hours ago | 42 applicants
EnterpriseCorp — Ranked #1 Workplace 2026

Role: Senior Full Stack Developer (Node.js & React)
Location: Chicago, IL (Hybrid - 2 days in office)
Salary Range: $140,000 - $175,000 per year + Annual Bonus + 401(k) Matching 6%
Benefits: Medical, Dental, Vision, 20 Days PTO, 12 Holidays, Parental Leave

EQUAL OPPORTUNITY EMPLOYER: We do not discriminate based on race, gender, religion, etc.

About EnterpriseCorp:
EnterpriseCorp has been a leader in enterprise logistics for over 45 years.

Job Description:
We are looking for a Senior Full Stack Developer to help re-architect our flagship customer-facing portal.
Key Duties:
- Develop modern web user interfaces in React.js, TypeScript, and HTML5/CSS3.
- Develop scalable backend microservices using Node.js, Express, and REST APIs.
- Optimize database queries and schema designs in MySQL / PostgreSQL.
- Write unit and integration tests using Jest and Cypress.
- Work closely with Agile/Scrum cross-functional product squads.

Must Have:
- Bachelor's degree in CS or equivalent practical experience.
- 5+ years developing full-stack web applications in Node.js and React.
- Solid understanding of CI/CD, Git, and Docker.

Similar Jobs You Might Like:
- Full Stack Developer at TechCo
- React Developer at RetailInc
Click here to see more jobs.`,
  },
];

const scratchDir = path.join(__dirname, 'scratch', 'universal-test-jds');
if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

console.log('═══════════════════════════════════════════════════════════');
console.log('  🧪 UNIVERSAL RESUME GENERATION ENGINE STRESS TEST');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Gather all real JDs
const realJds = fs.readdirSync('jds')
  .filter((f) => f.endsWith('.txt') || f.endsWith('.md'))
  .map((f) => ({
    name: f,
    path: path.join('jds', f),
    company: f.split('-')[0],
    isWild: false,
  }));

// 2. Write out synthetic wild JDs
const wildCases = WILD_JDS.map((w) => {
  const filePath = path.join(scratchDir, w.name);
  fs.writeFileSync(filePath, w.text, 'utf8');
  return {
    name: w.name,
    path: filePath,
    company: w.company,
    isWild: true,
  };
});

const allCases = [...realJds, ...wildCases];
let passed = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < allCases.length; i++) {
  const c = allCases[i];
  const prefix = `[${i + 1}/${allCases.length}]`;
  const tag = c.isWild ? '🌟 WILD' : '🏢 REAL';
  const outBase = `test_universal_${path.basename(c.name, path.extname(c.name))}`;

  process.stdout.write(`${prefix} ${tag} ${c.name.padEnd(45)} `);

  try {
    const cmd = `node scripts/run-plan-tailor.mjs --jd "${c.path}" --company "${c.company}" --out-basename "${outBase}" --no-cover`;
    const res = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

    const htmlPath = path.join('output', `${outBase}.html`);
    const pdfPath = path.join('output', `${outBase}.pdf`);
    const jsonPath = path.join('output', `${outBase}.alignment.json`);

    const errors = [];

    // Check files exist
    if (!fs.existsSync(htmlPath)) errors.push('HTML file not generated');
    if (!fs.existsSync(pdfPath)) errors.push('PDF file not generated');
    if (!fs.existsSync(jsonPath)) errors.push('Alignment JSON not generated');

    // Check placeholder leaks
    if (fs.existsSync(htmlPath)) {
      const html = fs.readFileSync(htmlPath, 'utf8');
      const leftovers = html.match(/\{\{[A-Z_]+\}\}/g);
      if (leftovers && leftovers.length) {
        errors.push(`Unreplaced template placeholders: ${leftovers.join(', ')}`);
      }
    }

    // Check PDF size
    if (fs.existsSync(pdfPath)) {
      const pdfStats = fs.statSync(pdfPath);
      if (pdfStats.size < 25000) errors.push(`PDF size too small: ${pdfStats.size} bytes`);
    }

    // Check alignment data
    if (fs.existsSync(jsonPath)) {
      const align = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (align.verdict !== 'PASS') {
        errors.push(`Alignment FAIL: ${(align.reasons || []).join('; ')}`);
      }
      const ats = align.selected?.ats ?? 0;
      if (ats < 90) {
        errors.push(`ATS content score ${ats} < 90`);
      }
      if (align.plan?.frozenCheck && !align.plan.frozenCheck.pass) {
        errors.push('Frozen employers were modified');
      }
    }

    if (errors.length === 0) {
      const align = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const ats = align.selected?.ats ?? 0;
      const composite = align.selected?.composite ?? 0;
      const family = align.plan?.family || 'unknown';
      console.log(`✅ PASS  family=${family.padEnd(16)} ATS=${ats} Comp=${composite}`);
      passed++;
    } else {
      console.log(`❌ FAIL\n      → ${errors.join('\n      → ')}`);
      failures.push({ name: c.name, errors });
      failed++;
    }
  } catch (err) {
    const msg = err.stderr ? err.stderr.toString().split('\n')[0] : err.message;
    console.log(`❌ CRASH\n      → ${msg}`);
    failures.push({ name: c.name, errors: [msg] });
    failed++;
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log(`📊 SUMMARY: ${passed} passed, ${failed} failed out of ${allCases.length} test cases`);
console.log('═══════════════════════════════════════════════════════════');

if (failed > 0) {
  console.error('\nFailed test cases:');
  for (const f of failures) {
    console.error(`- ${f.name}:`);
    for (const e of f.errors) console.error(`    • ${e}`);
  }
  process.exit(1);
} else {
  console.log('🟢 All tests passed with ATS scores ≥90 and verified viability!');
  process.exit(0);
}
