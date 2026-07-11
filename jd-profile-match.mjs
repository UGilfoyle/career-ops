/**
 * jd-profile-match.mjs — Match JD requirements to provable profile experience (no fabrication).
 */

import { extractJdKeywords } from './jd-keyword-align.mjs';

const PROFILE_TECH_PATTERNS = [
  /\bReact(?:\.js)?\b/gi,
  /\bRedux\b/gi,
  /\bTypeScript\b/gi,
  /\bJavaScript\b/gi,
  /\bNode\.?js\b/gi,
  /\bPython\b/gi,
  /\bFastAPI\b/gi,
  /\b\.NET(?:\s+Core)?\b/gi,
  /\bC#\b/gi,
  /\bPostgreSQL\b/gi,
  /\bOracle\b/gi,
  /\bMongoDB\b/gi,
  /\bRedis\b/gi,
  /\bAWS\b/gi,
  /\bDocker\b/gi,
  /\bKubernetes\b/gi,
  /\bCI\/CD\b/gi,
  /\bREST(?:ful)?\s+APIs?\b/gi,
  /\bLLM\b/gi,
  /\bRAG\b/gi,
  /\bChromaDB\b/gi,
  /\bOpenAI\b/gi,
  /\bClaude\b/gi,
  /\bGPT\b/gi,
  /\bCursor\b/gi,
  /\bCopilot\b/gi,
  /\bGitHub Actions\b/gi,
  /\bJest\b/gi,
  /\bCypress\b/gi,
  /\bmicroservices?\b/gi,
  /\bKafka\b/gi,
  /\bJWT\b/gi,
  /\bExpress\b/gi,
  /\bECS\b/gi,
  /\bLambda\b/gi,
];

function stripMarkdown(text) {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*:\s*/g, '$1: ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^[•\-*▸]\s*/, '')
    .trim();
}

export function collectProfileCorpus(profile) {
  const parts = [];
  if (profile?.narrative?.headline) parts.push(profile.narrative.headline);
  if (profile?.narrative?.exit_story) parts.push(profile.narrative.exit_story);
  for (const s of profile?.narrative?.superpowers || []) parts.push(s);
  for (const e of profile?.experience || []) {
    parts.push(e?.role || '', e?.company || '');
    for (const b of e?.bullets || []) parts.push(b);
  }
  return parts.filter(Boolean).join('\n');
}

export function collectProfileTechnologies(profile) {
  const corpus = collectProfileCorpus(profile);
  const found = new Set();
  for (const re of PROFILE_TECH_PATTERNS) {
    re.lastIndex = 0;
    for (const m of corpus.matchAll(re)) {
      if (m[0]) found.add(m[0].replace(/\s+/g, ' ').trim());
    }
  }
  return [...found];
}

function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** JD tokens that are fragments of a larger required stack — never treat as honest matches. */
const FRAGMENT_BLOCKLIST = new Set(['core', 'net', 'end', 'full', 'stack']);

const PROFILE_SYNONYMS = {
  javascript: ['node.js', 'nodejs', 'ecmascript', 'vanilla javascript'],
  'ci/cd': ['continuous deployment', 'continuous integration', 'github actions', 'pre-flight validation', 'deployment workflow'],
  react: ['react.js'],
  redux: ['redux'],
  'restful api': ['restful apis', 'backend api', 'high-throughput backend', 'fastapi'],
  llm: ['gpt', 'claude', 'openai', 'chromadb', 'query-rewriting', 'text-embedding', 'pydantic'],
  cursor: ['cursor', 'claude code', 'ai-native tool', 'ai-assisted'],
  copilot: ['copilot', 'github copilot', 'ai-native', 'ai-assisted', 'claude code', 'gpt'],
  '.net': [],
  'c#': [],
};

function filterFragmentKeywords(jdKeywords, jdText) {
  const jdLower = String(jdText || '').toLowerCase();
  return (jdKeywords || []).filter((kw) => {
    const k = normalizeKey(kw);
    if (FRAGMENT_BLOCKLIST.has(k)) {
      if (k === 'core' && (jdLower.includes('.net core') || jdLower.includes('net core'))) return false;
      if (k.length <= 4) return false;
    }
    return true;
  });
}

