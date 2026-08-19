/**
 * resume-quality.mjs — Post-process tailored resume text for 90+ ATS content scores:
 * quantified impact, global verb variety, and no repeated words within sentences.
 */

const ATS_TARGET_SCORE = 90;

/** @type {Record<string, string[]>} */
export const VERB_ALTERNATIVES = {
  implemented: ['executed', 'applied', 'enforced', 'deployed', 'rolled out'],
  developed: ['enhanced', 'expanded', 'improved', 'engineered', 'built'],
  designed: ['architected', 'structured', 'modeled', 'planned', 'shaped'],
  led: ['ran', 'directed', 'headed', 'drove', 'owned'],
  built: ['created', 'established', 'assembled', 'constructed', 'delivered'],
  optimized: ['tuned', 'streamlined', 'refined', 'reduced', 'accelerated'],
  managed: ['oversaw', 'coordinated', 'supervised', 'governed', 'administered'],
  created: ['launched', 'introduced', 'established', 'authored', 'produced'],
  improved: ['enhanced', 'boosted', 'raised', 'strengthened', 'elevated'],
  architected: ['designed', 'structured', 'modeled', 'planned', 'shaped'],
  engineered: ['built', 'constructed', 'delivered', 'assembled', 'produced'],
  delivered: ['shipped', 'released', 'launched', 'rolled out', 'deployed'],
  integrated: ['connected', 'wired', 'linked', 'coupled', 'unified'],
  automated: ['scripted', 'orchestrated', 'mechanized', 'systematized', 'streamlined'],
  established: ['set up', 'instituted', 'formed', 'launched', 'introduced'],
  maintained: ['sustained', 'supported', 'upheld', 'preserved', 'operated'],
};

const GENERIC_VERB_POOL = [
  'delivered', 'drove', 'owned', 'ran', 'streamlined', 'accelerated',
  'reduced', 'expanded', 'enforced', 'authored', 'launched', 'tuned',
];

const STOPWORDS = new Set([
  'about', 'after', 'also', 'among', 'based', 'been', 'before', 'between',
  'both', 'each', 'from', 'have', 'into', 'more', 'most', 'other', 'over',
  'such', 'than', 'that', 'their', 'them', 'these', 'they', 'this', 'those',
  'through', 'under', 'using', 'while', 'where', 'which', 'with', 'within',
  'across', 'during', 'including', 'across', 'against', 'around', 'toward',
]);

/** Words we never auto-replace (JD keywords, stacks, brands). */
const PRESERVE_WORDS = new Set([
  'aws', 'api', 'apis', 'sql', 'node', 'react', 'next', 'java', 'python',
  'linux', 'docker', 'kafka', 'redis', 'oracle', 'postgres', 'postgresql',
  'mongodb', 'github', 'azure', 'lambda', 'fastapi', 'chromadb', 'langchain',
]);

const METRIC_PATTERNS = [
  /\d+%/,
  /\$[\d,]+(?:\.\d+)?[kKmMbB]?/,
  /\b\d[\d,]*\+?\b/,
  /\b(?:p\d{2}|latency|throughput|uptime|cpu|cost|revenue|users|requests|transactions|deployments)\b/i,
  /\b(?:reduced|cut|decreased|lowered|increased|improved|optimized|saved|accelerated|boosted|raised)\b[^.]{0,50}\d/i,
  /\bfrom\s+[^,]{2,40}\s+to\s+[^,]{2,40}/i,
];

const REPLACEABLE_WORDS = new Set([
  ...Object.keys(VERB_ALTERNATIVES),
  'utilized', 'leveraged', 'spearheaded', 'facilitated', 'collaborated',
]);

const MAX_GLOBAL_USES = 1;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function preserveCase(original, replacement) {
  if (!original || !replacement) return replacement;
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement.toLowerCase();
}

export function extractLeadingVerb(bullet) {
  const match = String(bullet || '').trim().match(/^([A-Za-z]+)/);
  if (!match) return null;
  const verb = match[1].toLowerCase();
  if (['the', 'a', 'an', 'this', 'that', 'worked', 'responsible'].includes(verb)) return null;
  return verb;
}

export function capitalizeLeadingVerb(verb) {
  if (!verb) return verb;
  return verb.charAt(0).toUpperCase() + verb.slice(1);
}

export function replaceLeadingVerb(bullet, newVerb) {
  return String(bullet || '').replace(/^[A-Za-z]+/, capitalizeLeadingVerb(newVerb));
}

export function hasQuantifiedImpact(text) {
  const s = String(text || '');
  return METRIC_PATTERNS.some((re) => re.test(s));
}

/** A metric clause must carry a real measurement unit — bare digits are usually
 * version fragments ("3-large" from text-embedding-3-large), not metrics. */
const METRIC_UNIT_RE =
  /%|\bpercent\b|\$\s?\d|\b\d[\d,]*\+?\s*(?:x|times|fold|hours?|minutes?|seconds?|ms|days?|weeks?|months?|years?|users?|requests?|events?|transactions?|records?|queries?|per\s+(?:month|week|day|year)|daily|monthly|weekly|yearly)\b/i;

export function extractMetricClause(text) {
  const s = String(text || '');
  const patterns = [
    /(?:reduced|cut|decreased|lowered|increased|improved|optimized|saved|accelerated|boosted|raised)[^.]{0,60}\d[^.]*/i,
    /\d+%[^.]*/,
    /\d[\d,]*\+?[^.]*/,
    /from [^.]{3,50} to [^.]{3,50}/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const clause = m[0].trim().replace(/[,.]$/, '');
    if (/\d+-[a-z]/i.test(clause)) continue; // version fragment, not a metric
    if (re === patterns[3] || METRIC_UNIT_RE.test(clause)) return clause;
  }
  return null;
}

function tokenSet(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length > 3),
  );
}

function tokenOverlap(a, b) {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  let n = 0;
  for (const t of ta) {
    if (tb.has(t)) n += 1;
  }
  return n;
}

export function pickVerbReplacement(verb, usedVerbs) {
  const pool = VERB_ALTERNATIVES[verb];
  // No thesaurus entry → keep the original verb. GENERIC_VERB_POOL produces
  // nonsense like "Released rigorous SDLC" / "Enforced RESTful APIs".
  if (!pool) return null;
  for (const alt of pool) {
    if (!usedVerbs.has(alt)) return alt;
  }
  return null;
}

function isReplaceableWord(word) {
  const lower = String(word || '').toLowerCase();
  if (lower.length < 5) return false;
  if (STOPWORDS.has(lower)) return false;
  if (PRESERVE_WORDS.has(lower)) return false;
  return REPLACEABLE_WORDS.has(lower) || VERB_ALTERNATIVES[lower];
}

function replaceNthWord(text, word, replacement, occurrence = 1) {
  let seen = 0;
  const re = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
  return String(text).replace(re, (match) => {
    seen += 1;
    if (seen === occurrence) return preserveCase(match, replacement);
    return match;
  });
}

/**
 * Replace repeated words inside a single sentence/bullet (not JD tech terms).
 * Only replaces words that are repeated WITHIN the same sentence segment.
 * The usedGlobally map tracks word usage for informational purposes
 * but does NOT trigger mid-sentence replacements across different bullets.
 */
export function dedupeIntraSentenceRepetition(text, usedGlobally = new Map()) {
  let fixes = 0;
  const segments = String(text || '').split(/(?<=[.!?])\s+|\n/);
  const polished = segments.map((segment) => {
    const seenLocal = new Map();
    let out = segment;
    const matches = [...segment.matchAll(/\b([A-Za-z]{4,})\b/g)];
    for (const m of matches) {
      const word = m[1];
      const lower = word.toLowerCase();
      if (!isReplaceableWord(lower)) continue;

      const localCount = seenLocal.get(lower) || 0;
      seenLocal.set(lower, localCount + 1);

      // Only replace if the word is repeated within THIS sentence segment.
      // Do NOT replace based on global cross-bullet counts — that caused
      // mid-sentence verb mangling (e.g. "integrated" → "connected").
      const needsReplace = localCount >= 1;
      if (!needsReplace) {
        usedGlobally.set(lower, (usedGlobally.get(lower) || 0) + 1);
        continue;
      }

      const replacement = pickVerbReplacement(lower, new Set([...seenLocal.keys(), ...usedGlobally.keys()]));
      if (!replacement) continue;

      const before = out;
      out = replaceNthWord(out, word, replacement, 2);
      if (out !== before) {
        fixes += 1;
        seenLocal.set(replacement.toLowerCase(), 1);
        usedGlobally.set(lower, (usedGlobally.get(lower) || 0));
        usedGlobally.set(replacement.toLowerCase(), (usedGlobally.get(replacement.toLowerCase()) || 0) + 1);
      }
    }
    return out;
  });
  return { text: polished.join(' ').replace(/\s+/g, ' ').trim(), fixes };
}

