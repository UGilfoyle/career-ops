/**
 * resume-tailoring-plan.mjs — Deterministic JD tailoring plan + selective employer execution.
 *
 * Policy (user-configurable via profile.tailoring):
 *   full_tailor: Quest, INTVERSE, Glidewell, Srijan
 *   preserve_verbatim: KOCO, Rubico, Artisanssoft
 */

import {
  extractJdKeywords,
  extractJdTechKeywords,
  extractJdDomainPhrases,
  extractMustHavePreferred,
  alignResumeToJd,
  measureJdAlignment,
  ensureAllRolesTailored,
  isWeavableKeyword,
  isJunkKeyword,
} from './jd-keyword-align.mjs';
import {
  analyzeJdProfileFit,
  reframeExperienceFromProfile,
  buildHonestSummary,
  buildJdMatchedCompetencies,
  inferRoleTitleFromJd,
} from './jd-profile-match.mjs';
import {
  polishTailoredResume,
  parseTenureMonths,
  bulletsBudgetForRole,
  elevateBulletForEmployer,
  normalizeBulletText,
  isSeniorToneEmployer,
} from './resume-quality.mjs';

export const DEFAULT_FULL_TAILOR = [
  'Quest Global',
  'Quest',
  'INTVERSE',
  'Glidewell',
  'Srijan',
];

export const DEFAULT_PRESERVE_VERBATIM = [
  'KOCO',
  'KOCO Schools',
  'Rubico',
  'Rubico IT',
  'Rubico Pvt',
  'Artisanssoft',
];

function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function companyMatches(company, patterns) {
  const c = normalizeKey(company);
  if (!c) return false;
  return (patterns || []).some((p) => {
    const needle = normalizeKey(p);
    return needle && (c.includes(needle) || needle.includes(c));
  });
}

/**
 * Read employer policy from profile.tailoring with safe defaults.
 */
export function resolveEmployerPolicy(profile) {
  const t = profile?.tailoring || {};
  const fullTailor = Array.isArray(t.full_tailor) && t.full_tailor.length
    ? t.full_tailor
    : DEFAULT_FULL_TAILOR;
  const preserve = Array.isArray(t.preserve_verbatim) && t.preserve_verbatim.length
    ? t.preserve_verbatim
    : DEFAULT_PRESERVE_VERBATIM;
  const seniorTone = Array.isArray(t.senior_tone) && t.senior_tone.length
    ? t.senior_tone
    : DEFAULT_FULL_TAILOR;
  return { fullTailor, preserve, seniorTone };
}

/**
 * Infer coarse role family from JD text.
 */
export function classifyRoleFamily(jdText) {
  const t = String(jdText || '').toLowerCase();
  if (/\betl\b|\bdata warehouse\b|\bdata reconcil|\bsource-to-target\b|\bscd\b/.test(t)) {
    return 'data_etl';
  }
  if (/\b(web scrap|scraping|puppeteer|playwright|cheerio)\b/.test(t)) return 'scraping_js';
  if (/\b(llm|ai agent|generative ai|langchain|rag)\b/.test(t) && /\bengineer\b/.test(t)) {
    return 'ai_llm';
  }
  if (/\bfull[-\s]?stack\b/.test(t)) return 'fullstack';
  if (/\bfront[-\s]?end\b|\bfrontend\b/.test(t) && !/\bback[-\s]?end\b|\bfull[-\s]?stack\b/.test(t)) {
    return 'frontend';
  }
  if (/\bdevops\b|\bsite reliability\b|\bsre\b/.test(t)) return 'devops_sre';
  if (/\bback[-\s]?end\b|\bplatform engineer\b|\bapi engineer\b/.test(t)) return 'backend_platform';
  return 'unknown';
}

/**
 * Build a serializable tailoring plan from JD + profile.
 */