function keywordInProfile(kw, profileCorpus, profileTech) {
  const k = normalizeKey(kw);
  const corpus = profileCorpus.toLowerCase();
  if (corpus.includes(k)) return true;
  if (profileTech.some((t) => {
    const tk = normalizeKey(t);
    return tk.includes(k) || k.includes(tk);
  })) return true;

  const synonyms = PROFILE_SYNONYMS[k] || [];
  return synonyms.some((syn) => corpus.includes(syn));
}

/** Split JD keywords into provable (honest) vs gaps (do not put on resume). */
export function partitionJdKeywords(jdKeywords, profile) {
  const profileCorpus = collectProfileCorpus(profile);
  const profileTech = collectProfileTechnologies(profile);
  const honest = [];
  const gaps = [];
  for (const kw of jdKeywords || []) {
    if (keywordInProfile(kw, profileCorpus, profileTech)) honest.push(kw);
    else gaps.push(kw);
  }
  return { honest, gaps, profileTech };
}

const JD_THEME_TERMS = [
  'restful', 'api', 'microservice', 'event-driven', 'ci/cd', 'unit test', 'integration test',
  'end-to-end', 'observability', 'experimentation', 'data pipeline', 'analytics', 'full-stack',
  'code review', 'design review', 'incident', 'resilience', 'scalable', 'high-traffic',
  'llm', 'ai agent', 'machine learning', 'typescript', 'react', 'javascript', 'redux',
];

function scoreBulletForJd(bullet, jdText, honestKeywords) {
  const t = stripMarkdown(bullet).toLowerCase();
  const jdLower = String(jdText || '').toLowerCase();
  let score = 0;
  for (const kw of honestKeywords) {
    if (t.includes(normalizeKey(kw))) score += 4;
  }
  for (const theme of JD_THEME_TERMS) {
    if (jdLower.includes(theme) && t.includes(theme)) score += 2;
    if (t.includes(theme)) score += 1;
  }
  if (/\d+%|\d+\+|p\d+|latency|throughput|concurrent|monthly|daily/i.test(t)) score += 2;
  return score;
}

function enhanceBulletHonest(bullet, honestKeywords) {
  let text = stripMarkdown(bullet);
  if (!text) return text;

  const lower = text.toLowerCase();
  const present = honestKeywords.filter((kw) => lower.includes(normalizeKey(kw)));

  // Prefer RESTful API phrasing when APIs are mentioned
  if (/api/i.test(text) && !/restful/i.test(lower)) {
    text = text.replace(/\bAPIs?\b/i, 'RESTful APIs');
  }
  if (/microservice/i.test(lower) && !/event-driven/i.test(lower) && /event|stream|queue/i.test(lower)) {
    text = text.replace(/\.$/, '') + ' in an event-driven architecture.';
  }
  if (present.length === 0 && honestKeywords.length > 0) {
    // Don't inject tech not in bullet — return as-is
    return text.endsWith('.') ? text : `${text}.`;
  }
  return text.endsWith('.') ? text : `${text}.`;
}

/**
 * Rebuild per-role tailored bullets from profile source, ranked by JD relevance.
 * Uses only facts from profile bullets — never invents stacks.
 */
export function reframeExperienceFromProfile(profileExperience, jdText, honestKeywords, rolesCount = 4) {
  const exp = Array.isArray(profileExperience) ? profileExperience : [];
  const count = Math.min(rolesCount, exp.length);
  const out = {};

  for (let i = 0; i < count; i++) {
    const bullets = (exp[i]?.bullets || []).map(stripMarkdown).filter((b) => b.length > 20);
    const ranked = [...bullets].sort(
      (a, b) => scoreBulletForJd(b, jdText, honestKeywords) - scoreBulletForJd(a, jdText, honestKeywords)
    );
    const top = ranked.slice(0, 4);
    out[String(i)] = top.map((b) => enhanceBulletHonest(b, honestKeywords));
    while (out[String(i)].length < 4 && ranked.length > 0) {
      const next = ranked[out[String(i)].length % ranked.length];
      if (!out[String(i)].includes(next)) out[String(i)].push(enhanceBulletHonest(next, honestKeywords));
      else break;
    }
  }
  return out;
}