/**
 * Globally cap action-verb frequency across all resume text (max 1 each for leading verbs).
 * Also soft-caps replaceable mid-sentence verbs that appear 3+ times across the document.
 */
export function dedupeGlobalWordFrequency(texts, usedGlobally = new Map()) {
  let fixes = 0;
  const counts = new Map();

  for (const text of texts) {
    const verb = extractLeadingVerb(text);
    if (verb && isReplaceableWord(verb)) {
      counts.set(verb, (counts.get(verb) || 0) + 1);
    }
  }

  let out = texts.map((text) => {
    let current = text;
    const verb = extractLeadingVerb(text);
    if (verb && counts.get(verb) > MAX_GLOBAL_USES) {
      const replacement = pickVerbReplacement(verb, new Set([...usedGlobally.keys(), verb]));
      if (replacement) {
        fixes += 1;
        usedGlobally.set(replacement.toLowerCase(), (usedGlobally.get(replacement.toLowerCase()) || 0) + 1);
        current = replaceLeadingVerb(current, replacement);
        counts.set(verb, (counts.get(verb) || 1) - 1);
        counts.set(replacement, (counts.get(replacement) || 0) + 1);
      }
    }
    const intra = dedupeIntraSentenceRepetition(current, usedGlobally);
    fixes += intra.fixes;
    return intra.text;
  });

  return { texts: out, fixes };
}

export function dedupeVerbStarts(bullets, usedVerbs = new Set()) {
  let rotated = 0;
  const out = bullets.map((bullet) => {
    const verb = extractLeadingVerb(bullet);
    if (!verb) return bullet;
    if (!usedVerbs.has(verb)) {
      usedVerbs.add(verb);
      return bullet;
    }
    const replacement = pickVerbReplacement(verb, usedVerbs);
    if (!replacement) return bullet;
    usedVerbs.add(replacement);
    rotated += 1;
    return replaceLeadingVerb(bullet, replacement);
  });
  return { bullets: out, rotated };
}

export function enrichBulletWithSourceMetric(bullet, sourceBullets) {
  if (hasQuantifiedImpact(bullet)) return { bullet, enriched: false };
  const sources = Array.isArray(sourceBullets) ? sourceBullets : [];
  let best = null;
  let bestOverlap = 0;
  for (const src of sources) {
    if (!hasQuantifiedImpact(src)) continue;
    const overlap = tokenOverlap(bullet, src);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = src;
    }
  }
  // Require strong same-role overlap — weak matches invent history
  if (!best || bestOverlap < 4) return { bullet, enriched: false };
  const metric = extractMetricClause(best);
  if (!metric) return { bullet, enriched: false };
  const trimmed = String(bullet).trim().replace(/\.$/, '');
  if (trimmed.toLowerCase().includes(metric.toLowerCase())) {
    return { bullet, enriched: false };
  }
  return { bullet: `${trimmed}, ${metric}.`, enriched: true };
}

function collectExperienceArrays(experience) {
  if (!experience) return [];
  if (Array.isArray(experience)) return [experience];
  if (typeof experience === 'object') {
    return Object.keys(experience)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (Array.isArray(experience[k]) ? experience[k] : []));
  }
  return [];
}

function collectAllSourceBullets(sourceExperience) {
  if (!Array.isArray(sourceExperience)) return [];
  return sourceExperience.flatMap((e) => (Array.isArray(e?.bullets) ? e.bullets : []));
}

function cleanSpellingAndGrammar(text) {
  return String(text)
    .replace(/\s*[-=]>\s*/g, ' to ')
    .replace(/\bmultiprocessing\.Pool\b/gi, 'multiprocessing pools')
    .replace(/\btext-embedding-3-large\s+embeddings\b/gi, 'large text embedding models')
    .replace(/\btext-embedding-3-large\b/gi, 'large text embedding models')
    .replace(/:\s*Spearhead(?:ed)?\s+/gi, ': Led ')
    .replace(/\bSpearhead(?:ed)?\b/g, 'Led')
    .replace(/\bspearhead(?:ed)?\b/gi, 'led')
    .replace(/\bLeverage(?:d)?\b/g, 'Used')
    .replace(/\bleverage(?:d)?\b/gi, 'used')
    .replace(/\bUtiliz(?:ed|ing)\b/g, 'Using')
    .replace(/\butiliz(?:ed|ing)\b/gi, 'using')
    .replace(/\sand building\b/gi, ' and built')
    .replace(/,\s*building\s+/gi, ', built ');
}

/**
 * Undo LLM splice artifacts: bare version-token clauses (", 3-large ..."),
 * participle-only weave tails ("supporting AI-assisted."), and trailing
 * clauses that repeat text already present earlier in the bullet.
 */
export function removeSplicedFragments(text) {
  let out = String(text);
  out = out.replace(/,\s*[^,.]*\b\d+-[a-z]{2,}\b[^,.]*(?=\.|$)/gi, '');
  out = out.replace(/,?\s*\bsupporting\s+[A-Za-z0-9][A-Za-z0-9\s-]*?(?:assisted|driven|oriented|based|related|aligned)\.(?=\s|$)/gi, '.');
  const m = out.match(/^(.*),\s*([^,.]{12,})\.?\s*$/s);
  if (m) {
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const tail = norm(m[2]);
    if (tail && norm(m[1]).includes(tail)) out = `${m[1].replace(/\s+$/, '')}.`;
  }
  out = out.replace(/,\s*\./g, '.').replace(/\.\s*\./g, '.');
  return out;
}

function synthesizeMetric(_bullet) {
  // Permanently disabled — fabricating % / throughput fails honesty + Zety quality bar.
  // Callers must set allowSyntheticMetrics only for legacy experiments; prod paths leave it false.
  return null;
}

/** Employers that get Senior / LinkedIn ownership tone (not mid-level IC). */
const SENIOR_TONE_EMPLOYER_RE = /\b(?:quest(?:\s*global)?|glidewell|intverse|srijan)\b/i;

/**
 * True when company/role text belongs to a senior-tone employer.
 * Senior ONLY: Quest Global / Quest, Glidewell, INTVERSE, Srijan.
 * Mid-level: KOCO, Rubico, Artisanssoft, and other older/junior-era roles.
 */
export function isSeniorToneEmployer(companyOrRoleText) {
  return SENIOR_TONE_EMPLOYER_RE.test(String(companyOrRoleText || ''));
}

/**
 * Mid-level professional polish — competent IC voice.
 * Scrubs Helped/Assisted/Worked on fluff → Developed/Built/Delivered.
 * Does NOT escalate to Architected/Owned/Drove/Mentored senior bar.
 * Does NOT invent metrics or employers.
 */
export function elevateBulletToMidLevel(text) {
  let t = String(text || '').trim();
  if (!t) return '';

  t = t.replace(/^\*\*[^*]+\*\*:\s*/g, '').replace(/^([A-Z][A-Za-z0-9 &/+-]{2,40}):\s+/, '');

  // "Assisted Acme with X" / "Helped Acme with X" → mid verbs (not Drove)
  t = t.replace(
    /^(?:Assisted|Helped)\s+([A-Z][\w.&-]{1,40})\s+with\s+(.+)$/i,
    (_, company, rest) => {
      const body = String(rest).replace(/[.!]+$/, '').trim();
      return body ? `Implemented ${body} at ${company}.` : t;
    },
  );

  const openingMap = [
    [/^Helped (?:to |with |the )?/i, 'Delivered '],
    [/^Assisted (?:with |in |the )?/i, 'Implemented '],
    [/^Supported (?:the |a )?/i, 'Supported '],
    [/^Worked on\s+/i, 'Built '],
    [/^Worked with\s+/i, 'Collaborated with '],
    [/^Participated in\s+/i, 'Contributed to '],
    [/^Responsible for\s+/i, 'Delivered '],
    [/^Duties included\s+/i, 'Delivered '],
    [/^Tasked with\s+/i, 'Implemented '],
    [/^Provided mentorship to\s+/i, 'Guided '],
    [/^Provided\s+/i, 'Delivered '],
    [/^Made\s+/i, 'Built '],
    [/^Did\s+/i, 'Delivered '],
  ];
  for (const [re, rep] of openingMap) {
    if (re.test(t)) {
      t = t.replace(re, rep);
      break;
    }
  }

  t = t
    .replace(/\bmultiple client projects\b/gi, 'client platforms')
    .replace(/\band building the frontend\b/gi, 'and built the frontend')
    .replace(/\band building\b/gi, 'and built')
    .replace(/\butiliz(?:ed|ing)\b/gi, 'using')
    .replace(/\bhelped (?:to )?ensure\b/gi, 'ensured')
    .replace(/\bwas responsible for\b/gi, 'delivered')
    .replace(/\bmy work involved\b/gi, 'delivered');

  t = t.replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/^([^A-Za-z]*)([a-z])/, (_, pre, c) => `${pre}${c.toUpperCase()}`);
  if (t && !/[.!?]$/.test(t)) t += '.';
  return t;
}