export function buildTailoringPlan(jdText, profile, opts = {}) {
  const policy = resolveEmployerPolicy(profile);
  const fit = analyzeJdProfileFit(jdText, profile);
  const jdTech = extractJdTechKeywords(jdText, 22);
  const domain = extractJdDomainPhrases(jdText, 16);
  const tiers = extractMustHavePreferred(jdText);
  const family = classifyRoleFamily(jdText);
  const title = inferRoleTitleFromJd(jdText, Number(profile?.candidate?.years_experience) || 0);

  const atsMirror = [...new Set([
    ...jdTech,
    ...domain,
    ...fit.jdKeywords,
    ...tiers.mustHave,
    ...tiers.preferred,
  ])]
    .filter((kw) => kw && !isJunkKeyword(kw))
    .slice(0, 24);

  const honest = [...new Set([...(fit.honest || [])])];
  // Keep domain phrases that overlap proven stack (e.g. SQL, Oracle, Python adjacent)
  for (const d of domain) {
    if (keywordLikelyProven(d, fit) && !honest.some((h) => normalizeKey(h) === normalizeKey(d))) {
      honest.push(d);
    }
  }

  const experience = Array.isArray(profile?.experience) ? profile.experience : [];
  const employers = experience.map((role, index) => {
    const company = String(role?.company || '');
    const isPreserve = companyMatches(company, policy.preserve);
    const isFull = companyMatches(company, policy.fullTailor) || (!isPreserve && index < 4);
    const mode = isPreserve ? 'preserve_verbatim' : (isFull ? 'full_tailor' : 'preserve_verbatim');
    const tone = companyMatches(company, policy.seniorTone) || isSeniorToneEmployer(company)
      ? 'senior'
      : 'mid';
    const tenureMonths = parseTenureMonths(role?.period);
    const bulletBudget = bulletsBudgetForRole(index, {
      tenureMonths,
      maxPages: opts.maxPages ?? 2,
    });
    return {
      index,
      company,
      role: role?.role || role?.title || '',
      mode,
      tone,
      bulletBudget,
      keywordsForRole: mode === 'full_tailor'
        ? (honest.length ? honest : atsMirror).slice(0, 8)
        : [],
    };
  });

  const tailorIndices = employers.filter((e) => e.mode === 'full_tailor').map((e) => e.index);
  const preserveIndices = employers.filter((e) => e.mode === 'preserve_verbatim').map((e) => e.index);

  const draftPlan = {
    version: '1.0',
    family,
    displayTitle: title,
    parsed: {
      mustHave: tiers.mustHave,
      preferred: tiers.preferred,
      domain,
      jdTech,
    },
    keywords: {
      mustHave: tiers.mustHave,
      preferred: tiers.preferred,
      atsMirror,
      honest: fit.honest,
      gaps: fit.gaps,
      domain,
      weave: [],
    },
    employers,
    tailorIndices,
    preserveIndices,
    summary: {
      lines: 4,
      leadKeywords: [...new Set([...jdTech, ...domain, ...(fit.honest || [])])]
        .filter((k) => isWeavableKeyword(k))
        .slice(0, 6),
    },
    competencies: { min: 10, max: 16, includeGaps: true },
    coverLetter: {
      maxWords: 150,
      jdHooks: [...new Set([...domain, ...jdTech, ...(fit.honest || [])])].slice(0, 5),
    },
    validation: {
      atsMin: opts.atsMin ?? 90,
      allowSyntheticMetrics: false,
      mutableCoverageMin: opts.mutableCoverageMin ?? 0.35,
    },
    fit,
  };
  draftPlan.keywords.weave = selectWeaveKeywords(draftPlan, profile);
  // Refresh per-employer weave budget now that weave list exists
  for (const emp of draftPlan.employers) {
    if (emp.mode === 'full_tailor') {
      emp.keywordsForRole = (draftPlan.keywords.weave.length
        ? draftPlan.keywords.weave
        : draftPlan.keywords.honest).slice(0, 8);
    }
  }
  return draftPlan;
}

function keywordLikelyProven(phrase, fit) {
  const p = normalizeKey(phrase);
  const corpusHints = [...(fit.honest || []), ...(fit.profileTech || [])].map(normalizeKey);
  return corpusHints.some((h) => p.includes(h) || h.includes(p.split(/\s+/)[0]));
}

