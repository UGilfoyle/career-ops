/**
 * resume-quality.mjs — Post-process tailored resume text for 88+ ATS content scores:
 * quantified impact, global verb variety, and no repeated words within sentences.
 */

const ATS_TARGET_SCORE = 88;

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
    if (m) return m[0].trim().replace(/[,.]$/, '');
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
  const pool = VERB_ALTERNATIVES[verb] || GENERIC_VERB_POOL;
  for (const alt of pool) {
    if (!usedVerbs.has(alt)) return alt;
  }
  for (const alt of GENERIC_VERB_POOL) {
    if (!usedVerbs.has(alt) && alt !== verb) return alt;
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
 * Globally cap action-verb frequency across all resume text (max 1 each).
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

  const out = texts.map((text) => {
    let current = text;
    const verb = extractLeadingVerb(text);
    if (verb && counts.get(verb) > MAX_GLOBAL_USES) {
      const replacement = pickVerbReplacement(verb, new Set([...usedGlobally.keys(), verb]));
      if (replacement) {
        fixes += 1;
        usedGlobally.set(replacement.toLowerCase(), (usedGlobally.get(replacement.toLowerCase()) || 0) + 1);
        current = replaceLeadingVerb(current, replacement);
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
  if (!best || bestOverlap < 1) return { bullet, enriched: false };
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

function enrichBulletsWithMetrics(bullets, roleSourceBullets, allSourceBullets) {
  const metricSources = roleSourceBullets.filter((s) => hasQuantifiedImpact(s));

  return bullets.map((b) => {
    if (hasQuantifiedImpact(b)) return { bullet: b, enriched: false };
    
    // Attempt to enrich with overlap-based match from the same role
    if (metricSources.length > 0) {
      let best = null;
      let bestOverlap = 0;
      for (const src of metricSources) {
        const overlap = tokenOverlap(b, src);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          best = src;
        }
      }
      if (best && bestOverlap >= 2) {
        const metric = extractMetricClause(best);
        if (metric) {
          const trimmed = String(b).trim().replace(/\.$/, '');
          if (!trimmed.toLowerCase().includes(metric.toLowerCase())) {
            return { bullet: `${trimmed}, ${metric}.`, enriched: true };
          }
        }
      }
    }
    
    return { bullet: b, enriched: false };
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

function applyExperiencePolish(resume, sourceExperience, usedVerbs) {
  let verbsRotated = 0;
  let metricsEnriched = 0;
  let wordRepetitionsFixed = 0;

  const allSourceBullets = collectAllSourceBullets(sourceExperience);
  const roleBulletGroups = collectExperienceArrays(resume.experience);
  const polishedGroups = roleBulletGroups.map((bullets, roleIdx) => {
    const roleSourceBullets = sourceExperience[roleIdx]?.bullets || [];
    const enriched = enrichBulletsWithMetrics(bullets, roleSourceBullets, allSourceBullets);
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

export function polishTailoredResume(resume, sourceExperience = []) {
  if (!resume || typeof resume !== 'object') {
    return {
      resume,
      stats: { verbsRotated: 0, metricsEnriched: 0, wordRepetitionsFixed: 0, atsContentScore: 0, polishIterations: 0 },
    };
  }

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

  let audit = auditResumeQuality(resume);
  let atsContentScore = estimateAtsContentScore(audit);

  const MAX_ITER = 5;
  while (polishIterations < MAX_ITER && atsContentScore < ATS_TARGET_SCORE) {
    polishIterations += 1;
    const pass = applyExperiencePolish(resume, sourceExperience, usedVerbs);
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
    atsContentScore = estimateAtsContentScore(audit);

    if (
      atsContentScore >= ATS_TARGET_SCORE
      && audit.repeatedVerbs.length === 0
      && audit.repeatedWords.length === 0
      && audit.intraSentenceRepeats === 0
    ) {
      break;
    }
  }

  return {
    resume,
    stats: { verbsRotated, metricsEnriched, wordRepetitionsFixed, atsContentScore, polishIterations },
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

export function auditResumeQuality(resume) {
  const groups = collectExperienceArrays(resume?.experience);
  const allBullets = groups.flat();
  const summaryLines = String(resume?.summary || '').split('\n').filter(Boolean);
  const allText = [...summaryLines, ...allBullets];

  const verbCounts = {};
  let withoutMetrics = 0;
  let intraSentenceRepeats = 0;

  for (const bullet of allBullets) {
    const verb = extractLeadingVerb(bullet);
    if (verb) verbCounts[verb] = (verbCounts[verb] || 0) + 1;
    if (!hasQuantifiedImpact(bullet)) withoutMetrics += 1;

    const seen = new Set();
    for (const m of String(bullet).matchAll(/\b([A-Za-z]{4,})\b/g)) {
      const lower = m[1].toLowerCase();
      if (!isReplaceableWord(lower)) continue;
      if (seen.has(lower)) intraSentenceRepeats += 1;
      seen.add(lower);
    }
  }

  const wordFreq = countWordFrequency(allText);
  const repeatedWords = Object.entries(wordFreq)
    .filter(([, n]) => n > 1)
    .map(([w, n]) => `${w}×${n}`);

  const repeatedVerbs = Object.entries(verbCounts)
    .filter(([, n]) => n > 1)
    .map(([v, n]) => `${v}×${n}`);

  return {
    totalBullets: allBullets.length,
    withoutMetrics,
    repeatedVerbs,
    repeatedWords,
    intraSentenceRepeats,
  };
}

/** Heuristic 0–100 content score aligned with common ATS checkers. */
export function estimateAtsContentScore(audit) {
  if (!audit?.totalBullets) return 0;
  const metricPct = (audit.totalBullets - audit.withoutMetrics) / audit.totalBullets;
  const repetitionPenalty = (audit.repeatedWords?.length || 0) * 8
    + (audit.repeatedVerbs?.length || 0) * 10
    + (audit.intraSentenceRepeats || 0) * 5;
  const base = 55 + Math.round(metricPct * 35);
  return Math.max(0, Math.min(100, base - repetitionPenalty));
}