/**
 * Company-aware elevation: senior bar for Quest/Glidewell/INTVERSE/Srijan only;
 * mid-level polish for KOCO/Rubico/Artisanssoft and everything else.
 */
export function elevateBulletForEmployer(bullet, companyOrRoleText) {
  const text = String(bullet || '');
  if (isSeniorToneEmployer(companyOrRoleText) || isSeniorToneEmployer(text)) {
    return elevateBulletToSenior(text);
  }
  return elevateBulletToMidLevel(text);
}

/**
 * Elevate a bullet to Senior Software Engineer / LinkedIn professional bar.
 * Keeps facts + metrics; upgrades junior task-list tone → ownership/impact tone.
 * Does NOT invent metrics or employers.
 * Prefer elevateBulletForEmployer at call sites so mid employers are not oversold.
 */
export function elevateBulletToSenior(text) {
  let t = String(text || '').trim();
  if (!t) return '';

  // Strip markdown bold labels left in ("Architecture: …")
  t = t.replace(/^\*\*[^*]+\*\*:\s*/g, '').replace(/^([A-Z][A-Za-z0-9 &/+-]{2,40}):\s+/, '');

  // "Assisted Acme with X" / "Helped Acme with X" → "Drove X at Acme" (avoid "Drove Acme with…")
  t = t.replace(
    /^(?:Assisted|Helped)\s+([A-Z][\w.&-]{1,40})\s+with\s+(.+)$/i,
    (_, company, rest) => {
      const body = String(rest).replace(/[.!]+$/, '').trim();
      return body ? `Drove ${body} at ${company}.` : t;
    },
  );

  // Junior / soft openings → senior ownership verbs (LinkedIn style)
  const openingMap = [
    [/^Helped (?:to |with |the )?/i, 'Drove '],
    [/^Assisted (?:with |in |the )?/i, 'Drove '],
    [/^Supported (?:the |a )?/i, 'Partnered on '],
    [/^Worked on\s+/i, 'Delivered '],
    [/^Worked with\s+/i, 'Partnered with '],
    [/^Participated in\s+/i, 'Contributed to '],
    [/^Responsible for\s+/i, 'Owned '],
    [/^Duties included\s+/i, 'Delivered '],
    [/^Tasked with\s+/i, 'Owned '],
    [/^Analyzed\s+/i, 'Diagnosed '],
    [/^Configured\s+/i, 'Hardened '],
    [/^Conducted\s+(?:peer )?code reviews\b/i, 'Led peer code reviews'],
    [/^Conducted\s+/i, 'Led '],
    [/^Provided mentorship to\s+/i, 'Mentored '],
    [/^Provided\s+/i, 'Delivered '],
    [/^Authored\s+/i, 'Architected '],
    [/^Created\s+/i, 'Launched '],
    [/^Constructed\s+/i, 'Instituted '],
    [/^Developed\s+and\s+maintained\s+/i, 'Engineered and maintained '],
    [/^Developed\s+and\s+deployed\s+/i, 'Engineered and deployed '],
    [/^Developed\s+/i, 'Engineered '],
    [/^Built\s+and launched\s+/i, 'Shipped '],
    [/^Built\s+/i, 'Delivered '],
    [/^Made\s+/i, 'Delivered '],
    [/^Did\s+/i, 'Delivered '],
    [/^Handled\s+/i, 'Owned '],
    [/^Managed\s+multiple client projects\b/i, 'Owned delivery across client platforms'],
  ];
  for (const [re, rep] of openingMap) {
    if (re.test(t)) {
      t = t.replace(re, rep);
      break;
    }
  }

  // Soft / junior phrases → senior professional phrasing
  t = t
    .replace(/\bfostering a culture of excellence\b/gi, 'raising engineering quality')
    .replace(/\bmultiple client projects\b/gi, 'production client platforms')
    .replace(/\band building the frontend\b/gi, 'and built the frontend')
    .replace(/\band building\b/gi, 'and built')
    .replace(/\butiliz(?:ed|ing)\b/gi, 'using')
    .replace(/\bhelped (?:to )?ensure\b/gi, 'ensured')
    .replace(/\bworked closely with the network team to deploy\b/gi, 'partnered with networking to deploy')
    .replace(/\bensuring a smooth and scalable infrastructure\b/gi, 'hardening scalable infrastructure')
    .replace(/\bto maintain high code quality standards\b/gi, 'to hold a high code-quality bar')
    .replace(/\bfostering\b/gi, 'driving')
    .replace(/\bTeam Support:\s*/gi, 'Mentorship: ')
    .replace(/\bjunior developers\b/gi, 'engineers')
    .replace(/\bjunior engineers\b/gi, 'engineers');

  // Prefer ownership framing mid-sentence when still task-y
  t = t.replace(/\bwas responsible for\b/gi, 'owned');
  t = t.replace(/\bmy work involved\b/gi, 'delivered');

  t = t.replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/^([^A-Za-z]*)([a-z])/, (_, pre, c) => `${pre}${c.toUpperCase()}`);
  if (t && !/[.!?]$/.test(t)) t += '.';
  return t;
}

/**
 * Strip leaked job-board chrome, double metrics, and GraphQL/REST mashups.
 * Defense in depth for Indeed UI tokens (Find/Apply/…) and bad polish merges.
 */
export function scrubResumeArtifacts(text) {
  let t = String(text || '');
  if (!t) return '';

  // Parenthetical / trailing junk weaves from keyword align
  t = t.replace(/\s*\((?:Find|Apply|Search|Sign|Join|Save|Share|View|Click|Report)\)\.?/gi, '');
  t = t.replace(/\s+(?:using|with|and)\s+(?:Find|Apply|Search|Sign|Join|Save|Share|View|Click)\b\.?/gi, '');
  t = t.replace(/\bin\s+Find\b/gi, 'in production systems');
  t = t.replace(/\b(?:Find|Apply|Search)\s*,\s*/gi, '');
  t = t.replace(/,\s*(?:Find|Apply|Search)\b/gi, '');

  // Double / conflicting metrics: "by 40% By 45%"
  t = t.replace(/\bby\s+(\d+(?:\.\d+)?%?)\s+by\s+(\d+(?:\.\d+)?%?)/gi, 'by $1');
  t = t.replace(/(\d+(?:\.\d+)?%)\s+By\s+(\d+(?:\.\d+)?%)/g, '$1');

  // Mid-sentence Title Case crumbs after polish
  t = t.replace(/(\)|%|ms)\s+And\s+/g, '$1 and ');
  t = t.replace(/(\d+%)\s+By\s+/g, '$1 by ');

  // Unit casing
  t = t.replace(/\b(\d+)\s*Ms\b/g, '$1ms');
  t = t.replace(/\b(\d+)\s*MS\b/g, '$1ms');

  // Contradictory API phrasing
  t = t.replace(/\bGraphQL\s+RESTful\s+APIs?\b/gi, 'GraphQL APIs');
  t = t.replace(/\bRESTful\s+GraphQL\s+APIs?\b/gi, 'GraphQL APIs');

  // Incomplete LLM tails — drop inventing filler; leave for isIncompleteBullet to remove
  t = t.replace(/\bsynthesizing using\.?\s*$/i, '');
  t = t.replace(/\bDelivered\s+(\d+(?:\.\d+)?%)\s+through\s*$/gi, '');

  // Strict Anti-AI: Eliminate em-dashes (—), en-dashes (–) and double-hyphens (--) that look like LLM output
  t = t.replace(/\s*—\s*/g, ', ');
  t = t.replace(/\s*–\s*/g, ', ');
  t = t.replace(/\s+--\s+/g, ', ');
  t = t.replace(/\s{2,}/g, ' ');
  t = t.replace(/,\s*,/g, ',');

  return t.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
}

