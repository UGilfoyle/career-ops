import { classifyCompany } from './gcc-classify.mjs';

const SCOPE_KEYWORDS = [
  'platform', 'global okr', 'reliability', 'telemetry', 'product ownership',
  'infrastructure', 'ownership', 'scalability', 'global team', 'end-to-end',
  'production systems', 'sre', 'observability', 'architecture',
];

const DOMAIN_KEYWORDS = [
  'fintech', 'upi', 'payments', 'ev ', 'electric vehicle', 'climate',
  'cyber', 'cybersecurity', 'compliance', 'data platform', 'machine learning',
  'artificial intelligence', 'genai', 'llm', 'risk', 'fraud',
];

const EXPANSION_KEYWORDS = [
  'gcc', 'global capability', 'captain', 'captive', 'engineering center',
  'technology center', 'india center', 'india expansion', 'new center',
  'global in-house', 'parent company',
];

const HIRING_KEYWORDS = [
  'multiple openings', 'we are hiring', 'join our team', 'open roles',
  'scaling the team', 'build the team', 'hiring across', 'several positions',
];

const LEADERSHIP_KEYWORDS = [
  'vp ', 'vice president', 'director', 'head of', 'chief ', 'cxo',
  'senior director', 'reporting to', 'leadership team',
];

function hitAny(text, keywords) {
  const hits = keywords.filter((kw) => text.includes(kw));
  return { hit: hits.length > 0, evidence: hits.slice(0, 3) };
}

/**
 * Score GCC Signal Engine (0–5) from company, title, and optional JD text.
 * @param {{ company?: string, title?: string, jdText?: string, companyType?: string }} input
 */
export function scoreGccSignals({ company = '', title = '', jdText = '', companyType }) {
  const resolvedType = companyType || classifyCompany(company);
  const text = `${company} ${title} ${jdText}`.toLowerCase();

  const signals = [];

  // 1. Expansion fuel — strong if known GCC employer; weak if expansion keywords in text
  const expansion = hitAny(text, EXPANSION_KEYWORDS);
  const expansionHit = resolvedType === 'GCC' || expansion.hit;
  signals.push({
    id: 'expansion_fuel',
    name: 'Expansion fuel',
    hit: expansionHit,
    evidence: resolvedType === 'GCC'
      ? ['Known GCC / captive employer']
      : expansion.evidence,
  });

  // 2. Hiring velocity — heuristic from JD language (full check needs careers page scrape)
  const hiring = hitAny(text, HIRING_KEYWORDS);
  const seniorRole = /\b(senior|staff|principal|lead)\b/i.test(title);
  const hiringHit = hiring.hit || (resolvedType === 'GCC' && seniorRole);
  signals.push({
    id: 'hiring_velocity',
    name: 'Hiring velocity',
    hit: hiringHit,
    evidence: hiring.evidence.length
      ? hiring.evidence
      : hiringHit && resolvedType === 'GCC'
        ? ['GCC employer + senior IC role']
        : [],
  });

  // 3. Scope language
  const scope = hitAny(text, SCOPE_KEYWORDS);
  signals.push({
    id: 'scope_language',
    name: 'Scope language',
    hit: scope.hit,
    evidence: scope.evidence,
  });

  // 4. Leadership signals
  const leadership = hitAny(text, LEADERSHIP_KEYWORDS);
  signals.push({
    id: 'leadership_signals',
    name: 'Leadership signals',
    hit: leadership.hit,
    evidence: leadership.evidence,
  });

  // 5. Future domains
  const domains = hitAny(text, DOMAIN_KEYWORDS);
  signals.push({
    id: 'future_domains',
    name: 'Future domains',
    hit: domains.hit,
    evidence: domains.evidence,
  });

  const score = signals.filter((s) => s.hit).length;
  const highValue = score >= 3 && resolvedType === 'GCC';

  return {
    score,
    highValue,
    companyType: resolvedType,
    signals,
    recommendation: highValue
      ? 'High-value GCC target — prioritize curated outreach over blind Apply'
      : score >= 3
        ? 'Strong GCC signals — worth targeted outreach'
        : resolvedType === 'GCC'
          ? 'GCC employer but weak signals — research hiring velocity before investing time'
          : 'Not a priority GCC target',
  };
}

export function formatGccSignalReport(result) {
  const lines = [
    `**GCC Signal Score:** ${result.score}/5`,
    `**High-Value GCC Target:** ${result.highValue ? 'Yes' : 'No'}`,
    `**Company Type:** ${result.companyType}`,
    `**Recommendation:** ${result.recommendation}`,
    '',
    '| Signal | Hit | Evidence |',
    '|--------|-----|----------|',
  ];
  for (const s of result.signals) {
    const ev = s.evidence.length ? s.evidence.join(', ') : '—';
    lines.push(`| ${s.name} | ${s.hit ? '✓' : '—'} | ${ev} |`);
  }
  return lines.join('\n');
}
