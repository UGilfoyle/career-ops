import type { PracticePackJson } from './schema';
import { parsePracticePackJson, validatePracticePackJson } from './schema';

function withIds(
  items: Array<{ title: string; prompt: string; outline: string; difficulty?: string; stackHints?: string[]; starHint?: string }>,
  prefix: string,
) {
  return items.map((item, i) => ({
    id: `${prefix}${i + 1}`,
    title: item.title,
    prompt: item.prompt,
    outline: item.outline,
    ...(item.difficulty ? { difficulty: item.difficulty as 'easy' | 'medium' | 'hard' } : {}),
    ...(item.stackHints ? { stackHints: item.stackHints } : {}),
    ...(item.starHint ? { starHint: item.starHint } : {}),
  }));
}

/** Detect Oracle HCM / functional-admin JDs that should not become fake specialist quizzes. */
export function isLowFitFunctionalJd(jdText: string): boolean {
  const t = String(jdText || '').toLowerCase();
  const hcm =
    /\boracle\s+hcm\b/.test(t) ||
    /\bhcm\s+fusion\b/.test(t) ||
    /\bfusion\s+hcm\b/.test(t) ||
    /\balert\s+composer\b/.test(t) ||
    (/\bbip\b/.test(t) && /\boracle\b/.test(t)) ||
    (/\bdff\b/.test(t) && /\beff\b/.test(t)) ||
    (/\bjourney\b/.test(t) && /\boracle\b/.test(t));
  const backendSignal =
    /\bnode\.?js\b/.test(t) ||
    /\btypescript\b/.test(t) ||
    /\bpython\b/.test(t) ||
    /\bkubernetes\b/.test(t) ||
    /\bmicroservices?\b/.test(t) ||
    /\brest\s*api/.test(t);
  return hcm && !backendSignal;
}

/** Deterministic pack when LLM unavailable — still JD-flavored via keywords. */
export function buildDeterministicPack(opts: {
  jdText: string;
  company?: string;
  role?: string;
  keywords?: string[];
}): PracticePackJson {
  const company = opts.company || '';
  const role = opts.role || 'Software Engineer';
  const kws = (opts.keywords || []).slice(0, 8);
  const stack = kws.length ? kws.join(', ') : 'Node.js, TypeScript, AWS, PostgreSQL';
  const lowFit = isLowFitFunctionalJd(opts.jdText);
  const companyLabel = company || 'the company';

  const coding = withIds(
    [
      {
        title: 'Rate-limit an API',
        prompt: `Design a token-bucket rate limiter for a public REST API used in a ${role} interview at ${companyLabel}. Support per-user and per-IP limits.`,
        outline:
          'State bucket params → choose store (Redis/memory) → atomic refill → error shape (429 + Retry-After) → testing edge cases.',
        difficulty: 'medium',
        stackHints: kws.slice(0, 4),
      },
      {
        title: 'Idempotent webhooks',
        prompt: 'Implement idempotent webhook processing so duplicate delivery never double-applies a side effect.',
        outline:
          'Idempotency key → store outcome → unique constraint → retry-safe handlers → poison message strategy.',
        difficulty: 'medium',
        stackHints: kws.slice(0, 4),
      },
      {
        title: 'SQL hot path',
        prompt: `Given high read traffic on a relational orders table (${stack}), write a query + index plan for “open orders by user in last 7 days”.`,
        outline:
          'Selectivity → composite index → covering vs heap fetch → EXPLAIN expectations → pagination cursor.',
        difficulty: 'easy',
        stackHints: kws.slice(0, 4),
      },
      {
        title: 'Concurrency / races',
        prompt: 'Two workers claim the same job from a queue. Show how you prevent double processing.',
        outline:
          'COMPARE-AND-SET / FOR UPDATE SKIP LOCKED → lease TTL → heartbeat → reclaim → observability.',
        difficulty: 'hard',
        stackHints: kws.slice(0, 4),
      },
      {
        title: 'Cache invalidation',
        prompt: `Cache product catalog responses. Describe invalidation when admins update a SKU (${stack}).`,
        outline:
          'TTL vs event-driven → key layout → stampede protection → consistency vs latency tradeoff.',
        difficulty: 'medium',
        stackHints: kws.slice(0, 4),
      },
      {
        title: 'Streaming responses',
        prompt: 'Stream long-running results to a client without buffering the full payload in memory.',
        outline:
          'SSE/chunked HTTP → backpressure → cancel on disconnect → timeouts → partial failure UX.',
        difficulty: 'medium',
        stackHints: kws.slice(0, 4),
      },
    ].slice(0, kws.some((k) => /kafka|queue|event/i.test(k)) ? 7 : 6),
    'c',
  );

  if (kws.some((k) => /kafka|queue|event/i.test(k))) {
    coding.push({
      id: `c${coding.length + 1}`,
      title: 'Exactly-once-ish messaging',
      prompt:
        'Consumer processes Kafka (or similar) events that update a balance. How do you avoid lost/dup updates?',
      outline: 'At-least-once reality → idempotent writes → transactional outbox → ordering keys.',
      difficulty: 'hard',
      stackHints: kws.slice(0, 4),
    });
  }

  const systemDesign = withIds(
    [
      {
        title: 'Job application tracker',
        prompt: `Design a multi-tenant job pipeline service for ${companyLabel} candidates — ingest, score, and notify. Cap at ~50k users.`,
        outline:
          'Entities → write path → async scoring → notification fanout → storage choices → failure modes.',
      },
      {
        title: 'CI/CD for microservices',
        prompt: 'Design deploy pipeline with staging, canary, and rollback for Node/Python services on AWS.',
        outline: 'Artifacts → env promotion → health checks → canary metrics → auto rollback → secrets.',
      },
      {
        title: 'Observability slice',
        prompt: 'Design logs, metrics, and traces for an API that must hit p95 < 200ms.',
        outline: 'RED/USE metrics → structured logs → trace propagation → SLOs → on-call dashboards.',
      },
    ],
    'sd',
  );

  const behavioral = withIds(
    [
      {
        title: 'Ownership under ambiguity',
        prompt: 'Tell a STAR story where requirements were unclear and you still shipped a production change.',
        outline: 'Situation → how you clarified → decision you owned → measurable result → what you’d repeat.',
        starHint: 'Lead with the metric / outcome, then expand actions.',
      },
      {
        title: 'Incident response',
        prompt: 'Describe a production incident you mitigated. What was your first 15 minutes?',
        outline: 'Detect → mitigate → communicate → root cause → prevention (tests/alerts/runbooks).',
        starHint: 'Show calm triage order before heroics.',
      },
      {
        title: 'Disagreement with a peer',
        prompt: 'When you disagreed on architecture, how did you resolve it without politics?',
        outline: 'Data/tradeoffs → experiment/spike → decision record → relationship aftermath.',
        starHint: 'Emphasize tradeoffs written down, not who “won”.',
      },
      {
        title: 'Mentoring / quality bar',
        prompt: 'Give an example of raising code review or testing standards on a team.',
        outline: 'Baseline → change introduced → adoption → outcome on bugs/velocity.',
        starHint: 'Quantify quality lift if possible.',
      },
    ],
    'b',
  );

  return parsePracticePackJson({
    company,
    role,
    keywords: kws,
    fit: {
      tier: lowFit ? 'low' : kws.length >= 4 ? 'strong' : 'partial',
      note: lowFit
        ? 'This JD looks Oracle HCM / functional-heavy. Pack stays on general backend/platform interview skills — not Fusion BIP/Alert Composer trivia.'
        : `Practice pack tuned for ${role}${company ? ` at ${company}` : ''} using stack signals: ${stack}.`,
    },
    coding: coding.slice(0, 8),
    systemDesign,
    behavioral,
  });
}