/** Evidence stems that justify weaving a JD domain phrase. Family-agnostic — any future JD. */
const DOMAIN_EVIDENCE_STEMS = [
  { match: /source-to-target|data completeness|etl validat|transformation logic|etl testing/i, stems: ['validat', 'etl', 'migrat', 'schema', 'data integrity', 'compar', 'python'] },
  { match: /data reconcil/i, stems: ['reconcil', 'etl', 'kafka', 'payment', 'data integrity', 'validat'] },
  { match: /data warehouse|staging|slowly changing|\bscd\b|fact.?dimension/i, stems: ['oracle', 'postgresql', 'schema', 'etl', 'warehouse', 'dimension', 'sql'] },
  { match: /window functions|analytical functions/i, stems: ['sql', 'oracle', 'query', 'postgresql', 'aggregat'] },
  { match: /shell scripting|job monitoring|log analysis/i, stems: ['linux', 'unix', 'shell', 'script', 'aws', 'deploy', 'ci/cd'] },
  { match: /web scrap|puppeteer|playwright|cheerio|browser automation|anti-bot|proxy/i, stems: ['scrap', 'puppeteer', 'playwright', 'cheerio', 'javascript', 'node'] },
  { match: /event-?driven|message (queue|broker)|kafka|microservices?/i, stems: ['event-driven', 'microservice', 'kafka', 'queue', 'broker', 'node', 'api'] },
  { match: /observability|incident response|distributed tracing/i, stems: ['grafana', 'prometheus', 'datadog', 'tracing', 'logging', 'elk', 'incident'] },
  { match: /auto-?scaling|container orchestration|infrastructure as code|continuous delivery/i, stems: ['aws', 'docker', 'kubernetes', 'ecs', 'lambda', 'terraform', 'ci/cd', 'deploy'] },
  { match: /restful|api design|high-throughput|low-latency|rate limit/i, stems: ['api', 'rest', 'fastapi', 'express', 'throughput', 'latency', 'node'] },
  { match: /state management|component librar|responsive design|react|typescript/i, stems: ['react', 'typescript', 'redux', 'frontend', 'ui'] },
  { match: /vector|embedding|rag|prompt engineering|agentic|langchain|llm/i, stems: ['llm', 'embedding', 'rag', 'openai', 'langchain', 'vector', 'chromadb'] },
];

function profileCorpusText(profile) {
  const parts = [];
  for (const role of profile?.experience || []) {
    for (const b of role?.bullets || []) parts.push(String(b));
  }
  parts.push(...(profile?.narrative?.superpowers || []).map(String));
  parts.push(...(profile?.skills?.primary || []).map(String));
  parts.push(...(profile?.skills?.secondary || []).map(String));
  return parts.join('\n').toLowerCase();
}