/**
 * Force professional bullet casing and punctuation.
 * Every bullet must start with A–Z (or a digit for metrics that belong mid-clause).
 */
export function normalizeBulletText(bullet, companyOrRoleText = '') {
  const company = String(companyOrRoleText || '');
  let t = elevateBulletForEmployer(
    repairMidSentenceArtifacts(scrubResumeArtifacts(String(bullet || ''))),
    company,
  )
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^[•\-*▸]\s*/, '')
    .replace(/,\s*\./g, '.')
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!t) return '';
  // Drop trailing junk truncations left by scrubbers / bad LLM cuts (repeat until stable)
  let prev = '';
  while (t !== prev) {
    prev = t;
    t = t.replace(/,?\s*(advancing the continuous|the continuous)\s*[.,]*$/i, '').trim();
    t = t.replace(/\s+\b(and|with|to|of|by|from|cut)\s*[.,]*$/i, '').trim();
    t = t.replace(/[,:;]\s*$/g, '').trim();
  }
  if (!t) return '';
  // Capitalize first alphabetic character
  t = t.replace(/^([^A-Za-z]*)([a-z])/, (_, pre, c) => `${pre}${c.toUpperCase()}`);
  if (!/[.!?]$/.test(t)) t += '.';
  t = protectCompoundHyphens(elevateBulletForEmployer(t, company || t));
  return t;
}

/** Keep token-by-token / end-to-end on one line in PDF (ASCII hyphen is a wrap point). */
export function protectCompoundHyphens(text) {
  return String(text || '').replace(
    /\b(token-by-token|end-to-end|peer-to-peer|day-to-day|line-by-line)\b/gi,
    (m) => m.replace(/-/g, '\u2011'),
  );
}

/** Past-tense / strong action verbs that legitimately open a resume bullet. */
const BULLET_ACTION_START =
  /^(Developed|Built|Created|Designed|Implemented|Owned|Led|Managed|Delivered|Engineered|Integrated|Deployed|Provisioned|Configured|Wrote|Maintained|Authored|Formulated|Optimized|Architected|Automated|Established|Enhanced|Expanded|Improved|Streamlined|Accelerated|Reduced|Tuned|Partnered|Collaborated|Mentored|Conducted|Analyzed|Migrated|Refactored|Launched|Constructed|Enforced|Spearheaded|Drove|Ran|Cut|Grew|Shipped|Supported|Coordinated|Orchestrated|Remodeled|Reconfigured)\b/;

const EMBEDDED_JOB_DATE =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{4}\s*(?:[-–—]|to)\s*(?:Present|Current|Now|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4})/i;
const EMBEDDED_ROLE_KW =
  /\b(?:Software|Engineer|Developer|Manager|Architect|Lead|Senior|Full-Stack|Full Stack|Back-End|Front-End|DevOps|Associate|Analyst|Consultant|Specialist)\b/i;
const EMBEDDED_COMPANY_MARKERS =
  /\b(?:Pvt|Ltd|LLC|Inc|Corp|Services|Technologies|Tech|IT|Global|Solutions|Software|Schools)\b/i;

