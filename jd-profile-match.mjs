/**
 * jd-profile-match.mjs — Match JD requirements to provable profile experience (no fabrication).
 */

import {
  extractJdKeywords,
  extractJdTechKeywords,
  isJunkKeyword,
  isWeavableKeyword,
  isWeaveableNounPhrase,
  isApprovedSkillPhrase,
  isEditorIdeTool,
  cleanSkillToken,
  keywordAppearsInJd,
  isMethodologySkillPhrase,
} from './jd-keyword-align.mjs';
import { isAwsServiceCrumb, isUnprovenLanguageSkill } from './resume-skills-html.mjs';
import {
  explodeWallOfTextBullets,
  parseTenureMonths,
  bulletsBudgetForRole,
  preferSourceIfThin,
  elevateBulletForEmployer,
} from './resume-quality.mjs';

const PROFILE_TECH_PATTERNS = [
  /\bReact(?:\.js)?\b/gi,
  /\bRedux\b/gi,
  /\bTypeScript\b/gi,
  /\bJavaScript\b/gi,
  /\bNode\.?js\b/gi,
  /\bBun\b/gi,
  /\bPython\b/gi,
  /\bFastAPI\b/gi,
  /\b\.NET(?:\s+Core)?\b/gi,
  /\bC#\b/gi,
  /\bPostgreSQL\b/gi,
  /\bOracle\b/gi,
  /\bMongoDB\b/gi,
  /\bRedis\b/gi,
  /\bAWS\b/gi,
  /\bTerraform\b/gi,
  /\bCloudFormation\b/gi,
  /\bCloudWatch\b/gi,
  /\bBoto3\b/gi,
  /\bIAM\b/gi,
  /\bVPC\b/gi,
  /\bDocker\b/gi,
  /\bKubernetes\b/gi,
  /\bCI\/CD\b/gi,
  /\bLinux\b/gi,
  /\bJenkins\b/gi,
  /\bAzure\b/gi,
  /\bGit\b/gi,
  /\bJIRA\b/gi,
  /\bREST(?:ful)?\s+APIs?\b/gi,
  /\bLLM\b/gi,
  /\bRAG\b/gi,
  /\bChromaDB\b/gi,
  /\bOpenAI\b/gi,
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

function escapeRe(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordInProfile(kw, profileCorpus, profileTech) {
  const k = normalizeKey(kw);
  if (!k) return false;
  const corpus = profileCorpus.toLowerCase();
  // Short tokens (ORM, ML, Go…) must use word boundaries — "orm" ⊆ "performance"
  if (k.length <= 3) {
    const re = new RegExp(`\\b${escapeRe(k)}\\b`, 'i');
    if (re.test(corpus)) return true;
  } else if (new RegExp(`(?:^|[^a-z0-9.+#])${escapeRe(k)}(?:[^a-z0-9.+#]|$)`).test(corpus)) {
    return true;
  }
  if (profileTech.some((t) => {
    const tk = normalizeKey(t);
    if (!tk) return false;
    if (tk === k) return true;
    // Never treat "express" as proof of "devexpress" (or the reverse)
    if (k.length <= 3 || tk.length <= 3) {
      return new RegExp(`\\b${escapeRe(k)}\\b`, 'i').test(tk)
        || new RegExp(`\\b${escapeRe(tk)}\\b`, 'i').test(k);
    }
    // Whole-token containment only (word-ish boundaries), not raw substring
    const bound = (hay, needle) =>
      new RegExp(`(?:^|[^a-z0-9.+#])${escapeRe(needle)}(?:[^a-z0-9.+#]|$)`).test(hay);
    return bound(tk, k) || bound(k, tk);
  })) return true;

  const synonyms = PROFILE_SYNONYMS[k] || [];
  if (synonyms.some((syn) => corpus.includes(syn))) return true;

  // Multi-word phrases count as proven when every significant token appears in
  // the profile corpus — "event-driven architecture" is honest when the CV shows
  // both "event-driven" and "architecture", even if never adjacent.
  const tokens = k.split(/[^a-z0-9+#.]+/).filter((t) => t.length >= 4);
  if (tokens.length >= 2 && tokens.every((t) => corpus.includes(t))) return true;
  return false;
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
  'etl', 'reconcil', 'validat', 'warehouse', 'oracle', 'sql', 'pandas', 'schema',
  'data integrity', 'migration', 'staging', 'scd', 'window function',
  'linux', 'python', 'jenkins', 'embedded', 'satellite', 'socket', 'gdb', 'valgrind',
  'multi-thread', 'multi-process', 'agile', 'scrum', 'c++',
  'azure', 'kafka', 'telemetry', 'iot', 'webhook', 'oauth', 'kubernetes', 'integration',
];

function themeInText(hay, theme) {
  const h = String(hay || '').toLowerCase();
  const th = String(theme || '').toLowerCase();
  if (!h || !th) return false;
  if (th === 'c++') return /c\+\+/.test(h);
  if (th.length <= 3) return new RegExp(`\\b${escapeRe(th)}\\b`, 'i').test(h);
  return h.includes(th);
}

function scoreBulletForJd(bullet, jdText, honestKeywords) {
  const t = stripMarkdown(bullet).toLowerCase();
  const jdLower = String(jdText || '').toLowerCase();
  let score = 0;
  for (const kw of honestKeywords) {
    if (t.includes(normalizeKey(kw))) score += 4;
  }
  for (const theme of JD_THEME_TERMS) {
    if (themeInText(jdLower, theme) && themeInText(t, theme)) score += 3;
  }
  const offJdLangs = [
    ['typescript', /\btypescript\b/i],
    ['react', /\breact(?:\.js)?\b/i],
    ['node.js', /\bnode\.?js\b/i],
    ['javascript', /\bjavascript\b/i],
    ['fastapi', /\bfastapi\b/i],
    ['bun', /\bbun\b/i],
    ['graphql', /\bgraphql\b/i],
    ['next.js', /\bnext\.?js\b/i],
    ['python', /\bpython\b/i],
  ];
  for (const [name, re] of offJdLangs) {
    if (re.test(t) && !keywordAppearsInJd(name, jdText)) score -= 5;
  }
  const jdBoosts = [
    ['kafka', /\bkafka\b/i],
    ['azure', /\bazure\b/i],
    ['telemetry', /\btelemetry\b/i],
    ['iot', /\biot\b/i],
    ['webhook', /\bwebhook/i],
    ['kubernetes', /\bkubernetes\b|\bk8s\b/i],
    ['postgres', /\bpostgres/i],
    ['oauth', /\boauth/i],
    ['linux', /\blinux\b/i],
  ];
  for (const [name, re] of jdBoosts) {
    if (re.test(t) && themeInText(jdLower, name === 'postgres' ? 'postgres' : name)) score += 4;
  }
  if (/\d+%|\d+\+|p\d+|latency|throughput|concurrent|monthly|daily/i.test(t)) score += 2;
  return score;
}

function enhanceBulletHonest(bullet, honestKeywords, company = '') {
  let text = stripMarkdown(bullet);
  if (!text) return text;

  // Weak openings → strong action verbs (Zety / SuperGrok bar)
  text = text
    .replace(/^As an?\s+[^,]{2,60},\s*/i, '')
    .replace(/^I was responsible for\s+/i, 'Owned ')
    .replace(/^I am responsible for\s+/i, 'Own ')
    .replace(/^I also worked closely with\s+/i, 'Partnered with ')
    .replace(/^I worked closely with\s+/i, 'Partnered with ')
    .replace(/^My work involved\s+/i, 'Delivered ')
    .replace(/^I also\s+/i, '')
    .replace(/^I\s+(developed|built|created|designed|implemented|owned|led|managed|delivered|engineered|integrated|deployed)\s+/i,
      (_, verb) => `${verb.charAt(0).toUpperCase()}${verb.slice(1)} `)
    .replace(/^I\s+/i, '')
    .replace(/^Responsible for\s+/i, 'Owned ')
    .replace(/^Helped (?:to |with )?/i, 'Supported ')
    .replace(/^Worked on\s+/i, 'Delivered ')
    .replace(/^Assisted (?:with |in )?/i, 'Supported ')
    .replace(/^Participated in\s+/i, 'Contributed to ')
    .replace(/^Duties included\s+/i, 'Delivered ')
    .replace(/^Tasked with\s+/i, 'Owned ')
    .replace(/^Spearhead(?:ed)?\s+/i, 'Led ')
    .replace(/:\s*Spearhead(?:ed)?\s+/gi, ': Led ')
    .replace(/\bspearhead(?:ed)?\b/gi, 'led')
    .replace(/\bleverage(?:d)?\b/gi, 'used')
    .replace(/\butiliz(?:ed|ing)\b/gi, 'using');

  const lower = text.toLowerCase();

  // Prefer RESTful API phrasing when APIs are mentioned — never mash with GraphQL/gRPC
  if (
    /\bapis?\b/i.test(text) &&
    !/restful/i.test(lower) &&
    !/\bgraphql\b/i.test(lower) &&
    !/\bgrpc\b/i.test(lower)
  ) {
    text = text.replace(/\bAPIs?\b/i, 'RESTful APIs');
  }
  // Undo accidental GraphQL + RESTful mashups from older polish passes
  text = text
    .replace(/\bGraphQL\s+RESTful\s+APIs?\b/gi, 'GraphQL APIs')
    .replace(/\bRESTful\s+GraphQL\s+APIs?\b/gi, 'GraphQL APIs');
  if (/microservice/i.test(lower) && !/event-driven/i.test(lower) && /event|stream|queue/i.test(lower)) {
    text = text.replace(/\.$/, '') + ' in an event-driven architecture.';
  }

  // Capitalize leading letter; ensure terminal period (polish will re-normalize)
  text = text.replace(/^([^A-Za-z]*)([a-z])/, (_, pre, c) => `${pre}${c.toUpperCase()}`);
  if (!/[.!?]$/.test(text)) text += '.';
  return elevateBulletForEmployer(text, company || text);
}

/** Infer a senior role title from JD language for summary framing. */
export function isEmbeddedSystemsJd(jdText) {
  const t = String(jdText || '').toLowerCase();
  const cpp = /c\+\+/.test(t);
  const embedded = /\bembedded\b|\binterrupt handling\b|\bvalgrind\b|\bgdb\b|\b3gpp\b|\b5g architecture\b|\bsatellite\b|\bmulti-threaded\b|\bmulti-process\b|\bsockets programming\b/.test(t);
  return cpp && embedded;
}

/** .NET / C# / ASP.NET plus Azure (Functions, Service Bus, Event Hub, containers). */
export function isDotnetAzureJd(jdText) {
  const t = String(jdText || '').toLowerCase();
  const net = /\b\.net\b|\bc#\b|\basp\.net\b/.test(t);
  const azure = /\bazure\b/.test(t);
  return net && (azure || /\basp\.net\b|\bazure functions?\b|\bservice bus\b/.test(t));
}

/** Posted "Job Title:" when present — the most accurate title for any JD. */
export function extractJdPostedTitle(jdText) {
  const t = String(jdText || '');
  const m = t.match(/(?:job\s*title|position title)\s*[:\-–]\s*([^\n]{8,90})/i);
  if (!m) return '';
  let title = String(m[1] || '').replace(/\s+/g, ' ').trim();
  title = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  title = title.replace(/[|].*$/, '').trim();
  if (title.length < 8 || title.length > 70) return '';
  if (/\b(we are|hiring entity|requirements|responsibilities|about us|salary range)\b/i.test(title)) return '';
  if (/https?:\/\//i.test(title)) return '';
  return title;
}

function seniorizePostedTitle(title, years) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (/\b(senior|staff|principal|lead|junior|associate|intern)\b/i.test(t)) return t;
  if ((Number(years) || 0) >= 5 && /^software engineer\b/i.test(t)) {
    return t.replace(/^software engineer/i, 'Senior Software Engineer');
  }
  return t;
}

/**
 * JD-noun work shape for summary line 2 — IoT/integration JDs without a new family.
 */
export function inferJdWorkShapeLine(jdText) {
  const t = String(jdText || '').toLowerCase();
  if (!t.trim()) return '';
  const bits = [];
  if (/\bintegrat|\boem\b|\bthird[-\s]?party\b/.test(t)) bits.push('third-party API integrations');
  if (/\biot\b|\btelemetry\b|\bdevice\b|\bderms?\b/.test(t)) bits.push('device telemetry');
  if (/\bevent[-\s]?driven\b|\bkafka\b|\bservice bus\b|\bevent hub\b|\bmessage[-\s]?based\b|\bwebhook/.test(t)) {
    bits.push('message-driven cloud services');
  }
  const unique = [...new Set(bits)].slice(0, 3);
  if (unique.length >= 2) {
    return `Build ${unique.join(', ')} with observability and production troubleshooting.`;
  }
  return '';
}

export function inferRoleTitleFromJd(jdText, yearsExp = 0) {
  const t = String(jdText || '').toLowerCase();
  const y = Number(yearsExp) || 0;
  if (/\baws platform engineer\b/.test(t) || (/\bplatform engineer\b/.test(t) && /\baws\b/.test(t))) {
    return /\bprincipal\b/.test(t)
      ? 'AWS Platform Engineer Principal'
      : 'Senior AWS Platform Engineer';
  }
  if (isEmbeddedSystemsJd(jdText)) {
    return y > 0 ? 'Senior Software Engineer' : 'Software Engineer';
  }
  if (isDotnetAzureJd(jdText)) {
    return seniorizePostedTitle(extractJdPostedTitle(jdText), y)
      || (y > 0 ? 'Senior Software Engineer' : 'Software Engineer');
  }
  if (/\bstaff\s+(software\s+)?engineer\b|\bprincipal\s+(software\s+)?engineer\b/.test(t)) {
    return y >= 8 ? 'Staff Software Engineer' : 'Senior Software Engineer';
  }
  if (/\b(etl testing|senior consultant.*etl|data warehouse testing)\b/.test(t)) {
    return 'Senior Consultant - ETL Testing';
  }
  if (
    /\bdata engineer\b|\bsenior data engineer\b/.test(t)
    || (/\b(databricks|pyspark|azure data factory|\badf\b|snowflake|data modeling)\b/.test(t)
      && /\b(data|etl|elt|spark)\b/.test(t))
  ) {
    return 'Senior Data Engineer';
  }
  if (/\b(web scrap|scraping)\b/.test(t) && /\bjavascript|js\b|node/.test(t)) {
    return 'Senior JavaScript Developer';
  }
  const posted = seniorizePostedTitle(extractJdPostedTitle(jdText), y);
  if (posted) return posted;
  if (/\bfull[-\s]?stack\b/.test(t)) return 'Senior Full-Stack Engineer';
  if (/\bfront[-\s]?end\b|\bfrontend\b/.test(t) && !/\bback[-\s]?end\b|\bfull[-\s]?stack\b|\.net\b|\bnode\.?js\b/.test(t)) {
    return 'Senior Frontend Engineer';
  }
  if (/\bback[-\s]?end\b|\bplatform engineer\b|\bapi engineer\b/.test(t)) return 'Senior Backend Engineer';
  if (/\bdevops\b|\bsite reliability\b|\bsre\b/.test(t)) return 'Senior DevOps Engineer';
  if (/\b(ai|llm|machine learning)\b/.test(t) && /\bengineer\b/.test(t)) return 'Senior Software Engineer';
  if (/\bjavascript developer\b|\bjs developer\b/.test(t)) return 'Senior JavaScript Developer';
  return y > 0 ? 'Senior Software Engineer' : 'Software Engineer';
}

/**
 * Rebuild per-role tailored bullets from profile source, ranked by JD relevance.
 * Uses only facts from profile bullets — never invents stacks.
 *
 * @param {object} [opts]
 * @param {number[]} [opts.tailorIndices] — only reframe these role indices; others omitted from output
 */
export function reframeExperienceFromProfile(profileExperience, jdText, honestKeywords, rolesCount = 7, opts = {}) {
  const exp = Array.isArray(profileExperience) ? profileExperience : [];
  const count = Math.min(rolesCount, exp.length);
  const out = {};
  const tailorSet = Array.isArray(opts.tailorIndices) && opts.tailorIndices.length
    ? new Set(opts.tailorIndices.map(Number))
    : null;

  for (let i = 0; i < count; i++) {
    if (tailorSet && !tailorSet.has(i)) continue;

    const tenureMonths = parseTenureMonths(exp[i]?.period);
    const bulletCap = bulletsBudgetForRole(i, { tenureMonths, maxPages: 2 });
    const company = exp[i]?.company || '';
    const rawBullets = (exp[i]?.bullets || []).map(stripMarkdown).filter((b) => b.length > 20);
    const bullets = explodeWallOfTextBullets(rawBullets, { maxBullets: bulletCap + 2 });
    const ranked = [...bullets].sort(
      (a, b) => scoreBulletForJd(b, jdText, honestKeywords) - scoreBulletForJd(a, jdText, honestKeywords)
    );
    const positive = ranked.filter((b) => scoreBulletForJd(b, jdText, honestKeywords) >= 0);
    const pool = positive.length >= Math.min(3, bulletCap) ? positive : ranked;
    const top = pool.slice(0, bulletCap);
    let framed = top.map((b) => enhanceBulletHonest(b, honestKeywords, company));
    while (framed.length < bulletCap && ranked.length > 0) {
      const next = ranked[framed.length % ranked.length];
      const enhanced = enhanceBulletHonest(next, honestKeywords, company);
      if (!framed.includes(enhanced)) framed.push(enhanced);
      else break;
    }
    // Senior floor: never leave a multi-year role with 2 thin/orphan crumbs
    out[String(i)] = preferSourceIfThin(framed, rawBullets, {
      minCount: Math.min(3, bulletCap),
      maxBullets: bulletCap,
    }).map((b) => enhanceBulletHonest(b, honestKeywords, company));
  }
  return out;
}

export function buildHonestCompetencies(honestKeywords, profile, jdText, limit = 16) {
  return buildJdMatchedCompetencies(honestKeywords, profile, jdText, limit);
}

/**
 * JD-first competencies for ATS: proven stack first, then real JD tech (not JD chrome).
 * Never emit education prose, section headers, or editor tools unless the JD is AI-tooling focused.
 */
export function buildJdMatchedCompetencies(jdKeywords, profile, jdText, limit = 16) {
  const comps = [];
  const seen = new Set();
  const jdLower = String(jdText || '').toLowerCase();
  // Editor IDE tools are NEVER skills — even if JD name-drops Cursor/Copilot.
  // Soft label "AI-Assisted Development" is added separately when JD wants AI tooling.
  const jdWantsAiTools =
    /\b(copilot|cursor|generative ai|langchain|openai|chatgpt|ai agent)\b/.test(jdLower) &&
    !/\bwe may use artificial intelligence\b/.test(jdLower);

  const add = (item) => {
    const raw = cleanSkillToken(item);
    if (!raw || isJunkKeyword(raw)) return;
    // Block generic filler labels that waste ATS real estate
    if (/^(software|applications?|services?|development|technologies?|engineering|solutions?)$/i.test(raw)) return;
    if (isEditorIdeTool(raw)) return;
    // Skills row = real tech / seeded domain only — never JD prose crumbs
    if (!isApprovedSkillPhrase(raw)) return;
    if (isAwsServiceCrumb(raw) && comps.some((c) => /^aws\b/i.test(c))) {
      if (!jdLower.includes(normalizeKey(raw))) return;
    }
    const k = normalizeKey(raw);
    if (!k || seen.has(k)) return;
    seen.add(k);
    comps.push(raw);
  };

  const jdTech = extractJdTechKeywords(jdText, 22).map(cleanSkillToken);
  const { honest, gaps, profileTech } = partitionJdKeywords(
    [...(jdKeywords || []), ...jdTech].filter((kw) => !isJunkKeyword(kw)),
    profile
  );
  const honestKeys = new Set(honest.map((k) => normalizeKey(cleanSkillToken(k))));

  const isProvenLanguage = (kw) => {
    if (!isUnprovenLanguageSkill(kw)) return true;
    const k = normalizeKey(cleanSkillToken(kw));
    if (honestKeys.has(k)) return true;
    if ((profileTech || []).some((t) => normalizeKey(t) === k)) return true;
    // ATS: list JD-required languages (C++) even when not in the digest
    return keywordAppearsInJd(kw, jdText);
  };

  // JD stack first so a C++/Linux posting is not led by TypeScript/React from the master CV
  for (const kw of jdTech) {
    if (!isProvenLanguage(kw) && isUnprovenLanguageSkill(kw) && !keywordAppearsInJd(kw, jdText)) continue;
    add(kw);
  }
  for (const kw of honest) add(kw);
  for (const kw of gaps) {
    if (!isProvenLanguage(kw) && !keywordAppearsInJd(kw, jdText)) continue;
    if (isApprovedSkillPhrase(kw)) add(kw);
  }
  for (const t of profileTech || []) {
    if (keywordAppearsInJd(t, jdText)) add(t);
  }

  const transfers = [
    ['restful', 'RESTful API Design'],
    ['nestjs', 'NestJS Backend Development'],
    ['puppeteer', 'Puppeteer'],
    ['playwright', 'Playwright'],
    ['cheerio', 'Cheerio'],
    ['selenium', 'Selenium'],
    ['websocket', 'WebSockets'],
    ['web scraping', 'Web Scraping'],
    ['scraping', 'Web Scraping'],
    ['etl testing', 'ETL Testing'],
    ['elt', 'ELT'],
    ['etl', 'ETL'],
    ['pyspark', 'PySpark'],
    ['databricks', 'Azure Databricks'],
    ['azure data factory', 'Azure Data Factory'],
    ['adf', 'Azure Data Factory'],
    ['snowflake', 'Snowflake'],
    ['redshift', 'Redshift'],
    ['bigquery', 'BigQuery'],
    ['data modeling', 'Data Modeling'],
    ['terraform', 'Terraform'],
    ['source-to-target', 'Source-to-Target Validation'],
    ['reconcil', 'Data Reconciliation'],
    ['pandas', 'pandas'],
    ['pyodbc', 'pyodbc'],
    ['data warehouse', 'Data Warehouse'],
    ['scd', 'SCD Handling'],
    ['window function', 'SQL Window Functions'],
    ['jira', 'JIRA'],
    ['unix', 'Unix/Linux Shell'],
    ['linux', 'Linux'],
    ['gdb', 'GDB'],
    ['valgrind', 'Valgrind'],
    ['3gpp', '3GPP'],
    ['tcp/ip', 'TCP/IP'],
    ['uml', 'UML'],
    ['c++', 'C++'],
    ['orm', 'ORM'],
    ['message broker', 'Message Brokers'],
    ['react', 'React / TypeScript Frontend'],
    ['typescript', 'TypeScript'],
    ['javascript', 'JavaScript'],
    ['redux', 'Redux State Management'],
    ['azure', 'Azure Cloud Services'],
    ['aws', 'AWS Cloud Services'],
    ['gitlab', 'GitLab CI / CD'],
    ['github actions', 'GitHub Actions'],
    ['microservice', 'Microservices Architecture'],
    ['ci/cd', 'CI/CD Pipelines'],
    ['unit test', 'Unit & Integration Testing'],
    ['integration test', 'Unit & Integration Testing'],
    ['end-to-end', 'End-to-End Testing'],
    ['observability', 'Observability & Incident Response'],
    ['ai agent', 'AI Agent Development'],
    ['full-stack', 'Full-Stack Engineering'],
    ['event-driven', 'Event-Driven Architecture'],
    ['docker', 'Docker'],
    ['kubernetes', 'Kubernetes'],
    ['node', 'Node.js Services'],
    ['.net', '.NET'],
    ['c#', 'C#'],
    ['sql server', 'Microsoft SQL Server'],
    ['telerik', 'Telerik'],
    ['devexpress', 'DevExpress'],
    ['jquery', 'jQuery'],
    ['postgresql', 'PostgreSQL'],
    ['mongodb', 'MongoDB'],
    ['oracle', 'Oracle'],
    ['graphql', 'GraphQL'],
  ];
  // AI editor transfers only when JD asks for them
  if (jdWantsAiTools) {
    transfers.push(['cursor', 'AI-Assisted Development'], ['copilot', 'AI-Assisted Development']);
  }
  for (const [needle, label] of transfers) {
    const re = new RegExp(`(?:^|[^a-z0-9+#./])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^a-z0-9+#./]|$)`, 'i');
    if (re.test(jdLower)) add(label);
  }

  for (const s of profile?.narrative?.superpowers || []) {
    if (isEditorIdeTool(s)) continue;
    const cleaned = String(s || '').replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (!cleaned || !isApprovedSkillPhrase(cleaned)) continue;
    if (keywordAppearsInJd(cleaned, jdText)) add(cleaned);
    const paren = String(s).match(/\(([^)]+)\)/);
    if (paren) {
      for (const part of paren[1].split(',').map((x) => x.trim()).filter(Boolean)) {
        if (isApprovedSkillPhrase(part) && keywordAppearsInJd(part, jdText)) add(part);
      }
    }
  }

  return comps.slice(0, limit);
}

/**
 * Senior / Zety-bar professional summary: 3–4 tight lines.
 * Strong identity, named JD stack, ownership + impact — never soft filler.
 * Offline path is the quality floor (LLM draft is honesty-gated separately).
 */
export function buildHonestSummary(baseSummary, yearsExp, honestKeywords, jdText) {
  const y = Number(yearsExp) || 0;
  const jdTechLead = extractJdTechKeywords(jdText, 18)
    .filter((k) => {
      if (!k || isJunkKeyword(k) || isEditorIdeTool(k)) return false;
      if (isMethodologySkillPhrase(k)) return false;
      if (FRAGMENT_BLOCKLIST.has(normalizeKey(k))) return false;
      return isWeavableKeyword(k) || isApprovedSkillPhrase(k);
    });
  const leadList = (honestKeywords || []).filter((k) => isWeavableKeyword(k) && !isJunkKeyword(k) && !isEditorIdeTool(k));
  const leadPool = leadList
    .filter((k) => {
      if (FRAGMENT_BLOCKLIST.has(normalizeKey(k)) || !isWeavableKeyword(k)) return false;
      if (isJunkKeyword(k)) return false;
      if (isMethodologySkillPhrase(k)) return false;
      if (/^(unit testing|agile|scrum|full[-\s]?stack experience|microservices?)$/i.test(String(k))) return false;
      return true;
    });
  const jdLead = leadPool.filter((k) => !jdText || keywordAppearsInJd(k, jdText));
  const CORE_LANGUAGES = new Set([
  'typescript', 'javascript', 'python', 'java', 'go', 'golang', 'c#', 'c++', 'kotlin', 'php', 'ruby', 'rust', 'swift', 'sql'
]);
const CORE_FRAMEWORKS = new Set([
  'react', 'react.js', 'node.js', 'node', 'express', 'fastapi', 'spring boot', 'next.js', 'django', 'flask', 'vue', 'angular', 'nest.js', 'nestjs'
]);
const CORE_DATABASES = new Set([
  'postgresql', 'postgres', 'oracle', 'dynamodb', 'mongodb', 'mysql', 'aurora', 'redis', 'chromadb', 'cassandra', 'sqlite'
]);
const CORE_CLOUD_INFRA = new Set([
  'aws', 'kubernetes', 'docker', 'lambda', 'cdk', 'terraform', 'cloudformation', 'kafka', 'sqs', 'eventbridge', 'azure', 'gcp', 'ci/cd', 'rest api', 'restful api', 'microservices'
]);

function prioritizeSummaryTechTerms(terms) {
  const score = (term) => {
    const lower = String(term || '').toLowerCase().trim();
    if (CORE_LANGUAGES.has(lower)) return 10;
    if (CORE_FRAMEWORKS.has(lower)) return 20;
    if (CORE_DATABASES.has(lower)) return 30;
    if (CORE_CLOUD_INFRA.has(lower)) return 40;
    return 50;
  };
  return [...terms].sort((a, b) => score(a) - score(b));
}

  const rawLeadTerms = [...new Set([...jdTechLead, ...jdLead].map((k) => String(k).trim()))];
  const leadTerms = prioritizeSummaryTechTerms(rawLeadTerms).slice(0, 8);
  const embedded = isEmbeddedSystemsJd(jdText);
  const dotnetAzure = isDotnetAzureJd(jdText);
  const workShape = inferJdWorkShapeLine(jdText);
  const lead = leadTerms.length
    ? leadTerms.join(', ')
    : (embedded ? 'Linux, Python, Jenkins, AWS, and Azure' : 'APIs, cloud platforms, and production services');
  const jdLower = String(jdText || '').toLowerCase();
  const title = inferRoleTitleFromJd(jdText, y);
  const yearsLabel = y > 0 ? `${y}+ years` : 'years';
  const iotShape = /\biot\b|\btelemetry\b|\bderms?\b/i.test(jdLower);
  const lines = [];

  lines.push(
    `${title} with ${yearsLabel} owning production ${
      /\bdata engineer|databricks|pyspark|data factory|snowflake\b/i.test(jdLower)
        ? 'data platforms, pipelines, and cloud analytics systems'
        : embedded
          ? 'Linux services, multi-process systems, and communications software'
          : iotShape
            ? 'event-driven integrations, IoT telemetry pipelines, and cloud APIs'
            : dotnetAzure
              ? 'event-driven integrations, cloud APIs, and message-driven services'
              : 'backends, cloud platforms, and API systems'
    } in ${lead}.`,
  );

  if (/\b(databricks|pyspark|azure data factory|\badf\b|snowflake|redshift|bigquery)\b/i.test(jdLower)) {
    lines.push(
      'Own Azure data platforms end-to-end: Databricks/PySpark transforms, ADF pipelines, SQL-backed models, and warehouse loads (Snowflake/Redshift/BigQuery) with reliable ETL/ELT.',
    );
  } else if (/\b(etl testing|source-to-target|data reconcil|data warehouse|scd)\b/i.test(jdLower)) {
    lines.push('Own Python-based ETL validation, source-to-target checks, and SQL-backed data reconciliation across warehouse layers.');
  } else if (embedded) {
    lines.push('Design and ship Linux services in Agile/Scrum: multi-process applications, Jenkins CI/CD, automated tests, and production troubleshooting, with AWS/Azure where the platform needs it.');
  } else if (workShape) {
    lines.push(workShape);
  } else if (/\b(web scrap|scraping|puppeteer|playwright|cheerio|selenium)\b/i.test(jdLower)) {
    lines.push('Ship JavaScript services for data extraction and browser automation with solid REST APIs, Postgres, and cloud delivery.');
  } else if (
    // Core AI/ML roles only — NOT "AI-assisted coding" / Copilot / agentic productivity niceties
    /\b(large language model|\bllms?\b|\brag\b|retrieval[- ]augmented|vector (?:db|database|search)|langchain|machine learning engineer|ml engineer|generative ai engineer|ai platform|llmops|chromadb|pinecone|embedding model)\b/i.test(jdLower)
  ) {
    lines.push('Lead LLM-backed features and AI-assisted delivery with production-grade API reliability and validation loops.');
  } else if (/\bevent-driven|microservice|kafka|message queue\b/i.test(jdLower)) {
    lines.push('Drive monolith-to-microservices work and event-driven service boundaries with reliable messaging and clear ownership.');
  } else if (/\baws platform|infrastructure as code|terraform|cloudformation|devsecops|capacity planning\b/i.test(jdLower)) {
    lines.push('Own AWS platform work: infrastructure as code, CI/CD, CloudWatch monitoring, IAM/VPC networking, and incident response.');
  } else if (/\bci\/cd|devops|kubernetes|docker\b/i.test(jdLower)) {
    lines.push('Own CI/CD-backed releases, containerized deployments, and automated quality gates that cut operational toil.');
  } else if (/\breact|typescript|front-?end|frontend\b/i.test(jdLower) && /\b(node|\.net|api|backend|full-?stack)\b/i.test(jdLower)) {
    lines.push('Ship end-to-end product features across React/TypeScript UIs and high-throughput backend APIs with strict testing discipline.');
  } else if (/\baws|cloud|ec2|lambda|ecs\b/i.test(jdLower)) {
    lines.push('Own AWS cost/performance work: right-sizing, autoscaling, and database tuning that protect reliability and spend.');
  } else {
    lines.push('Lead scalable service design, high-throughput RESTful APIs, and cloud performance work with measurable delivery outcomes.');
  }

  // Line 3 — senior operating model: architecture + reliability + SDLC (never soft "collaborate")
  if (/\bobservability|high-traffic|latency|sre|incident\b/i.test(jdLower)) {
    lines.push('Hold the line on reliability: observability, incident response, latency tuning, and production hardening.');
  } else if (/\bl3|l4|root cause|capacity planning|principal\b/i.test(jdLower)) {
    lines.push('Lead L3/L4 incident RCA, architecture reviews, and capacity planning so platforms stay stable under load.');
  } else if (/\bmentor|tech lead|staff|principal|cross-functional\b/i.test(jdLower)) {
    lines.push('Set engineering bar through design ownership, peer review, and mentoring: from architecture decisions through launch.');
  } else if (/\bdata engineer|databricks|pyspark|etl|adf\b/i.test(jdLower)) {
    lines.push('Own pipeline reliability, data quality checks, CI/CD for data jobs, and clear handoffs from raw ingest through curated models.');
  } else {
    lines.push('Own architecture decisions, SDLC quality (reviews, tests, CI), and mentoring so teams ship reliable software faster.');
  }

  // Line 4 — concrete stack / impact closer when JD is tech-dense
  if (lines.length < 4) {
    if (leadTerms.length >= 3) {
      const stack = leadTerms.slice(0, 4).join(', ');
      lines.push(`Day-to-day production stack: ${stack}. Bias to ownership, measurable impact, and clean handoffs.`);
    } else {
      lines.push('Bias to ownership, measurable impact, and production systems that stay fast, secure, and maintainable.');
    }
  }

  // Strip banned clichés / soft filler (defense in depth)
  const cleaned = lines
    .map((l) => l
      .replace(/\bpassionate about\b/gi, 'focused on')
      .replace(/\bresults-oriented\b/gi, 'delivery-focused')
      .replace(/\bproven track record\b/gi, 'consistent delivery')
      .replace(/\bleveraged\b/gi, 'used')
      .replace(/\bspearheaded\b/gi, 'led')
      .replace(/\bcutting-edge\b/gi, 'modern')
      .replace(/\brobust\b/gi, 'reliable')
      .replace(/\bCollaborate with product and engineering partners[^.]*\./gi,
        'Own architecture decisions, SDLC quality, and mentoring through launch.')
      .replace(/\bComfortable day-to-day with\b/gi, 'Day-to-day production stack:'))
    .filter((l) => l && !/collaborate with product partners/i.test(l))
    .slice(0, 4);

  return cleaned.join('\n');
}

export function analyzeJdProfileFit(jdText, profile) {
  const rawKeywords = extractJdKeywords(jdText, 25);
  const jdKeywords = filterFragmentKeywords(rawKeywords, jdText);
  const { honest, gaps, profileTech } = partitionJdKeywords(jdKeywords, profile);
  return { jdKeywords, honest, gaps, profileTech };
}

export function formatHonestKeywordBlock(honest, gaps) {
  const lines = ['PROVEN IN PROFILE (prefer in experience bullets):'];
  if (honest.length === 0) lines.push('  (none extracted — lean on digest facts)');
  else honest.forEach((k, i) => lines.push(`  ${i + 1}. ${k}`));
  lines.push('');
  lines.push('JD TARGET STACK (MUST appear in core_competencies / Technical Skills for ATS — even if not every item is in digest):');
  if (gaps.length === 0) lines.push('  (none)');
  else gaps.slice(0, 12).forEach((k, i) => lines.push(`  ${i + 1}. ${k}`));
  lines.push('');
  lines.push('EXPERIENCE RULE: do not invent detailed work history for gap tools (e.g. "built NestJS microservices at X"). Skills section may list the full JD stack.');
  return lines.join('\n');
}
