import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { fillAtsTemplate } from '../dashboard-v2/src/lib/resume/fill-template';
import type { ResumeContext } from '../dashboard-v2/src/lib/resume/types';

const revolutResume: ResumeContext = {
  candidate: {
    full_name: 'Akash Kaintura',
    email: 'akash.k96.official@gmail.com',
    phone: '+91 8979594537',
    location: 'Pune, India (Open to Relocation)',
    linkedin: 'linkedin.com/in/akashkaintura',
    github: 'github.com/UGilfoyle',
  },
  narrative: {
    headline: 'Senior Backend Engineer with 8+ years architecting high-throughput data platforms, distributed ingestion services, and event-driven systems in Linux, Python, and PostgreSQL at scale.',
    exit_story: 'Deep expertise optimizing Linux kernel/network parameters, multi-process Python workers, and large-scale PostgreSQL database scaling (PgBouncer connection pooling, autovacuum tuning, and multi-terabyte table partitioning). Track record of building in-house, vendor-scale ingestion engines processing millions of daily telemetry events with 99.9% uptime and sub-110ms latency.',
    superpowers: [
      'Linux',
      'Python',
      'PostgreSQL',
      'PgBouncer',
      'Redis',
      'Kafka',
      'Docker',
      'Kubernetes',
      'AWS',
      'Distributed Systems',
      'SRE',
      'TypeScript',
      'FastAPI',
      'ELK Stack',
      'Prometheus',
    ],
    proof_points: [
      { name: 'PostgreSQL Scaling', hero_metric: 'Reduced DB CPU by 35% via table partitioning and connection pool tuning under peak batch loads' },
      { name: 'Telemetry Latency', hero_metric: 'Cut p99 write latency from 3.8s to <110ms on high-frequency ingestion pipelines' },
      { name: 'Platform Uptime', hero_metric: 'Sustained 99.9% uptime processing millions of daily industrial events without vendor dependencies' },
    ],
  },
  experience: [
    {
      company: 'Quest Global Engineering Services',
      role: 'Senior Backend Engineer (Client: SKF - Industrial Telemetry Platform)',
      period: 'Jul 2025 – Present',
      bullets: [
        'Owned core in-house telemetry ingestion engine on Linux, architecting distributed pipelines handling millions of high-frequency industrial telemetry events daily into PostgreSQL with 99.9% uptime.',
        'Engineered PostgreSQL table partitioning (time-based chunks) and connection pooling with PgBouncer, eliminating lock contention under peak batch ingest bursts and slashing DB CPU load by 35%.',
        'Optimized p99 API write latencies from ~3.8s down to <110ms by profiling query execution plans, tuning autovacuum thresholds, and decoupling incoming payloads via an asynchronous batch buffer.',
        'Hardened Linux production environments (EC2, network load balancers, kernel socket tuning) and mentored 4–6 engineers across system architecture, data access patterns, and code reviews.',
      ],
    },
    {
      company: 'INTVERSE IT Services',
      role: 'Senior Full-Stack Developer (Client: Kenvue)',
      period: 'Feb 2025 – Jun 2025',
      bullets: [
        'Engineered high-throughput document and metadata ingestion microservices in Python with multi-process workers, Pydantic validation schemas, and structured storage for enterprise knowledge collections.',
        'Optimized query latency and throughput by integrating conversational caching layers and Redis multi-layer caching over large-scale indexed datasets.',
        'Automated AWS container orchestration workflows via Terraform and CI/CD pipelines, introducing automated pre-flight validation checks to diminish continuous deployment failure rates by 85%.',
      ],
    },
    {
      company: 'Glidewell Software Services',
      role: 'Software Engineer 2 (Backend & Infrastructure)',
      period: 'Aug 2023 – Oct 2024',
      bullets: [
        'Hardened SRE and distributed telemetry frameworks using ELK Stack and structured logging across microservices on RedHat Linux, slashing production incident resolution time.',
        'Diagnosed database performance bottlenecks, remodeling complex SQL queries, connection pooling, and table indexing for enterprise ordering systems to reduce backend server CPU load by 35%.',
        'Built resilient integration layers with tenacity-based exponential backoff and multi-provider fallback chains, guaranteeing zero data loss during upstream rate limit spikes.',
      ],
    },
    {
      company: 'Srijan Technologies',
      role: 'Software Engineer',
      period: 'Aug 2022 – Jul 2023',
      bullets: [
        'Integrated Apache Kafka-backed automated reconciliation engine and event retry logic to safely process high-volume financial transactions with zero data loss.',
        'Shipped resilient backend services integrating AWS ECS, Lambda, and Aurora PostgreSQL with comprehensive automated testing suites.',
      ]
    },
    {
      company: 'KOCO Schools',
      role: 'Full-Stack Developer',
      period: 'Oct 2021 – Jul 2022',
      bullets: [
        'Authored scalable backend architecture for multi-tenant educational platforms, synthesizing complex business logic into high-availability microservices.',
        'Formulated complex Python ETL scripts to migrate legacy relational database records across disparate schemas while preserving transactional data integrity.',
      ],
    },
    {
      company: 'Rubico IT Pvt Ltd',
      role: 'Software Developer',
      period: 'Sep 2019 – Sep 2021',
      bullets: [
        'Developed backend web systems and RESTful APIs, owning application infrastructure from database modeling through delivery and release readiness.',
        'Configured Linux server firewalls, OS security patch routines, and automated deployment pipelines across cloud environments.',
      ],
    },
  ],
  education: [
    {
      degree: 'Master of Computer Applications (MCA) — STEM',
      school: 'Uttaranchal University',
      period: '2016 – 2018',
    },
    {
      degree: 'Bachelor of Computer Applications (BCA) — STEM',
      school: 'Uttaranchal University',
      period: '2013 – 2016',
    },
  ],
};

async function main() {
  console.log('Generating Revolut-tailored HTML...');
  const html = fillAtsTemplate(revolutResume);
  
  const outputDir = path.resolve(process.cwd(), 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const htmlPath = path.join(outputDir, 'Akash_Kaintura_Revolut.html');
  const pdfPath = path.join(outputDir, 'Akash_Kaintura_Revolut_CV.pdf');

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`Saved HTML to: ${htmlPath}`);

  console.log('Rendering PDF via Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '12mm',
      bottom: '12mm',
      left: '12mm',
      right: '12mm',
    },
  });
  await browser.close();

  const stats = fs.statSync(pdfPath);
  console.log(`✅ PDF successfully generated: ${pdfPath} (${(stats.size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error('Failed to generate PDF:', err);
  process.exit(1);
});