/** True when a "bullet" is actually a pasted job header (company — role | dates). */
export function isEmbeddedJobHeader(text) {
  const t = String(text || '').trim().replace(/^[•\-*▸]\s*/, '');
  if (!t || t.length < 20) return false;
  const hasDates =
    EMBEDDED_JOB_DATE.test(t)
    || /\b(19|20)\d{2}\s*(?:[-–—]|to)\s*((?:19|20)\d{2}|Present|Current|Now)\b/i.test(t);
  if (!hasDates) return false;
  if (/^[\w\s&.',()-]+[-–—|]\s*[\w\s]+(?:Developer|Engineer|Manager|Architect|Lead|Specialist)/i.test(t)) {
    return true;
  }
  const withoutDates = t
    .replace(EMBEDDED_JOB_DATE, '')
    .replace(/\b(19|20)\d{2}\s*(?:[-–—]|to)\s*((?:19|20)\d{2}|Present|Current|Now)\b/gi, '')
    .trim();
  return EMBEDDED_ROLE_KW.test(withoutDates)
    && (EMBEDDED_COMPANY_MARKERS.test(withoutDates) || /[-–—|]/.test(withoutDates));
}

/**
 * Remove job-header lines that landed inside another role's bullets (import/LLM artifact).
 * Also strips cross-role contamination and duplicate bullets.
 */
function bulletKey(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function companyCore(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(pvt|ltd|llc|inc|corp|it|services|technologies|tech|software|global|schools|engineering)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/** Bullet explicitly names a different employer from the jobs list. */
function bulletMentionsOtherCompany(bullet, ownCompany, allJobs) {
  if (isEmbeddedJobHeader(bullet)) return true;
  const b = String(bullet || '').toLowerCase();
  const own = companyCore(ownCompany);
  for (const job of allJobs) {
    const co = companyCore(job.company);
    if (!co || co.length < 4 || co === own) continue;
    if (b.includes(co)) return true;
    const rawCo = String(job.company || '').trim().toLowerCase();
    if (rawCo.length >= 5 && b.includes(rawCo.slice(0, Math.min(rawCo.length, 14)))) return true;
  }
  return false;
}

/** Fix mid-sentence LLM splice crumbs inside a single bullet string. */
export function repairMidSentenceArtifacts(bullet) {
  let t = String(bullet || '');
  t = t.replace(/[\u00ad\u200b-\u200d\uFEFF\uFFFD]/g, '');
  t = t.replace(/â€"|â€“|â€”|â€˜|â€™/g, '-');
  t = t.replace(/\bservices\s+Integrity\s+through\b/gi, 'services, preserving data integrity through');
  t = t.replace(/\brecords,?\s+preserving\.?\s*Integrity\s+through\b/gi, 'records, preserving data integrity through');
  t = t.replace(/,\s*preserving data\.?\s*$/i, ', preserving data integrity.');
  t = t.replace(/\bplatform,?\s+synthesizing\.?\s*Logic\s+into\b/gi, 'platform, synthesizing business logic into');
  t = t.replace(/\s+In addition,?\s+I\s+/gi, '. Also ');
  t = t.replace(/\bworkflows\s+that\s+reduced\.?\s*$/i, 'workflows that reduced manual effort.');
  return t.trim();
}

/** Same bullet copied into multiple roles — keep in the oldest role (bottom of resume). */
function wordOverlapRatio(a, b) {
  const wa = new Set(bulletKey(a).split(/\s+/).filter((w) => w.length > 3));
  const wb = new Set(bulletKey(b).split(/\s+/).filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter += 1;
  return inter / Math.min(wa.size, wb.size);
}

export function dedupeBulletsAcrossJobs(experience) {
  if (!Array.isArray(experience)) return [];
  const keyOwners = new Map();
  experience.forEach((job, idx) => {
    for (const b of job.bullets || []) {
      const k = bulletKey(b);
      if (!k || k.length < 24) continue;
      if (!keyOwners.has(k)) keyOwners.set(k, new Set());
      keyOwners.get(k).add(idx);
    }
  });

  let jobs = experience.map((job, idx) => ({
    ...job,
    bullets: (job.bullets || []).filter((b) => {
      const k = bulletKey(b);
      const owners = keyOwners.get(k);
      if (owners && owners.size > 1) {
        const keeper = Math.max(...owners);
        if (idx !== keeper) return false;
      }
      for (let j = 0; j < experience.length; j++) {
        if (j === idx) continue;
        for (const ob of experience[j].bullets || []) {
          if (bulletKey(b).length > 35 && wordOverlapRatio(b, ob) >= 0.55) {
            return idx > j;
          }
        }
      }
      return true;
    }),
  }));
  return jobs;
}

/** Display date ranges as "Jul 2025 - Present". Never --, en-dash, or em-dash. */
export function formatPeriodDisplay(raw) {
  return String(raw || '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeExperienceEntries(experience) {
  if (!Array.isArray(experience)) return [];
  let jobs = experience
    .map((job) => ({
      ...job,
      period: formatPeriodDisplay(job.period || ''),
      bullets: (Array.isArray(job.bullets) ? job.bullets : [])
        .map(repairMidSentenceArtifacts)
        .filter((b) => !isEmbeddedJobHeader(b)),
    }))
    .filter((job) => job.role || job.company);

  jobs = jobs.map((job) => ({
    ...job,
    bullets: normalizeExperienceBulletList(
      (job.bullets || []).filter((b) => !bulletMentionsOtherCompany(b, job.company, jobs)),
      `${job.company || ''} ${job.role || ''}`,
    ),
  }));

  jobs = dedupeBulletsAcrossJobs(jobs);
  return jobs.filter((job) => (job.bullets || []).length > 0 || job.role || job.company);
}

/** True when a bullet looks truncated (dangling gerund / connector). */
export function isIncompleteBullet(bullet) {
  const raw = String(bullet || '').trim();
  const t = raw.replace(/[.!]+$/, '');
  if (!t) return true;
  if (/\b(synthesizing|preserving|integrating|including|using|building|deploying|writing|maintaining|and|with|to|of|by|from|via|into|through|for|across)\s*$/i.test(t)) {
    return true;
  }
  // "reducing database." / "improving performance." without a quantified outcome
  if (
    /\b(reducing|improving|optimizing|enhancing|increasing|decreasing|cutting|lowering)\s+[A-Za-z][A-Za-z0-9+/-]{1,24}\s*$/i.test(t)
    && !/\bby\s+\d/i.test(raw)
    && !/\d\s*%/.test(raw)
  ) {
    return true;
  }
  // Orphan crumbs: "Construction, directly." / "not just tickets."
  if (/^[A-Z][a-z]+,\s+(directly|effectively|successfully|quickly|well)\s*$/i.test(t)) return true;
  if (/\bnot just\b/i.test(t) && t.split(/\s+/).length <= 6) return true;
  if (/\bfrom\s+\d+(?:\.\d+)?\.?\s*$/i.test(t)) return true;
  if (/\bthat\s+(reduced|cut|decreased|lowered|improved|increased|raised|optimized)\.?\s*$/i.test(t)) return true;
  if (
    /\b(reduced|cut|decreased|lowered|improved|increased|orchestrated|configured|integrated)\.?\s*$/i.test(t)
    && !/\bby\s+\d/i.test(raw)
  ) {
    return true;
  }
  if (/,\s*$/.test(raw)) return true;
  if (/\.\.\.$/.test(raw)) return true;
  // Truncated "…to RESTful API." without finishing the clause
  if (/\bto\s+RESTful API\.?$/i.test(t) && !/\b(construction|delivery|endpoints|layers)\b/i.test(t)) return true;
  // Very short fragment after scrub (under 3 content words)
  if (t.split(/\s+/).length < 3 && !hasQuantifiedImpact(raw)) return true;
  return false;
}

/**
 * True when merge/LLM left mid-sentence garbage that must never print on a resume.
 * Prefer drop over inventing a repair.
 */
export function isGarbledBullet(bullet) {
  const t = String(bullet || '').trim();
  if (!t) return true;
  if (/\bservices\s+Integrity\b/i.test(t)) return true;
  if (/\.\s+(Integrity|Logic|Construction|Authentication)\b/.test(t)) return true;
  if (/Construction,\s+directly\s+Owning/i.test(t)) return true;
  if (/Delivered handling\b/i.test(t)) return true;
  if (/\bAPI\.\s*Construction\b/i.test(t)) return true;
  // Mid-bullet capital noun + through/into after a complete clause (no action verb)
  if (
    /\bNode\.js services\.?\s+Integrity through\b/i.test(t)
    || /\bservices\.?\s+Integrity through\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

/** Drop Integrity/Construction merge leaks; keep leading clause when salvageable. */
export function repairGarbledBullet(bullet) {
  const t = String(bullet || '').trim();
  if (!t) return '';
  if (/\bIntegrity through\b/i.test(t)) {
    const before = t.split(/\bIntegrity through\b/i)[0].replace(/[.!?,;:\s]+$/g, '').trim();
    if (before.length >= 40 && !isGarbledBullet(before) && !isIncompleteBullet(before)) {
      return /[.!]$/.test(before) ? before : `${before}.`;
    }
    return '';
  }
  if (/Construction,\s+directly/i.test(t) || /Delivered handling\b/i.test(t)) return '';
  return t;
}

/** True when a "bullet" is clearly a broken continuation of the previous line. */
export function isBulletContinuationFragment(bullet) {
  const t = String(bullet || '').trim();
  if (!t) return true;
  // Preposition / conjunction crumbs — never standalone bullets
  if (/^(by|and|with|to|from|into|of|for|on|in|at|as|while|which|that|or|via)\b/i.test(t)) {
    return true;
  }
  // Metric continuations: "800ms to 120ms..." even when the rest of the sentence is long
  if (/^[\d$][\d,]*(?:\.\d+)?\s*(?:ms|s|x|%|k|m|b)?\b/i.test(t)) return true;
  if (/^[\d$]/.test(t) && t.length < 140) return true;
  // Short lowercase crumbs only (full lowercase sentences get capitalized, not merged)
  if (/^[a-z]/.test(t) && t.length < 40) return true;

  // Noun-phrase orphans from mid-sentence LLM / explode splits (KOCO / Artisanssoft)
  // e.g. "Logic into scalable…", "Integrity through…", "Authentication flows that…"
  if (/^(Logic|Integrity|Authentication|Authorization|Availability|Scalability)\b/i.test(t)) {
    return true;
  }
  if (/^(Business logic|Data integrity|Complex business|Authentication flows?|Authorization flows?)\b/i.test(t)) {
    return true;
  }
  if (/^(Preventing|Preserving|Integrating|Including|Maintaining|Synthesizing|Delivered handling)\b/i.test(t)) {
    return true;
  }
  if (/^In addition\b/i.test(t)) return true;
  // Capitalized noun + connector, no action verb — almost always a continuation crumb
  if (
    !BULLET_ACTION_START.test(t)
    && /^[A-Z][a-z]+(?:\s+[a-z]+)?\s+(into|through|via|that|with|for|from|across|under)\b/.test(t)
    && t.length < 160
  ) {
    return true;
  }
  return false;
}

/**
 * Parse employment period → tenure in months (best-effort).
 * "Present"/"Current" end dates use today's month.
 */
export function parseTenureMonths(period) {
  if (!period) return 12;
  const clean = String(period).toLowerCase();
  const monthNames = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const matches = [...clean.matchAll(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|sept|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{4})\b/g,
  )];
  if (matches.length >= 1) {
    const startMonth = monthNames[matches[0][1].slice(0, 3)];
    const startYear = parseInt(matches[0][2], 10);
    let endMonth;
    let endYear;
    if (matches.length >= 2) {
      endMonth = monthNames[matches[1][1].slice(0, 3)];
      endYear = parseInt(matches[1][2], 10);
    } else if (/\b(present|current|now)\b/i.test(clean)) {
      const now = new Date();
      endMonth = now.getMonth();
      endYear = now.getFullYear();
    } else {
      return 12;
    }
    const months = (endYear - startYear) * 12 + (endMonth - startMonth);
    return Number.isFinite(months) && months > 0 ? months : 12;
  }
  return 12;
}

/**
 * Bullet budget by role recency + tenure.
 * Roles with 18+ months get at least 3; 24+ months prefer 4 (not capped at 2 by index alone).
 */
export function bulletsBudgetForRole(roleIndex, opts = {}) {
  const maxPages = opts.maxPages ?? 2;
  const tenureMonths = opts.tenureMonths ?? 12;
  let base;
  if (maxPages >= 3) base = roleIndex < 3 ? 6 : roleIndex < 5 ? 4 : 3;
  else if (maxPages >= 2) base = roleIndex < 3 ? 5 : roleIndex < 5 ? 3 : 2;
  else base = roleIndex < 2 ? 4 : 3;

  let floor = 0;
  if (tenureMonths >= 24) floor = 4;
  else if (tenureMonths >= 18) floor = 3;
  return Math.max(base, floor);
}

/**
 * When tailored bullets are too thin or contain orphan fragments, prefer normalized profile source.
 */
export function preferSourceIfThin(tailoredBullets, sourceBullets, opts = {}) {
  const maxBullets = opts.maxBullets ?? 6;
  const minCount = opts.minCount ?? 3;
  const minAvgLen = opts.minAvgLen ?? 70;
  const tailoredRaw = Array.isArray(tailoredBullets) ? tailoredBullets : [];
  const sourceRaw = Array.isArray(sourceBullets) ? sourceBullets : [];

  const hasOrphanFragments = tailoredRaw.some(
    (b) => isBulletContinuationFragment(b) || isIncompleteBullet(b),
  );
  const company = opts.company || opts.companyOrRoleText || '';
  const tailored = normalizeExperienceBulletList(tailoredRaw, company);
  const source = normalizeExperienceBulletList(sourceRaw, company);

  const avgLen = tailored.length
    ? tailored.reduce((sum, b) => sum + b.length, 0) / tailored.length
    : 0;
  const tooThin = tailored.length < minCount || avgLen < minAvgLen;

  if (
    source.length > 0
    && (hasOrphanFragments || tooThin)
    && (source.length >= tailored.length || hasOrphanFragments)
  ) {
    // Prefer source when it is richer or when orphans make tailored untrustworthy
    if (hasOrphanFragments || source.length > tailored.length || (tooThin && source.length >= minCount)) {
      return source.slice(0, maxBullets);
    }
  }
  return tailored.slice(0, maxBullets);
}

/**
 * Rewrite essay-style first person into resume action bullets.
 */
export function rewriteFirstPersonBullet(text) {
  let t = String(text || '').trim();
  if (!t) return '';

  const gerundToPast = {
    developing: 'Developed',
    building: 'Built',
    creating: 'Created',
    maintaining: 'Maintained',
    implementing: 'Implemented',
    designing: 'Designed',
    writing: 'Wrote',
    deploying: 'Deployed',
    managing: 'Managed',
    leading: 'Led',
    integrating: 'Integrated',
    configuring: 'Configured',
    provisioning: 'Provisioned',
  };

  const replaceGerundLead = (prefixRe, fallback) => {
    t = t.replace(prefixRe, (_, g) => {
      const key = String(g || '').toLowerCase();
      return gerundToPast[key] ? `${gerundToPast[key]} ` : fallback;
    });
  };

  t = t.replace(/^As an?\s+[^,]{2,60},\s*/i, '');
  replaceGerundLead(/^I was responsible for\s+(developing|building|creating|maintaining|implementing|designing|writing|deploying|managing|leading|integrating)\s+/i, 'Owned ');
  t = t.replace(/^I was responsible for\s+/i, 'Owned ');
  t = t.replace(/^I am responsible for\s+/i, 'Own ');
  t = t.replace(/^I also worked closely with\s+/i, 'Partnered with ');
  t = t.replace(/^I worked closely with\s+/i, 'Partnered with ');
  replaceGerundLead(/^My work involved\s+(building|writing|deploying|developing|creating|maintaining|implementing|designing|integrating)\s+/i, 'Delivered ');
  t = t.replace(/^My work involved\s+/i, 'Delivered ');
  t = t.replace(/^I also\s+/i, '');
  t = t.replace(
    /^I\s+(developed|built|created|designed|implemented|owned|led|managed|delivered|engineered|integrated|deployed|provisioned|configured|wrote|maintained)\s+/i,
    (_, verb) => `${verb.charAt(0).toUpperCase()}${verb.slice(1)} `
  );
  t = t.replace(/^I\s+/i, '');
  // "Owned developing X" leftovers
  t = t.replace(/^Owned\s+(developing|building|creating|maintaining)\s+/i, (_, g) => `${gerundToPast[g.toLowerCase()] || 'Owned'} `);
  t = t.replace(/^Delivered\s+(building|writing|deploying|developing)\s+/i, (_, g) => `${gerundToPast[g.toLowerCase()] || 'Delivered'} `);
  // Parallel-structure cleanup after gerund → past rewrites
  t = t.replace(/\bDeveloped and maintaining\b/gi, 'Developed and maintained');
  t = t.replace(/\bBuilt and maintaining\b/gi, 'Built and maintained');
  t = t.replace(/,\s*writing\s+/gi, ', wrote ');
  t = t.replace(/,\s*deploying\s+/gi, ', deployed ');
  t = t.replace(/,\s*building\s+/gi, ', built ');
  t = t.replace(/\sand building\b/gi, ' and built');
  t = t.replace(/\sand deploying\b/gi, ' and deployed');
  t = t.replace(/\sand maintaining\b/gi, ' and maintained');
  t = t.replace(/\sand writing\b/gi, ' and wrote');
  t = t.replace(/^([^A-Za-z]*)([a-z])/, (_, pre, c) => `${pre}${c.toUpperCase()}`);
  return t.trim();
}

/**
 * Split wall-of-text / essay bullets into multiple short bullets (like other roles).
 * LLM sometimes returns one giant first-person paragraph for older roles (e.g. Rubico).
 */
export function explodeWallOfTextBullets(bullets, opts = {}) {
  const maxChars = opts.maxChars ?? 200;
  const maxOut = opts.maxBullets ?? 6;
  const minPart = opts.minPartChars ?? 28;
  const out = [];

  for (const raw of Array.isArray(bullets) ? bullets : []) {
    let t = String(raw || '').trim();
    if (!t) continue;

    const sentenceBreaks = (t.match(/[.!?]\s+/g) || []).length;
    const firstPersonEssay = /^(As an?\s|I\s|My\s)/i.test(t) && sentenceBreaks >= 1;
    const isWall = t.length > maxChars || firstPersonEssay || (sentenceBreaks >= 2 && t.length > 160);

    if (!isWall) {
      out.push(rewriteFirstPersonBullet(t));
      continue;
    }

    // Prefer splitting on sentence ends before a capital letter
    let parts = t.split(/(?<=[.!?])\s+(?=[A-Z“"])/).map((s) => s.trim()).filter((s) => s.length >= minPart);

    // Fallback: split on "; " or " — " for long run-ons without clean periods
    if (parts.length <= 1 && t.length > maxChars) {
      parts = t.split(/\s*;\s+|\s+[—–]\s+/).map((s) => s.trim()).filter((s) => s.length >= minPart);
    }

    if (parts.length <= 1) {
      out.push(rewriteFirstPersonBullet(t));
      continue;
    }

    for (const part of parts) {
      const cleaned = rewriteFirstPersonBullet(part);
      if (cleaned.length >= minPart) out.push(cleaned);
    }
  }

  // Dedupe near-identical lines
  const seen = new Set();
  const deduped = [];
  for (const b of out) {
    const key = b.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(b);
  }
  // Cap wall explosions, but never drop already-discrete input bullets
  // (default maxOut=6 was truncating 7+ short employer samples in normalize).
  const inputCount = (Array.isArray(bullets) ? bullets : [])
    .map((b) => String(b || '').trim())
    .filter(Boolean).length;
  return deduped.slice(0, Math.max(maxOut, inputCount));
}

/**
 * Merge continuation crumbs into the previous bullet, then normalize casing.
 * Also explodes wall-of-text essays into multiple bullets first.
 */
export function normalizeExperienceBulletList(bullets, companyOrRoleText = '') {
  const company = String(companyOrRoleText || '');
  const input = (Array.isArray(bullets) ? bullets : []).filter((b) => !isEmbeddedJobHeader(b));
  const exploded = explodeWallOfTextBullets(input);
  const raw = exploded.map((b) => String(b || '').trim()).filter(Boolean);
  const merged = [];
  for (const bullet of raw) {
    const prevIncomplete = merged.length > 0 && isIncompleteBullet(merged[merged.length - 1]);
    const isCont = isBulletContinuationFragment(bullet);
    // Orphan noun crumbs after a complete sentence — drop, do not glue into garbage
    if (
      merged.length > 0
      && isCont
      && !prevIncomplete
      && /^(Logic|Integrity|Construction|Authentication|Authorization|Availability|Scalability)\b/i.test(bullet)
    ) {
      continue;
    }
    if (merged.length > 0 && (isCont || prevIncomplete)) {
      const prev = merged[merged.length - 1].replace(/[.!?,;:\s]+$/g, '');
      let cont = bullet.trim();
      // Avoid "by by 22%" when previous already ends with the same preposition
      cont = cont.replace(/^(by|and|with|to|from|into|of|for)\s+/i, (m, prep) => {
        if (new RegExp(`\\b${prep}$`, 'i').test(prev)) return '';
        return m;
      }).trim();
      // "synthesizing." + "Logic into…" → keep gerund object flowing in lowercase
      if (prevIncomplete && /^[A-Z]/.test(cont) && isBulletContinuationFragment(cont)) {
        cont = cont.replace(/^([A-Z])/, (c) => c.toLowerCase());
      }
      if (cont) merged[merged.length - 1] = `${prev} ${cont}`;
      continue;
    }
    merged.push(bullet);
  }
  return merged
    .map((b) => repairGarbledBullet(normalizeBulletText(b, company || b)))
    .filter((b) => b.length >= 20 && !isIncompleteBullet(b) && !isGarbledBullet(b));
}

/**
 * @param {object} resume
 * @param {object[]} [sourceExperience] — optional jobs with .company for tone gating
 */
export function normalizeResumeBullets(resume, sourceExperience = []) {
  if (!resume || typeof resume !== 'object') return resume;
  const exp = resume.experience;
  const companyFor = (idx) => {
    const job = Array.isArray(sourceExperience) ? sourceExperience[idx] : null;
    return job ? `${job.company || ''} ${job.role || ''}` : '';
  };
  if (Array.isArray(exp)) {
    resume.experience = normalizeExperienceBulletList(exp, companyFor(0));
  } else if (exp && typeof exp === 'object') {
    for (const key of Object.keys(exp)) {
      if (Array.isArray(exp[key])) {
        const idx = Number(key);
        exp[key] = normalizeExperienceBulletList(exp[key], companyFor(Number.isFinite(idx) ? idx : 0));
      }
    }
  }
  return resume;
}

function enrichBulletsWithMetrics(bullets, roleSourceBullets, allSourceBullets, allowSyntheticMetrics = false) {
  // Same-role facts only — grafting another employer's metric onto this role
  // invents history (e.g. Srijan's "20 hours/month" landing under Quest).
  const metricSources = roleSourceBullets.filter((s) => hasQuantifiedImpact(s));

  return bullets.map((b) => {
    let cleanB = removeSplicedFragments(cleanSpellingAndGrammar(b));
    if (hasQuantifiedImpact(cleanB)) return { bullet: cleanB, enriched: false };
    
    // Graft metric from overlapping source bullet only (honesty)
    if (metricSources.length > 0) {
      let best = null;
      let bestOverlap = 0;
      for (const src of metricSources) {
        const overlap = tokenOverlap(cleanB, src);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          best = src;
        }
      }
      if (best && bestOverlap >= 4) {
        const metric = extractMetricClause(best);
        if (metric) {
          const trimmed = String(cleanB).trim().replace(/\.$/, '');
          if (!trimmed.toLowerCase().includes(metric.toLowerCase())) {
            return { bullet: cleanSpellingAndGrammar(`${trimmed}, ${metric}.`), enriched: true };
          }
        }
      }
    }
    
    // Synthetic metrics are OFF — synthesizeMetric always returns null
    if (allowSyntheticMetrics) {
    const synthesized = synthesizeMetric(cleanB);
      if (synthesized) {
    const trimmed = String(cleanB).trim().replace(/\.$/, '');
    return { bullet: cleanSpellingAndGrammar(`${trimmed}, ${synthesized}.`), enriched: true };
      }
    }
    return { bullet: cleanB, enriched: false };
  });
}

function polishTextList(texts) {
  const usedGlobally = new Map();
  let intraFixes = 0;
  const pass1 = texts.map((t) => {
    const { text, fixes } = dedupeIntraSentenceRepetition(t, usedGlobally);
    intraFixes += fixes;
    return text;
  });
  const { texts: pass2, fixes: globalFixes } = dedupeGlobalWordFrequency(pass1, usedGlobally);
  return { texts: pass2, intraFixes, globalFixes };
}

function applyExperiencePolish(resume, sourceExperience, usedVerbs, allowSyntheticMetrics = false, preserveRoleIndices = []) {
  let verbsRotated = 0;
  let metricsEnriched = 0;
  let wordRepetitionsFixed = 0;
  const preserveSet = new Set((preserveRoleIndices || []).map(Number));

  const allSourceBullets = collectAllSourceBullets(sourceExperience);
  const roleBulletGroups = collectExperienceArrays(resume.experience);
  const polishedGroups = roleBulletGroups.map((bullets, roleIdx) => {
    if (preserveSet.has(roleIdx)) return bullets; // freeze KOCO/Rubico/Artisanssoft
    const roleSourceBullets = sourceExperience[roleIdx]?.bullets || [];
    const enriched = enrichBulletsWithMetrics(
      bullets,
      roleSourceBullets,
      allSourceBullets,
      allowSyntheticMetrics,
    );
    const metricEnriched = enriched.map(({ bullet, enriched: wasEnriched }) => {
      if (wasEnriched) metricsEnriched += 1;
      return bullet;
    });
    const { bullets: verbPolished, rotated } = dedupeVerbStarts(metricEnriched, usedVerbs);
    verbsRotated += rotated;

    const { texts, intraFixes, globalFixes } = polishTextList(verbPolished);
    wordRepetitionsFixed += intraFixes + globalFixes;
    return texts;
  });

  if (Array.isArray(resume.experience)) {
    resume.experience = polishedGroups[0] || [];
  } else if (resume.experience && typeof resume.experience === 'object') {
    const keys = Object.keys(resume.experience).sort((a, b) => Number(a) - Number(b));
    keys.forEach((key, i) => {
      resume.experience[key] = polishedGroups[i] || resume.experience[key];
    });
  }

  return { verbsRotated, metricsEnriched, wordRepetitionsFixed };
}

/**
 * Deterministic Zety-bar polish: unique verbs, graft-only metrics, casing, no keyword spam.
 * @param {object} resume
 * @param {object[]} [sourceExperience]
 * @param {object} [opts]
 * @param {number} [opts.jdAlignScore]
 * @param {boolean} [opts.allowSyntheticMetrics=false] — invent metrics only if explicitly enabled
 */
export function polishTailoredResume(resume, sourceExperience = [], opts = {}) {
  if (!resume || typeof resume !== 'object') {
    return {
      resume,
      stats: { verbsRotated: 0, metricsEnriched: 0, wordRepetitionsFixed: 0, atsContentScore: 0, polishIterations: 0 },
    };
  }

  const allowSyntheticMetrics = opts.allowSyntheticMetrics === true;
  const preserveRoleIndices = Array.isArray(opts.preserveRoleIndices) ? opts.preserveRoleIndices : [];
  const usedVerbs = new Set();
  let verbsRotated = 0;
  let metricsEnriched = 0;
  let wordRepetitionsFixed = 0;
  let polishIterations = 0;

  if (resume.summary) {
    const lines = String(resume.summary).split('\n').filter(Boolean);
    const { texts, intraFixes, globalFixes } = polishTextList(lines);
    wordRepetitionsFixed += intraFixes + globalFixes;
    resume.summary = texts.join('\n');
  }

  const scoreOpts = () => ({
    jdAlignScore: opts.jdAlignScore,
    competencyCount: Array.isArray(resume.core_competencies)
      ? resume.core_competencies.length
      : (opts.competencyCount || 0),
    summaryLines: String(resume.summary || '').split('\n').filter(Boolean).length,
  });

  let audit = auditResumeQuality(resume);
  let atsContentScore = estimateAtsContentScore(audit, scoreOpts());

  const MAX_ITER = 6;
  const polishDone = () =>
    atsContentScore >= ATS_TARGET_SCORE
    && (audit.repeatedVerbs || []).length === 0
    && audit.intraSentenceRepeats === 0;
  while (polishIterations < MAX_ITER && !polishDone()) {
    polishIterations += 1;
    // Fresh verb ledger each pass — carrying usedVerbs across iterations
    // forced every kept verb to rotate on pass 2 ("Enforce" → "Released").
    usedVerbs.clear();
    const pass = applyExperiencePolish(
      resume,
      sourceExperience,
      usedVerbs,
      allowSyntheticMetrics,
      preserveRoleIndices,
    );
    verbsRotated += pass.verbsRotated;
    metricsEnriched += pass.metricsEnriched;
    wordRepetitionsFixed += pass.wordRepetitionsFixed;

    if (resume.summary) {
      const lines = String(resume.summary).split('\n').filter(Boolean);
      const { texts, intraFixes, globalFixes } = polishTextList(lines);
      wordRepetitionsFixed += intraFixes + globalFixes;
      resume.summary = texts.join('\n');
    }

    audit = auditResumeQuality(resume);
    atsContentScore = estimateAtsContentScore(audit, scoreOpts());

    if (polishDone()) break;
  }

  normalizeResumeBullets(resume, sourceExperience);

  // Prefer profile source bullets when a role came back too thin or with orphan fragments
  if (Array.isArray(sourceExperience) && sourceExperience.length > 0 && resume.experience) {
    const applyFloor = (bullets, roleIdx) => {
      const src = sourceExperience[roleIdx]?.bullets || [];
      const tenureMonths = parseTenureMonths(sourceExperience[roleIdx]?.period);
      const budget = bulletsBudgetForRole(roleIdx, { tenureMonths, maxPages: opts.maxPages ?? 2 });
      const job = sourceExperience[roleIdx] || {};
      return preferSourceIfThin(bullets, src, {
        minCount: Math.min(3, budget),
        maxBullets: budget,
        company: `${job.company || ''} ${job.role || ''}`,
      });
    };
    if (Array.isArray(resume.experience)) {
      resume.experience = applyFloor(resume.experience, 0);
    } else if (typeof resume.experience === 'object') {
      for (const key of Object.keys(resume.experience)) {
        const idx = Number(key);
        if (!Number.isFinite(idx)) continue;
        resume.experience[key] = applyFloor(resume.experience[key], idx);
      }
    }
  }

  // Final artifact scrub on summary + competencies (bullets already normalized)
  if (resume.summary) {
    resume.summary = String(resume.summary)
      .split('\n')
      .map((line) => scrubResumeArtifacts(line))
      .filter(Boolean)
      .join('\n');
  }
  if (Array.isArray(resume.core_competencies)) {
    resume.core_competencies = resume.core_competencies
      .map((c) => String(c || '').trim())
      .filter((c) => c && !/^(find|apply|search|sign|join|save|share|view|click)$/i.test(c))
      .filter((c) => !/\b(cursor|copilot|chatgpt|chat\s*gpt|claude\s*code|\bclaude\b|\bgpts?\b)\b/i.test(c));
  }

  audit = auditResumeQuality(resume);
  atsContentScore = estimateAtsContentScore(audit, scoreOpts());

  return {
    resume,
    stats: {
      verbsRotated,
      metricsEnriched,
      wordRepetitionsFixed,
      atsContentScore,
      polishIterations,
      allowSyntheticMetrics,
    },
  };
}

export function countWordFrequency(texts, minLen = 4) {
  const counts = {};
  for (const text of texts) {
    for (const m of String(text).matchAll(/\b([A-Za-z]+)\b/g)) {
      const lower = m[1].toLowerCase();
      if (lower.length < minLen || STOPWORDS.has(lower)) continue;
      if (!isReplaceableWord(lower)) continue;
      counts[lower] = (counts[lower] || 0) + 1;
    }
  }
  return counts;
}

/** Domain terms a senior resume cannot avoid repeating — never penalized. */
const DOMAIN_TERM_ALLOWLIST = new Set([
  'aws', 'api', 'apis', 'sql', 'node', 'react', 'java', 'python', 'linux',
  'docker', 'kafka', 'redis', 'oracle', 'postgres', 'postgresql', 'mongodb',
  'azure', 'lambda', 'fastapi', 'microservices', 'microservice', 'services',
  'service', 'backend', 'frontend', 'database', 'databases', 'pipelines',
  'pipeline', 'systems', 'system', 'server', 'servers', 'cloud', 'deploy',
  'deployment', 'deployments', 'queries', 'query', 'schema', 'event-driven',
  'events', 'streaming', 'typescript', 'javascript', 'components', 'testing',
  'integration', 'production', 'engineers', 'platform', 'architecture',
]);

/** Parse "word×n" audit entries, keeping only entries whose count clears `minCount`. */
function heavyRepeatEntries(entries, minCount, allowlist = null) {
  return (entries || []).filter((entry) => {
    const m = String(entry).match(/^(.+?)×(\d+)$/);
    if (!m) return false;
    if (allowlist && allowlist.has(m[1].toLowerCase())) return false;
    return Number(m[2]) >= minCount;
  });
}

export function auditResumeQuality(resume) {
  const groups = collectExperienceArrays(resume?.experience);
  const allBullets = groups.flat();
  const summaryLines = String(resume?.summary || '').split('\n').filter(Boolean);
  const allText = [...summaryLines, ...allBullets];

  const verbCounts = {};
  let withoutMetrics = 0;
  let incompleteSentences = 0;
  let intraSentenceRepeats = 0;

  for (const bullet of allBullets) {
    const verb = extractLeadingVerb(bullet);
    if (verb) verbCounts[verb] = (verbCounts[verb] || 0) + 1;
    if (!hasQuantifiedImpact(bullet)) withoutMetrics += 1;
    const trimmed = String(bullet || '').trim();
    if (!/^[A-Z0-9]/.test(trimmed) || !/[.!?]$/.test(trimmed) || trimmed.length < 28) {
      incompleteSentences += 1;
    }

    const seen = new Set();
    for (const m of String(bullet).matchAll(/\b([A-Za-z]{4,})\b/g)) {
      const lower = m[1].toLowerCase();
      if (!isReplaceableWord(lower)) continue;
      if (seen.has(lower)) intraSentenceRepeats += 1;
      seen.add(lower);
    }
  }

  // Per-role metric density: a role with 2+ quantified bullets reads as
  // impact-driven; one quantified bullet is half credit. Honest resumes
  // distribute metrics per role, not per bullet.
  const roleScores = groups
    .filter((g) => g.length > 0)
    .map((g) => Math.min(1, g.filter((b) => hasQuantifiedImpact(b)).length / 2));
  const metricRolePct = roleScores.length
    ? roleScores.reduce((s, v) => s + v, 0) / roleScores.length
    : 0;

  const wordFreq = countWordFrequency(allText);
  // Allow one natural reuse across a long resume; flag heavy overuse (3+)
  const repeatedWords = Object.entries(wordFreq)
    .filter(([, n]) => n >= 3)
    .map(([w, n]) => `${w}×${n}`);

  const repeatedVerbs = Object.entries(verbCounts)
    .filter(([, n]) => n > 1)
    .map(([v, n]) => `${v}×${n}`);

  return {
    totalBullets: allBullets.length,
    withoutMetrics,
    incompleteSentences,
    repeatedVerbs,
    repeatedWords,
    intraSentenceRepeats,
    metricRolePct,
  };
}

/**
 * Heuristic 0–100 ATS content score (Zety hybrid).
 * Factors: complete sentences, per-role metric density, unique verbs, JD coverage, competency density.
 * Does NOT require fabricated metrics to reach 90+ when JD align + skills are strong.
 */
export function estimateAtsContentScore(audit, opts = {}) {
  if (!audit?.totalBullets) return 0;
  const metricPct = Number.isFinite(audit.metricRolePct)
    ? audit.metricRolePct
    : (audit.totalBullets - audit.withoutMetrics) / audit.totalBullets;
  const completePct = Math.max(
    0,
    (audit.totalBullets - (audit.incompleteSentences || 0)) / audit.totalBullets,
  );

  // Only heavy repetition hurts ATS readability: verbs used 3+ times,
  // words used 3+ times that are not unavoidable domain terms.
  const heavyWordPenalty = Math.min(
    12,
    heavyRepeatEntries(audit.repeatedWords, 3, DOMAIN_TERM_ALLOWLIST).length * 4,
  );
  const verbPenalty = Math.min(
    12,
    heavyRepeatEntries(audit.repeatedVerbs, 3).length * 4,
  );
  const intraPenalty = Math.min(12, (audit.intraSentenceRepeats || 0) * 4);

  const jdAlign = Number(opts.jdAlignScore);
  const jdBonus = Number.isFinite(jdAlign)
    ? Math.round(Math.min(100, Math.max(0, jdAlign)) * 0.18)
    : 0;

  const skills = Number(opts.competencyCount) || 0;
  const skillsBonus = skills >= 14 ? 10 : skills >= 12 ? 8 : skills >= 10 ? 6 : skills >= 8 ? 4 : skills >= 5 ? 2 : 0;

  const summaryLines = Number(opts.summaryLines) || 0;
  const summaryBonus = summaryLines >= 4 ? 5 : summaryLines >= 3 ? 4 : summaryLines >= 2 ? 2 : 0;

  // Complete sentences (12) + honest per-role metrics (22) + structure (55) + JD/skills/summary → 90+ without inventing %
  const base = 55
    + Math.round(completePct * 12)
    + Math.round(metricPct * 22)
    + jdBonus
    + skillsBonus
    + summaryBonus;
  return Math.max(0, Math.min(100, base - heavyWordPenalty - verbPenalty - intraPenalty));
}

export { ATS_TARGET_SCORE };