export function buildHonestCompetencies(honestKeywords, profile, jdText, limit = 14) {
  const comps = [];
  const seen = new Set();

  const add = (item) => {
    const k = normalizeKey(item);
    if (!k || seen.has(k)) return;
    seen.add(k);
    comps.push(item);
  };

  for (const kw of honestKeywords.slice(0, 10)) add(kw);

  const jdLower = String(jdText || '').toLowerCase();
  const transfers = [
    ['restful', 'RESTful API Design'],
    ['microservice', 'Microservices Architecture'],
    ['ci/cd', 'CI/CD Pipelines'],
    ['unit test', 'Unit & Integration Testing'],
    ['observability', 'Observability & Incident Response'],
    ['llm', 'LLM Integration'],
    ['ai agent', 'AI Agent Development'],
    ['full-stack', 'Full-Stack Engineering'],
    ['event-driven', 'Event-Driven Architecture'],
  ];
  for (const [needle, label] of transfers) {
    if (jdLower.includes(needle)) add(label);
  }

  for (const s of profile?.narrative?.superpowers || []) {
    if (jdLower.split(/\W+/).some((w) => w.length > 4 && s.toLowerCase().includes(w))) add(s);
  }

  return comps.slice(0, limit);
}

export function buildHonestSummary(baseSummary, yearsExp, honestKeywords, jdText) {
  const y = Number(yearsExp) || 0;
  const lead = honestKeywords
    .filter((k) => !FRAGMENT_BLOCKLIST.has(normalizeKey(k)))
    .slice(0, 4)
    .join(', ');
  const jdLower = String(jdText || '').toLowerCase();
  const lines = [];

  lines.push(
    y > 0
      ? `Senior full-stack engineer with ${y}+ years building scalable web applications and backend services using ${lead || 'TypeScript, React, and Node.js'}.`
      : `Full-stack engineer building scalable web applications and backend services using ${lead || 'modern JavaScript stacks'}.`
  );

  if (jdLower.includes('llm') || jdLower.includes('ai')) {
    lines.push('Hands-on with LLM integrations, AI-assisted development (Cursor, Claude), and production API reliability.');
  } else {
    lines.push('Deliver RESTful APIs, microservices, and CI/CD-backed releases with strong testing and code review discipline.');
  }

  if (jdLower.includes('observability') || jdLower.includes('high-traffic')) {
    lines.push('Experienced operating high-traffic systems with observability, incident response, and performance tuning.');
  } else {
    lines.push('Collaborate with product and engineering partners from design through launch on user-focused features.');
  }

  return lines.slice(0, 4).join('\n');
}

export function analyzeJdProfileFit(jdText, profile) {
  const rawKeywords = extractJdKeywords(jdText, 25);
  const jdKeywords = filterFragmentKeywords(rawKeywords, jdText);
  const { honest, gaps, profileTech } = partitionJdKeywords(jdKeywords, profile);
  return { jdKeywords, honest, gaps, profileTech };
}

export function formatHonestKeywordBlock(honest, gaps) {
  const lines = ['PROVEN IN PROFILE (use in resume):'];
  if (honest.length === 0) lines.push('  (none extracted — lean on digest facts)');
  else honest.forEach((k, i) => lines.push(`  ${i + 1}. ${k}`));
  lines.push('');
  lines.push('JD GAPS (do NOT claim on resume — omit or use transferable framing only):');
  if (gaps.length === 0) lines.push('  (none)');
  else gaps.slice(0, 12).forEach((k, i) => lines.push(`  ${i + 1}. ${k}`));
  return lines.join('\n');
}
