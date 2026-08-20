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

console.log('companion-profile unit checks passed');
