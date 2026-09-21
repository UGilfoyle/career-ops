'use client';

import { useState } from 'react';
import { Card, Tag, Button, Input, Modal, message, Badge, Tooltip } from 'antd';
import {
  Flame,
  Clock,
  Award,
  Copy,
  Check,
  Search,
  ExternalLink,
  ChevronRight,
  Terminal,
  Database,
  Server,
  Zap,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export type ExposureProject = {
  id: string;
  title: string;
  category: 'Backend' | 'Distributed Systems' | 'DevOps & SRE' | 'Data & Telemetry';
  difficulty: 'Intermediate' | 'Advanced' | 'Principal';
  estimatedMinutes: number;
  points: number;
  scenario: string;
  skillsTested: string[];
  resumeBullet: string;
  architectureSolution: string[];
  sampleRepo?: string;
};

const EXPOSURE_PROJECTS: ExposureProject[] = [
  {
    id: 'exp-oncall-broken-prod',
    title: "It's 2am. Production is broken. You're on call.",
    category: 'DevOps & SRE',
    difficulty: 'Advanced',
    estimatedMinutes: 90,
    points: 75,
    scenario:
      'Five cascading failures are hiding in a production-like microservices cluster: thread starvation, unindexed foreign key lock contention, and connection pool exhaustion under 25,000 req/s. Diagnose with PromQL, patch the hot paths, and write the postmortem.',
    skillsTested: ['Incident Response', 'PromQL', 'LogQL', 'On-call', 'Debugging', 'Postmortems'],
    resumeBullet:
      'Orchestrated incident response and root-cause analysis across production Kubernetes clusters using PromQL and LogQL, resolving connection pool exhaustion to cut MTTR from 45m to <12m and protecting 99.9% uptime.',
    architectureSolution: [
      'Investigate Prometheus p99 latency alerts and isolate saturated pods via PromQL rate() queries.',
      'Pinpoint database connection exhaustion via pg_stat_activity and tune PgBouncer max client connections.',
      'Deploy hotfix patch with connection pool keep-alives and backpressure circuit breaker.',
      'Publish blameless postmortem with timeline, root cause (unindexed foreign key lock), and preventive SLO alerts.',
    ],
  },
  {
    id: 'exp-db-resilience',
    title: 'Database Resilience: Replicas, Pooling, Slow Queries',
    category: 'Backend',
    difficulty: 'Advanced',
    estimatedMinutes: 100,
    points: 75,
    scenario:
      'Diagnose why PostgreSQL p99 latency spiked 12x at peak hour. Read queries are choking write transactions, and connection spikes exhaust worker memory. Implement read replica offloading, PgBouncer pooling, and rewrite queries with EXPLAIN ANALYZE.',
    skillsTested: ['PostgreSQL', 'Read Replicas', 'PgBouncer', 'Connection Pooling', 'EXPLAIN ANALYZE', 'Query Tuning'],
    resumeBullet:
      'Eliminated database lock contention and sub-second p99 latency spikes by implementing PgBouncer pooling, offloading reporting workloads to read replicas, and tuning complex SQL execution plans.',
    architectureSolution: [
      'Run EXPLAIN (ANALYZE, BUFFERS) to detect sequential table scans on 15M-row order tables.',
      'Introduce targeted composite indexes on (user_id, status, created_at) to eliminate in-memory sorts.',
      'Route readonly traffic through read replica pools using Prisma / TypeORM read-write splitting.',
      'Configure PgBouncer in transaction pooling mode with pool_size=25, dropping server memory load by 35%.',
    ],
  },
  {
    id: 'exp-rate-limiter',
    title: 'Distributed Rate Limiter on Kubernetes',
    category: 'Distributed Systems',
    difficulty: 'Advanced',
    estimatedMinutes: 120,
    points: 85,
    scenario:
      'Build an attack-hardened, multi-pod consistent sliding-window token bucket rate limiter in Node.js/TypeScript using atomic Redis Lua scripts. Must enforce tenant quotas across multiple replicas without race conditions.',
    skillsTested: ['Distributed Systems', 'Redis Lua', 'Token Bucket', 'Kubernetes', 'DDoS Mitigation', 'TypeScript'],
    resumeBullet:
      'Engineered an atomic sliding-window token bucket rate limiter in TypeScript using Redis Lua scripts across multi-pod Kubernetes clusters, enforcing per-tenant quotas with sub-2ms overhead under traffic spikes.',
    architectureSolution: [
      'Implement atomic Redis Lua script executing sliding-window log cleanup and token counting in a single round-trip.',
      'Wrap as Express/NestJS middleware extracting API keys / tenant IDs with IP fallback.',
      'Add fallback memory cache when Redis is temporarily degraded to maintain fail-open SLAs.',
      'Benchmark under simulated distributed DDoS using k6 at 20,000 req/sec across 4 pods.',
    ],
  },
  {
    id: 'exp-caching-strategy',
    title: 'Caching Strategy for a Slow API: Stampede Prevention',
    category: 'Backend',
    difficulty: 'Intermediate',
    estimatedMinutes: 75,
    points: 60,
    scenario:
      'A slow telemetry catalog API is crashing the backend when keys expire simultaneously. Implement probabilistic early expiration (XFetch algorithm) and distributed mutex locks with Redis to guarantee zero cache stampedes.',
    skillsTested: ['Redis', 'Cache Stampede Prevention', 'XFetch Algorithm', 'Distributed Mutex', 'ETag', 'REST API'],
    resumeBullet:
      'Architected a multi-tier Redis caching layer with probabilistic early expiration (XFetch) and distributed mutex locking to eliminate cache stampedes, slashing API response times by 68%.',
    architectureSolution: [
      'Detect hot-key expiration vulnerability where 500 simultaneous requests hit unindexed DB.',
      'Implement XFetch probabilistic early refresh algorithm: refresh key in background before expiry based on read delta.',
      'Apply distributed Redlock / single-flight promise deduplication for cold cache misses.',
      'Add HTTP 304 ETag response negotiation for zero payload transfer on unchanged resources.',
    ],
  },
  {
    id: 'exp-outbox-kafka',
    title: 'Event-Driven Outbox Pattern with Kafka & PostgreSQL',
    category: 'Distributed Systems',
    difficulty: 'Principal',
    estimatedMinutes: 110,
    points: 80,
    scenario:
      'Guarantee at-least-once message delivery between PostgreSQL business transactions and Apache Kafka event streams without unreliable dual-writes or 2-phase commits.',
    skillsTested: ['Kafka', 'Transactional Outbox', 'Debezium CDC', 'Idempotency', 'Dead-Letter Queues', 'PostgreSQL'],
    resumeBullet:
      'Architected an event-driven Transactional Outbox pipeline with Apache Kafka and Debezium CDC in PostgreSQL, ensuring at-least-once delivery and zero data loss on financial event streaming.',
    architectureSolution: [
      'Write business data and outbox event payload inside the same atomic PostgreSQL transaction.',
      'Configure Debezium CDC to read the PostgreSQL WAL (Write-Ahead Log) and stream events directly to Kafka.',
      'Implement consumer-side idempotency keys stored in Redis with 24h TTL to prevent duplicate processing.',
      'Add Dead-Letter Queue (DLQ) retry topics with exponential backoff for poison-pill handling.',
    ],
  },
  {
    id: 'exp-streaming-ingestion',
    title: 'High-Throughput Streaming Ingestion Pipeline (100k events/s)',
    category: 'Data & Telemetry',
    difficulty: 'Advanced',
    estimatedMinutes: 90,
    points: 75,
    scenario:
      'Ingest continuous IoT device telemetry at scale. Balance backpressure, batch database insertions, and eliminate event-loop blocking using worker threads or modern runtimes.',
    skillsTested: ['Node.js Streams', 'Bun / Worker Threads', 'Backpressure Control', 'Batch DB Insertion', 'PostgreSQL COPY'],
    resumeBullet:
      'Benchmarked and scaled an asynchronous telemetry ingestion pipeline handling 100k+ events/sec with memory-bounded backpressure streams and bulk PostgreSQL COPY operations at 99.9% uptime.',
    architectureSolution: [
      'Use high-performance HTTP stream consumers with backpressure pause/resume on saturated buffers.',
      'Batch incoming telemetry into micro-chunks (1,000 rows) and stream via PostgreSQL binary COPY protocol.',
      'Offload JSON payload validation to Worker Threads to keep the main event loop sub-5ms.',
      'Measure end-to-end ingestion latency with Prometheus histograms and Grafana telemetry dashboards.',
    ],
  },
];

export default function ExposurePanel({
  onWeaveBullet,
}: {
  onWeaveBullet?: (bullet: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<ExposureProject | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['All', 'Backend', 'Distributed Systems', 'DevOps & SRE', 'Data & Telemetry'];

  const filteredProjects = EXPOSURE_PROJECTS.filter((p) => {
    const matchesCat = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.scenario.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.skillsTested.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleCopyBullet = (project: ExposureProject) => {
    navigator.clipboard.writeText(project.resumeBullet);
    setCopiedId(project.id);
    message.success('Resume bullet copied! Ready to paste into Experience.');
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-md">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-400/30">
              <Flame size={14} className="text-amber-400 animate-pulse" />
              Skillmeet-Inspired Proof of Work
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
              Exposure: Production Engineering Challenges
            </h2>
            <p className="mt-1 text-sm text-slate-300 max-w-2xl">
              Solve production-grade incident and architectural crisis scenarios. Every completed challenge outputs a
              battle-tested, metric-verified resume bullet that recruiters and hiring managers respect.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur-sm border border-white/10">
              <div className="text-2xl font-black text-amber-400">24</div>
              <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Challenges</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur-sm border border-white/10">
              <div className="text-2xl font-black text-emerald-400">100%</div>
              <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">ATS Metrics</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur-sm border border-white/10">
              <div className="text-2xl font-black text-sky-400">Tier-1</div>
              <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wider">Signal</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                activeCategory === cat
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Input
            prefix={<Search size={14} className="text-slate-400 mr-1" />}
            placeholder="Search scenarios or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl py-1.5 text-xs"
            allowClear
          />
        </div>
      </div>

      {/* Grid of Projects */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
          >
            <div>
              {/* Header tags */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                  {project.category}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    project.difficulty === 'Principal'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : project.difficulty === 'Advanced'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {project.difficulty}
                </span>
              </div>

              {/* Title */}
              <h3 className="mt-3 text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {project.title}
              </h3>

              {/* Scenario */}
              <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                {project.scenario}
              </p>

              {/* Skills Tags */}
              <div className="mt-3 flex flex-wrap gap-1">
                {project.skillsTested.slice(0, 4).map((skill) => (
                  <span
                    key={skill}
                    className="rounded bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200"
                  >
                    {skill}
                  </span>
                ))}
                {project.skillsTested.length > 4 && (
                  <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                    +{project.skillsTested.length - 4}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <Clock size={12} className="text-slate-400" />
                  {project.estimatedMinutes}m
                </span>
                <span className="flex items-center gap-1 text-amber-600 font-bold">
                  <Award size={12} />
                  {project.points} pts
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Tooltip title="Copy verified resume bullet">
                  <button
                    onClick={() => handleCopyBullet(project)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    {copiedId === project.id ? (
                      <Check size={12} className="text-emerald-600" />
                    ) : (
                      <Copy size={12} className="text-slate-500" />
                    )}
                    <span>Bullet</span>
                  </button>
                </Tooltip>

                <button
                  onClick={() => setSelectedProject(project)}
                  className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-indigo-600 active:scale-95 transition-all"
                >
                  <span>Blueprint</span>
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Blueprint Detail Modal */}
      <Modal
        open={Boolean(selectedProject)}
        onCancel={() => setSelectedProject(null)}
        footer={null}
        width={720}
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Terminal size={18} className="text-indigo-600" />
            <span>{selectedProject?.title}</span>
          </div>
        }
      >
        {selectedProject && (
          <div className="space-y-5 pt-2">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">The Crisis Scenario</h4>
              <p className="mt-1 text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {selectedProject.scenario}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Skills Tested</h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedProject.skillsTested.map((s) => (
                  <Tag key={s} color="blue" className="rounded-md font-semibold text-xs py-0.5">
                    {s}
                  </Tag>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Production Architecture Blueprint
              </h4>
              <ol className="mt-2 space-y-2 list-decimal list-inside text-xs text-slate-700 font-medium">
                {selectedProject.architectureSolution.map((step, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="text-slate-800">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Resume Bullet Callout */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Award size={14} className="text-emerald-600" />
                  Verified ATS Resume Bullet (STAR+R)
                </span>
                <Button
                  size="small"
                  icon={copiedId === selectedProject.id ? <Check size={12} /> : <Copy size={12} />}
                  onClick={() => handleCopyBullet(selectedProject)}
                  className="text-xs font-semibold"
                >
                  {copiedId === selectedProject.id ? 'Copied' : 'Copy Bullet'}
                </Button>
              </div>
              <p className="mt-2 text-xs font-medium text-emerald-950 italic leading-relaxed">
                "{selectedProject.resumeBullet}"
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="primary" onClick={() => setSelectedProject(null)}>
                Close Blueprint
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
