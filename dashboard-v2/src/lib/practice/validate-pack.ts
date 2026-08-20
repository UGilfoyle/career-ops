import type { PracticePackJson } from './schema';
import { parsePracticePackJson, validatePracticePackJson } from './schema';

export const PRACTICE_CODING_MIN = 8;
export const PRACTICE_SYSTEM_DESIGN_MIN = 5;
export const PRACTICE_BEHAVIORAL_MIN = 7;

type PromptItem = {
  id?: string;
  title: string;
  prompt: string;
  outline: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  stackHints?: string[];
  starHint?: string;
};

function withIds(
  items: Array<{
    title: string;
    prompt: string;
    outline: string;
    difficulty?: string;
    stackHints?: string[];
    starHint?: string;
  }>,
  prefix: string,
): PromptItem[] {
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

function codingBank(role: string, companyLabel: string, stack: string, kws: string[]): PromptItem[] {
  const hints = kws.slice(0, 4);
  return withIds(
    [
      {
        title: 'Rate-limit an API',
        prompt: `Design a token-bucket rate limiter for a public REST API used in a ${role} interview at ${companyLabel}. Support per-user and per-IP limits.`,
        outline:
          'State bucket params → choose store (Redis/memory) → atomic refill → error shape (429 + Retry-After) → testing edge cases.',
        difficulty: 'medium',
        stackHints: hints,
      },
      {
        title: 'Idempotent webhooks',
        prompt: 'Implement idempotent webhook processing so duplicate delivery never double-applies a side effect.',
        outline:
          'Idempotency key → store outcome → unique constraint → retry-safe handlers → poison message strategy.',
        difficulty: 'medium',
        stackHints: hints,
      },
      {
        title: 'SQL hot path',
        prompt: `Given high read traffic on a relational orders table (${stack}), write a query + index plan for “open orders by user in last 7 days”.`,
        outline:
          'Selectivity → composite index → covering vs heap fetch → EXPLAIN expectations → pagination cursor.',
        difficulty: 'easy',
        stackHints: hints,
      },
      {
        title: 'Concurrency / races',
        prompt: 'Two workers claim the same job from a queue. Show how you prevent double processing.',
        outline:
          'COMPARE-AND-SET / FOR UPDATE SKIP LOCKED → lease TTL → heartbeat → reclaim → observability.',
        difficulty: 'hard',
        stackHints: hints,
      },
      {
        title: 'Cache invalidation',
        prompt: `Cache product catalog responses. Describe invalidation when admins update a SKU (${stack}).`,
        outline:
          'TTL vs event-driven → key layout → stampede protection → consistency vs latency tradeoff.',
        difficulty: 'medium',
        stackHints: hints,
      },
      {
        title: 'Streaming responses',
        prompt: 'Stream long-running results to a client without buffering the full payload in memory.',
        outline:
          'SSE/chunked HTTP → backpressure → cancel on disconnect → timeouts → partial failure UX.',
        difficulty: 'medium',
        stackHints: hints,
      },
      {
        title: 'Exactly-once-ish messaging',
        prompt:
          'Consumer processes Kafka (or similar) events that update a balance. How do you avoid lost/dup updates?',
        outline: 'At-least-once reality → idempotent writes → transactional outbox → ordering keys.',
        difficulty: 'hard',
        stackHints: hints,
      },
      {
        title: 'Auth session design',
        prompt: `Design access + refresh tokens for a ${role} API at ${companyLabel}. Cover rotation, revocation, and multi-device logout.`,
        outline: 'JWT vs opaque → refresh store → rotation → revoke list → CSRF/XSS tradeoffs.',
        difficulty: 'medium',
        stackHints: hints,
      },
      {
        title: 'Pagination at scale',
        prompt: 'Implement cursor pagination for a feed that can grow past 10M rows without OFFSET cliffs.',
        outline: 'Stable sort key → opaque cursor → tie-breakers → deleted rows → total-count policy.',
        difficulty: 'easy',
        stackHints: hints,
      },
      {
        title: 'Backoff + retries',
        prompt: `Write a resilient HTTP client retry helper for ${stack} services (timeouts, 429, 5xx).`,
        outline: 'Idempotent methods only → jittered exponential backoff → budget → circuit break.',
        difficulty: 'easy',
        stackHints: hints,
      },
    ],
    'c',
  );
}

function systemDesignBank(role: string, companyLabel: string, stack: string): PromptItem[] {
  return withIds(
    [
      {
        title: 'Job application tracker',
        prompt: `Design a multi-tenant job pipeline service for ${companyLabel} candidates — ingest, score, and notify. Cap at ~50k users.`,
        outline:
          'Entities → write path → async scoring → notification fanout → storage choices → failure modes.',
      },
      {
        title: 'CI/CD for microservices',
        prompt: `Design deploy pipeline with staging, canary, and rollback for ${stack || 'Node/Python'} services on AWS.`,
        outline: 'Artifacts → env promotion → health checks → canary metrics → auto rollback → secrets.',
      },
      {
        title: 'Observability slice',
        prompt: 'Design logs, metrics, and traces for an API that must hit p95 < 200ms.',
        outline: 'RED/USE metrics → structured logs → trace propagation → SLOs → on-call dashboards.',
      },
      {
        title: 'Notification fanout',
        prompt: `Design email/push notifications for ${companyLabel} that stay under provider rate limits during spikes.`,
        outline: 'Queue → batching → priority → DLQ → idempotent send → user prefs.',
      },
      {
        title: 'Feature flags + config',
        prompt: `Design a feature-flag service used by ${role} teams for gradual rollouts and kill switches.`,
        outline: 'Eval latency → caching → targeting rules → audit → fail-open vs fail-closed.',
      },
      {
        title: 'Search / ranking slice',
        prompt: 'Design search over job postings with filters, relevance, and fresh indexing under 1 minute.',
        outline: 'Index model → sync from OLTP → ranking signals → pagination → stale reads.',
      },
    ],
    'sd',
  );
}

function behavioralBank(role: string, companyLabel: string): PromptItem[] {
  return withIds(
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
      {
        title: 'Cross-team delivery',
        prompt: `Describe shipping a feature that needed another team’s API (relevant to ${role} at ${companyLabel}).`,
        outline: 'Contract → timeline risk → escalation → fallback → launch result.',
        starHint: 'Show how you unblocked without burning bridges.',
      },
      {
        title: 'Tech debt tradeoff',
        prompt: 'Tell a story where you chose speed over perfect architecture — or the reverse. Why?',
        outline: 'Constraint → option set → decision → cost paid later → learning.',
        starHint: 'Be honest about the debt you accepted.',
      },
      {
        title: 'Failure you owned',
        prompt: 'Share a mistake that reached production. What did you change afterward?',
        outline: 'What broke → your ownership → customer impact → systemic fix.',
        starHint: 'Own the miss; end on prevention, not blame.',
      },
      {
        title: 'Performance win',
        prompt: 'Walk through a latency or cost optimization you led end-to-end.',
        outline: 'Baseline metric → hypothesis → change → measured delta → rollout.',
        starHint: 'Numbers first: before/after.',
      },
    ],
    'b',
  );
}