function domainPhraseTransferable(phrase, corpus, honest = []) {
  const p = String(phrase || '');
  for (const rule of DOMAIN_EVIDENCE_STEMS) {
    if (!rule.match.test(p)) continue;
    if (rule.stems.some((stem) => corpus.includes(stem))) return true;
  }
  const pKey = normalizeKey(p);
  if ((honest || []).some((h) => {
    const hk = normalizeKey(h);
    return hk.length >= 3 && (pKey.includes(hk) || hk.includes(pKey.split(/\s+/)[0]));
  })) return true;

  const tokens = normalizeKey(p).split(/[^a-z0-9+#.]+/).filter((t) => t.length >= 4);
  if (!tokens.length) return false;
  return tokens.some((t) => corpus.includes(t));
}

/**
 * Keywords safe to weave into mutable-role bullets for ANY JD family / future posting.
 * Proven stack + transferable domain/must-have phrases. No company-specific hardcoding.
 */
export function selectWeaveKeywords(plan, profile) {
  const honest = [...(plan?.keywords?.honest || [])];
  const domain = [...(plan?.keywords?.domain || [])];
  const mustHave = [...(plan?.keywords?.mustHave || [])];
  const corpus = profileCorpusText(profile);
  const out = [];
  const seen = new Set();
  const push = (kw) => {
    const raw = String(kw || '').trim();
    if (!raw || isJunkKeyword(raw)) return;
    if (!(isWeavableKeyword(raw) || raw.split(/\s+/).length >= 2 || /-/.test(raw))) return;
    if (/\b(mainframe|rally|qtest)\b/i.test(raw) && !corpus.includes(normalizeKey(raw).slice(0, 6))) return;
    const key = normalizeKey(raw);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(raw);
  };

  for (const h of honest) push(h);

  const candidates = [
    ...domain,
    ...mustHave.filter((m) => String(m).split(/\s+/).length >= 2 || /-/.test(m)),
    ...(plan?.keywords?.atsMirror || []).filter((m) => String(m).split(/\s+/).length >= 2),
  ];
  for (const c of candidates) {
    if (domainPhraseTransferable(c, corpus, honest) || keywordLikelyProven(c, plan?.fit || {})) {
      push(c);
    }
  }
  if (out.length <= honest.length) {
    for (const m of mustHave) {
      if (domainPhraseTransferable(m, corpus, honest)) push(m);
    }
  }
  return out.slice(0, 12);
}

/**
 * Force exact JD weave terms into mutable roles (spread across bullets; no stacking spam).
 * Phrase list comes from the plan — works for any future JD vocabulary.
 */
export function injectWeaveIntoMutableRoles(resume, plan, weaveKeywords, maxPerRole = 2) {
  if (!resume?.experience || !plan?.tailorIndices?.length || !weaveKeywords?.length) return resume;
  const copy = JSON.parse(JSON.stringify(resume));
  const kws = weaveKeywords.filter((k) => isWeavableKeyword(k) || String(k).split(/\s+/).length >= 2 || /-/.test(k));
  const kwKeys = new Set(kws.map((k) => normalizeKey(k)));

  const stripInjectNoise = (raw) => {
    let b = String(raw || '').trim();
    b = b
      .replace(/(?:\s+(?:covering|aligned to|supporting|for)\s+[A-Za-z0-9][A-Za-z0-9+./#\s-]{1,60})+\.?$/gi, '.')
      .replace(/\s+\(([^)]{2,60})\)\.?$/gi, (m, inner) => {
        if (/\d/.test(inner)) return m;
        const ik = normalizeKey(inner);
        if (kwKeys.has(ik) || [...kwKeys].some((k) => ik.includes(k) || k.includes(ik))) return '.';
        return m;
      })
      .replace(/\.\s*\./g, '.')
      .trim();
    if (b && !/[.!?]$/.test(b)) b += '.';
    return b;
  };

  let cursor = 0;
  for (const idx of plan.tailorIndices) {
    const key = String(idx);
    let bullets = Array.isArray(copy.experience[key]) ? copy.experience[key].map(stripInjectNoise) : [];
    if (!bullets.length) continue;

    const roleText = () => bullets.join('\n').toLowerCase();
    let added = 0;
    const usedBullet = new Set();

    for (let n = 0; n < kws.length && added < maxPerRole; n++) {
      const kw = kws[(cursor + n) % kws.length];
      if (roleText().includes(String(kw).toLowerCase())) continue;

      let target = -1;
      for (let bi = 0; bi < bullets.length; bi++) {
        if (usedBullet.has(bi)) continue;
        const t = String(bullets[bi]).toLowerCase();
        if (/etl|sql|oracle|validat|reconcil|schema|migrat|data integrity|python|postgresql|pipeline|api|microservice|kafka|aws|linux|node|react|observ|deploy|ci\/cd|scrap|puppeteer/i.test(t)) {
          target = bi;
          break;
        }
      }
      if (target < 0) {
        target = [...bullets.keys()].find((bi) => !usedBullet.has(bi));
      }
      if (target == null || target < 0 || usedBullet.has(target)) continue;

      const base = String(bullets[target] || '').replace(/\.$/, '').trim();
      if (!base || base.toLowerCase().includes(String(kw).toLowerCase())) continue;

      if (/validat|reconcil|etl|sql|schema|data integrity|oracle|postgresql|api|microservice|pipeline/i.test(base)) {
        bullets[target] = `${base} supporting ${kw}.`;
      } else {
        bullets[target] = `${base} (${kw}).`;
      }
      usedBullet.add(target);
      added += 1;
    }
    cursor += Math.max(1, added);
    copy.experience[key] = bullets;
  }
  return copy;
}

/**
 * Normalize source bullets for frozen employers (tone only, no JD weave).
 */
export function preserveEmployerBullets(role, tone = 'mid') {
  const raw = (role?.bullets || []).map((b) => String(b || '').trim()).filter(Boolean);
  const company = role?.company || '';
  return raw.map((b) => {
    const cleaned = normalizeBulletText(b, company);
    if (tone === 'senior' || isSeniorToneEmployer(company)) {
      return elevateBulletForEmployer(cleaned, company);
    }
    return elevateBulletForEmployer(cleaned, company);
  }).filter((b) => b.length >= 20);
}

/**
 * Snapshot frozen employer bullets from profile (source of truth for equality checks).
 */
export function snapshotPreservedBullets(profile, plan) {
  const out = {};
  const exp = profile?.experience || [];
  for (const emp of plan.employers || []) {
    if (emp.mode !== 'preserve_verbatim') continue;
    const role = exp[emp.index];
    out[String(emp.index)] = preserveEmployerBullets(role, emp.tone);
  }
  return out;
}

/**
 * Restore freeze employers after polish / align so they never drift.
 */
export function restorePreservedEmployers(resume, preservedSnapshot) {
  if (!resume || !preservedSnapshot) return resume;
  const copy = JSON.parse(JSON.stringify(resume));
  if (!copy.experience || typeof copy.experience !== 'object' || Array.isArray(copy.experience)) {
    copy.experience = { ...(typeof copy.experience === 'object' && !Array.isArray(copy.experience) ? copy.experience : {}) };
  }
  for (const [key, bullets] of Object.entries(preservedSnapshot)) {
    copy.experience[key] = [...bullets];
  }
  return copy;
}

/**
 * Execute the plan into a tailored resume (deterministic).
 * LLM drafts may supply summary/cover hints; experience follows the plan.
 */
export function executeTailoringPlan(plan, profile, opts = {}) {
  const jdText = opts.jdText || '';
  const years = Number(profile?.candidate?.years_experience)
    || estimateYears(profile?.experience)
    || 0;
  const atsKeywords = plan.keywords.atsMirror;
  const honest = plan.keywords.honest?.length
    ? plan.keywords.honest
    : atsKeywords.slice(0, 8);
  const weave = selectWeaveKeywords(plan, profile);
  const bulletKeywords = weave.length ? weave : honest;

  const preserved = snapshotPreservedBullets(profile, plan);

  // Selective reframe: only full_tailor indices
  let experience = reframeExperienceFromProfile(
    profile?.experience || [],
    jdText,
    bulletKeywords,
    Math.max(...(plan.tailorIndices.length ? plan.tailorIndices : [0])) + 1,
    { tailorIndices: plan.tailorIndices },
  );

  // Fill preserve slots from snapshot
  for (const [key, bullets] of Object.entries(preserved)) {
    experience[key] = [...bullets];
  }

  // Ensure all experience keys exist through last employer
  const total = (profile?.experience || []).length;
  for (let i = 0; i < total; i++) {
    const key = String(i);
    if (!Array.isArray(experience[key]) || experience[key].length === 0) {
      if (preserved[key]) experience[key] = [...preserved[key]];
      else {
        const role = profile.experience[i];
        experience[key] = preserveEmployerBullets(role, plan.employers[i]?.tone || 'mid');
      }
    }
  }

  let resume = {
    summary: buildHonestSummary(
      opts.llmSummary || profile?.narrative?.exit_story || '',
      years,
      [...honest, ...weave],
      jdText,
    ),
    core_competencies: buildJdMatchedCompetencies(
      atsKeywords,
      profile,
      jdText,
      plan.competencies?.max || 16,
    ),
    experience,
  };

  // Align only mutable roles for bullet weave
  const { resume: aligned } = alignResumeToJd(resume, atsKeywords, profile?.experience || [], {
    bulletKeywords,
    summaryKeywords: [...honest, ...weave].filter((k) => !/\b(mainframe|rally|qtest)\b/i.test(k)),
    weaveRoleIndices: plan.tailorIndices,
  });
  resume = aligned;

  ensureAllRolesTailored(
    resume,
    profile?.experience,
    bulletKeywords,
    Math.max(4, ...(plan.tailorIndices.map((i) => i + 1))),
    { tailorIndices: plan.tailorIndices },
  );

  // Freeze restore before polish (inject runs once after polish)
  resume = restorePreservedEmployers(resume, preserved);

  const alignScore = measureJdAlignment(resume, atsKeywords);
  const { resume: polished, stats } = polishTailoredResume(
    resume,
    profile?.experience || [],
    {
      jdAlignScore: alignScore.score,
      allowSyntheticMetrics: false,
      preserveRoleIndices: plan.preserveIndices,
    },
  );

  // Final freeze + single domain weave pass
  let finalResume = restorePreservedEmployers(polished, preserved);
  finalResume = injectWeaveIntoMutableRoles(finalResume, plan, bulletKeywords, 2);
  finalResume = restorePreservedEmployers(finalResume, preserved);

  const coverLetter = opts.llmCoverLetter
    || buildDeterministicCoverLetter(plan, profile, opts.companyName || '');

  return {
    resume: finalResume,
    cover_letter: coverLetter,
    plan: { ...plan, keywords: { ...plan.keywords, weave: bulletKeywords } },
    preservedSnapshot: preserved,
    jd_alignment_score: measureJdAlignment(finalResume, atsKeywords).score,
    ats_content_score: stats?.atsContentScore ?? null,
    polishStats: stats,
  };
}

function estimateYears(experience) {
  if (!Array.isArray(experience) || !experience.length) return 0;
  let months = 0;
  for (const e of experience) months += parseTenureMonths(e?.period) || 0;
  return Math.max(1, Math.round(months / 12));
}

export function buildDeterministicCoverLetter(plan, profile, companyName) {
  const company = companyName || 'your team';
  const hooks = (plan.coverLetter?.jdHooks || plan.keywords.atsMirror || [])
    .slice(0, 3)
    .join(', ') || 'the technical requirements in the posting';
  const years = Number(profile?.candidate?.years_experience) || estimateYears(profile?.experience) || 7;
  return [
    `I am writing to apply for the ${plan.displayTitle || 'open role'} at ${company}. The posting emphasizes ${hooks}, which matches the production work I have owned across recent roles.`,
    `With ${years}+ years building and operating backend systems, I bring hands-on depth in the same problem space: reliable data and API delivery, SQL-backed validation, and CI/CD discipline. Recent work at Quest, INTVERSE, Glidewell, and Srijan maps directly to the requirements above.`,
    `I would welcome the chance to walk through a short technical demo or discuss how I can contribute on day one.`,
  ].join('\n\n');
}

/**
 * Deterministic repair when mutable-role coverage is weak.
 */
export function repairTailoredResume(resume, plan, profile, jdText) {
  const copy = JSON.parse(JSON.stringify(resume));
  const ats = plan.keywords.atsMirror || [];
  const weave = selectWeaveKeywords(plan, profile);
  const honest = plan.keywords.honest?.length ? plan.keywords.honest : ats.slice(0, 8);
  const bulletKeywords = weave.length ? weave : honest;
  const preserved = snapshotPreservedBullets(profile, plan);

  // Patch summary / competencies with missing ATS terms
  const { resume: aligned } = alignResumeToJd(copy, ats, profile?.experience || [], {
    bulletKeywords,
    summaryKeywords: [...honest, ...bulletKeywords].filter((k) => !/\b(mainframe|rally|qtest)\b/i.test(k)),
    weaveRoleIndices: plan.tailorIndices,
    weaveEveryBullet: false,
  });

  // Re-rank mutable roles from source against weave vocabulary
  const reframed = reframeExperienceFromProfile(
    profile?.experience || [],
    jdText,
    bulletKeywords,
    Math.max(...(plan.tailorIndices.length ? plan.tailorIndices : [0])) + 1,
    { tailorIndices: plan.tailorIndices },
  );
  for (const idx of plan.tailorIndices) {
    const key = String(idx);
    if (Array.isArray(reframed[key]) && reframed[key].length) {
      aligned.experience[key] = reframed[key];
    }
  }

  const repaired = injectWeaveIntoMutableRoles(aligned, plan, bulletKeywords, 3);
  // Rebuild summary when top transferable weave phrases are absent (any family / any future JD)
  const topDomain = bulletKeywords
    .filter((k) => String(k).split(/\s+/).length >= 2 || /-/.test(k))
    .slice(0, 3);
  const summaryLower = String(repaired.summary || '').toLowerCase();
  const missingDomain = topDomain.filter((k) => !summaryLower.includes(String(k).toLowerCase()));
  if (missingDomain.length >= 2 || (topDomain.length && missingDomain.length === topDomain.length)) {
    repaired.summary = buildHonestSummary(
      repaired.summary || '',
      estimateYears(profile?.experience),
      [...honest, ...bulletKeywords],
      jdText,
    );
  }

  return restorePreservedEmployers(repaired, preserved);
}

/**
 * Measure JD keyword coverage limited to mutable (full_tailor) experience roles.
 * Also reports per-role hit counts for gate diagnostics.
 */
export function measureMutableRoleCoverage(resume, plan, keywords) {
  const raw = keywords || plan.keywords.weave || plan.keywords.honest || plan.keywords.atsMirror || [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const kws = list.filter((k) => isWeavableKeyword(k) || String(k).split(/\s+/).length >= 2);
  if (!kws.length || !plan.tailorIndices?.length) {
    return { score: 0, matchRatio: 0, matched: [], missing: kws, roleHits: {}, rolesWithHit: 0 };
  }

  const exp = resume?.experience;
  const roleHits = {};
  const corpusParts = [];
  let rolesWithHit = 0;
  for (const idx of plan.tailorIndices) {
    const bullets = Array.isArray(exp?.[String(idx)]) ? exp[String(idx)] : [];
    const text = bullets.join('\n').toLowerCase();
    corpusParts.push(text);
    const hits = kws.filter((kw) => text.includes(String(kw).toLowerCase()));
    roleHits[String(idx)] = hits;
    if (hits.length > 0) rolesWithHit += 1;
  }
  const corpus = corpusParts.join('\n');
  const matched = kws.filter((kw) => corpus.includes(String(kw).toLowerCase()));
  const missing = kws.filter((kw) => !corpus.includes(String(kw).toLowerCase()));
  const matchRatio = matched.length / kws.length;
  return {
    score: Math.round(matchRatio * 100),
    matchRatio,
    matched,
    missing,
    roleHits,
    rolesWithHit,
    roleHitRatio: rolesWithHit / plan.tailorIndices.length,
  };
}

/**
 * Assert preserved employers equal snapshot (token-normalized).
 */
export function assertPreservedEquality(resume, preservedSnapshot) {
  const mismatches = [];
  for (const [key, expected] of Object.entries(preservedSnapshot || {})) {
    const actual = Array.isArray(resume?.experience?.[key]) ? resume.experience[key] : [];
    const a = actual.map((b) => normalizeKey(b));
    const e = expected.map((b) => normalizeKey(b));
    if (a.length !== e.length || a.some((line, i) => line !== e[i])) {
      mismatches.push({ roleIndex: key, expectedCount: e.length, actualCount: a.length });
    }
  }
  return { pass: mismatches.length === 0, mismatches };
}
