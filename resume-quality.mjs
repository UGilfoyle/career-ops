/**
 * resume-quality.mjs — Post-process tailored resume text for ATS checker quality:
 * quantified impact and action-verb variety (no repeated "implemented"/"developed").
 */

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
  engineered: ['built', 'developed', 'delivered', 'constructed', 'assembled'],
  delivered: ['shipped', 'released', 'launched', 'rolled out', 'deployed'],
};

const GENERIC_VERB_POOL = [
  'delivered', 'drove', 'owned', 'ran', 'streamlined', 'accelerated',
  'reduced', 'expanded', 'enforced', 'authored', 'launched', 'tuned',
];

const METRIC_PATTERNS = [
  /\d+%/,
  /\$[\d,]+(?:\.\d+)?[kKmMbB]?/,
  /\b\d[\d,]*\+?\b/,
  /\b(?:p\d{2}|latency|throughput|uptime|cpu|cost|revenue|users|requests|transactions|deployments)\b/i,
  /\b(?:reduced|cut|decreased|lowered|increased|improved|optimized|saved|accelerated|boosted|raised)\b[^.]{0,50}\d/i,
  /\bfrom\s+[^,]{2,40}\s+to\s+[^,]{2,40}/i,
];

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

/** Pull a short metric clause from a source bullet (never invent). */
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

/** Pick an unused verb alternative for a repeated leading verb. */
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

/**
 * Rotate leading verbs so no verb appears more than once across all bullets.
 * @param {string[]} bullets
 * @param {Set<string>} usedVerbs global tracker (mutated)
 */
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

/**
 * If a tailored bullet lacks metrics, graft a metric clause from a matching source bullet.
 * @param {string} bullet
 * @param {string[]} sourceBullets
 */
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
  if (!best || bestOverlap < 2) return { bullet, enriched: false };
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

/**
 * Polish AI-tailored resume JSON: verb variety + metric carry-over from source CV.
 * @param {{ summary?: string, core_competencies?: string[], experience?: unknown }} resume
 * @param {Array<{ bullets?: string[] }>} sourceExperience
 */
export function polishTailoredResume(resume, sourceExperience = []) {
  if (!resume || typeof resume !== 'object') {
    return { resume, stats: { verbsRotated: 0, metricsEnriched: 0 } };
  }

  const usedVerbs = new Set();
  let verbsRotated = 0;
  let metricsEnriched = 0;

  const roleBulletGroups = collectExperienceArrays(resume.experience);
  const polishedGroups = roleBulletGroups.map((bullets, roleIdx) => {
    const sourceBullets = sourceExperience[roleIdx]?.bullets || [];
    const metricEnriched = bullets.map((b) => {
      const { bullet, enriched } = enrichBulletWithSourceMetric(b, sourceBullets);
      if (enriched) metricsEnriched += 1;
      return bullet;
    });
    const { bullets: verbPolished, rotated } = dedupeVerbStarts(metricEnriched, usedVerbs);
    verbsRotated += rotated;
    return verbPolished;
  });

  if (Array.isArray(resume.experience)) {
    resume.experience = polishedGroups[0] || [];
  } else if (resume.experience && typeof resume.experience === 'object') {
    const keys = Object.keys(resume.experience).sort((a, b) => Number(a) - Number(b));
    keys.forEach((key, i) => {
      resume.experience[key] = polishedGroups[i] || resume.experience[key];
    });
  }

  return { resume, stats: { verbsRotated, metricsEnriched } };
}

/** Lightweight quality report for logging. */
export function auditResumeQuality(resume) {
  const groups = collectExperienceArrays(resume?.experience);
  const allBullets = groups.flat();
  const verbCounts = {};
  let withoutMetrics = 0;

  for (const bullet of allBullets) {
    const verb = extractLeadingVerb(bullet);
    if (verb) verbCounts[verb] = (verbCounts[verb] || 0) + 1;
    if (!hasQuantifiedImpact(bullet)) withoutMetrics += 1;
  }

  const repeatedVerbs = Object.entries(verbCounts)
    .filter(([, n]) => n > 1)
    .map(([v, n]) => `${v}×${n}`);

  return {
    totalBullets: allBullets.length,
    withoutMetrics,
    repeatedVerbs,
  };
}