/** Soft normalize LLM JSON → strict pack or null. */
export function coercePracticePack(raw: unknown): PracticePackJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const normalizeList = (keyA: string, keyB: string, prefix: string) => {
    const arr = (Array.isArray(o[keyA]) ? o[keyA] : Array.isArray(o[keyB]) ? o[keyB] : []) as unknown[];
    return arr
      .map((item, i) => {
        if (!item || typeof item !== 'object') return null;
        const it = item as Record<string, unknown>;
        const title = String(it.title || '').trim();
        const prompt = String(it.prompt || it.question || '').trim();
        const outline = String(it.outline || it.hint || it.hints || '').trim();
        if (title.length < 3 || prompt.length < 10 || outline.length < 8) return null;
        const difficultyRaw = String(it.difficulty || '').trim().toLowerCase();
        const difficulty =
          difficultyRaw === 'easy' || difficultyRaw === 'medium' || difficultyRaw === 'hard'
            ? difficultyRaw
            : undefined;
        return {
          id: String(it.id || `${prefix}${i + 1}`).slice(0, 64),
          title: title.slice(0, 200),
          prompt: prompt.slice(0, 4000),
          outline: outline.slice(0, 4000),
          ...(difficulty ? { difficulty } : {}),
          ...(Array.isArray(it.stackHints)
            ? { stackHints: it.stackHints.map(String).slice(0, 12) }
            : {}),
          ...(it.starHint ? { starHint: String(it.starHint).slice(0, 1000) } : {}),
        };
      })
      .filter(Boolean);
  };

  const coding = normalizeList('coding', 'dsa', 'c');
  const systemDesign = normalizeList('systemDesign', 'system_design', 'sd');
  const behavioral = normalizeList('behavioral', 'star', 'b');

  const candidate = {
    company: String(o.company || ''),
    role: String(o.role || ''),
    keywords: Array.isArray(o.keywords)
      ? o.keywords.map((k) => String(k || '').trim()).filter(Boolean).slice(0, 30)
      : [],
    fit: o.fit,
    coding,
    systemDesign,
    behavioral,
  };

  const v = validatePracticePackJson(candidate);
  return v.ok && v.data ? v.data : null;
}
