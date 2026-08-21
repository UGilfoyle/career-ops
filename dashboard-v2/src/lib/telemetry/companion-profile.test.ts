import assert from 'node:assert/strict';

/** Mirror of unwrapResumeContext for strip-types unit test (no path aliases). */
function unwrapResumeContext(value: unknown): Record<string, unknown> {
  let parsed: unknown = value;
  for (let depth = 0; depth < 3 && typeof parsed === 'string'; depth += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const outer = { ...(parsed as Record<string, unknown>) };
  for (const key of ['resume_context', 'profile']) {
    let nested = outer[key];
    if (typeof nested === 'string') {
      try {
        nested = JSON.parse(nested);
      } catch {
        nested = null;
      }
    }
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      delete outer[key];
      return { ...outer, ...(nested as Record<string, unknown>) };
    }
  }
  return outer;
}

const nested = unwrapResumeContext({
  resume_context: {
    candidate: { full_name: 'Akash Kaintura', github: 'github.com/UGilfoyle' },
    narrative: { headline: 'Lead Backend' },
  },
});
assert.equal((nested.candidate as { full_name?: string })?.full_name, 'Akash Kaintura');
assert.equal((nested.narrative as { headline?: string })?.headline, 'Lead Backend');

const flat = unwrapResumeContext({ candidate: { full_name: 'Jane' } });
assert.equal((flat.candidate as { full_name?: string })?.full_name, 'Jane');

function cleanCompanionSummary(text) {
  let s = String(text || '').trim();
  if (!s) return null;
  s = s.replace(/^(\s*\([^)]{2,90}\)\s*)+/g, '').trim();
  s = s.replace(/^[.\u2026]+\s*/, '').trim();
  s = s
    .replace(
      /\s*\((?:[A-Za-z0-9.+#/\-]+(?:\s+[A-Za-z0-9.+#/\-]+)*(?:,\s*)?){2,}\)\.?\s*$/g,
      '',
    )
    .trim();
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (!s || s.length < 24) return null;
  return s.length > 420 ? `${s.slice(0, 417)}…` : s;
}

const cleaned = cleanCompanionSummary(
  '(WebSockets, Jenkins, .NET) (CI/CD) (GitHub Actions, Kubernetes, GraphQL) (unit testing, JavaScript) (GCP) (Node.js, Python). 6+ years building production-grade distributed systems for consumer and enterprise platforms, with measurable P95 latency gains and hands-on incident ownership (DynamoDB, REST API, Azure).',
);
assert.ok(cleaned && cleaned.startsWith('6+ years'), `stripped paren spam (got ${cleaned})`);
assert.ok(!cleaned.includes('WebSockets'), 'no leading skill dump');
assert.ok(!cleaned.includes('DynamoDB'), 'no trailing skill dump');

console.log('companion-profile unit checks passed');