function padSection(
  existing: PromptItem[],
  bank: PromptItem[],
  min: number,
  prefix: string,
): PromptItem[] {
  const out = [...existing];
  const seen = new Set(out.map((i) => i.title.toLowerCase()));
  let n = out.length;
  for (const item of bank) {
    if (out.length >= min) break;
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    n += 1;
    out.push({ ...item, id: `${prefix}${n}` });
  }
  // If still short (unlikely), clone with suffix ids
  let extra = 0;
  while (out.length < min && bank.length > 0) {
    const src = bank[extra % bank.length];
    extra += 1;
    n += 1;
    out.push({
      ...src,
      id: `${prefix}${n}`,
      title: `${src.title} (${extra})`,
    });
  }
  return out.slice(0, Math.max(min, out.length));
}

/** Deterministic pack when LLM unavailable — always ≥20 questions (8+5+7). */
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

  const coding = codingBank(role, companyLabel, stack, kws).slice(0, PRACTICE_CODING_MIN);
  const systemDesign = systemDesignBank(role, companyLabel, stack).slice(
    0,
    PRACTICE_SYSTEM_DESIGN_MIN,
  );
  const behavioral = behavioralBank(role, companyLabel).slice(0, PRACTICE_BEHAVIORAL_MIN);

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
    coding,
    systemDesign,
    behavioral,
  });
}

/**
 * Soft normalize LLM JSON → strict pack.
 * Pads short sections from the deterministic bank so packs always meet 8+5+7.
 */
export function coercePracticePack(
  raw: unknown,
  padOpts?: { jdText?: string; company?: string; role?: string; keywords?: string[] },
): PracticePackJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const normalizeList = (keyA: string, keyB: string, prefix: string): PromptItem[] => {
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
        } as PromptItem;
      })
      .filter(Boolean) as PromptItem[];
  };

  let coding = normalizeList('coding', 'dsa', 'c');
  let systemDesign = normalizeList('systemDesign', 'system_design', 'sd');
  let behavioral = normalizeList('behavioral', 'star', 'b');

  const company = String(o.company || padOpts?.company || '');
  const role = String(o.role || padOpts?.role || 'Software Engineer');
  const keywords = Array.isArray(o.keywords)
    ? o.keywords.map((k) => String(k || '').trim()).filter(Boolean).slice(0, 30)
    : padOpts?.keywords || [];
  const stack = keywords.length ? keywords.join(', ') : 'Node.js, TypeScript, AWS, PostgreSQL';
  const companyLabel = company || 'the company';

  coding = padSection(
    coding,
    codingBank(role, companyLabel, stack, keywords),
    PRACTICE_CODING_MIN,
    'c',
  ).slice(0, 10);
  systemDesign = padSection(
    systemDesign,
    systemDesignBank(role, companyLabel, stack),
    PRACTICE_SYSTEM_DESIGN_MIN,
    'sd',
  ).slice(0, 6);
  behavioral = padSection(
    behavioral,
    behavioralBank(role, companyLabel),
    PRACTICE_BEHAVIORAL_MIN,
    'b',
  ).slice(0, 8);

  const candidate = {
    company,
    role,
    keywords,
    fit: o.fit,
    coding,
    systemDesign,
    behavioral,
  };

  const v = validatePracticePackJson(candidate);
  if (v.ok && v.data) return v.data;

  // Last resort: full deterministic pack
  try {
    return buildDeterministicPack({
      jdText: padOpts?.jdText || '',
      company,
      role,
      keywords,
    });
  } catch {
    return null;
  }
}
