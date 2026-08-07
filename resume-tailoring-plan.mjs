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
  isWeaveableNounPhrase,
  isApprovedSkillPhrase,
  keywordTokens,
  keywordCoveredInText,
  endsWithMetricTail,
  upgradePartialMention,
  weaveSuffixForm,
  bulletHasTechContext,
  weaveAdjacencyScore,
  DOMAIN_EVIDENCE_STEMS,
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
  if (
    /\betl\b|\belt\b|\bdata warehouse\b|\bdata reconcil|\bsource-to-target\b|\bscd\b|\bdatabricks\b|\bpyspark\b|\bdata factory\b|\badf\b|\bsnowflake\b|\bdata engineer\b|\bdata modeling\b/
      .test(t)
  ) {
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
  const jdTech = extractJdTechKeywords(jdText, 28);
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
    // Gaps allowed only when they are real tech tools (NestJS/Azure) — prose never lands in skills
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
  // Multi-word phrases need their leading token proven in the profile; otherwise
  // any single shared word (e.g. "tracking") would admit prose fragments.
  if (tokens.length > 1 && !corpus.includes(tokens[0])) return false;
  return tokens.some((t) => corpus.includes(t));
}

/**
 * Keywords to weave into mutable-role bullets — FULL JD stack (ATS-first).
 * No honesty / proven-only filter: if the JD names it, it is eligible to weave.
 */
export function selectWeaveKeywords(plan, profile) {
  void profile;
  const out = [];
  const seen = new Set();
  const push = (kw) => {
    const raw = String(kw || '').trim();
    if (!raw || isJunkKeyword(raw)) return;
    if (!isWeaveableNounPhrase(raw) && !isApprovedSkillPhrase(raw)) return;
    if (!isApprovedSkillPhrase(raw) && !isWeavableKeyword(raw)) return;
    const key = normalizeKey(raw);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(raw);
  };

  // JD-first: atsMirror + gaps + mustHave + domain + honest (order = priority)
  for (const kw of [
    ...(plan?.keywords?.atsMirror || []),
    ...(plan?.keywords?.gaps || []),
    ...(plan?.keywords?.mustHave || []),
    ...(plan?.keywords?.domain || []),
    ...(plan?.keywords?.honest || []),
  ]) {
    push(kw);
  }
  return out.slice(0, 20);
}

/**
 * Weave JD terms into mutable roles only where they integrate grammatically:
 * in-place mention upgrades, tool parentheticals, or "in a/an X" clauses.
 * Keywords without a natural home in a role are skipped for that role.
 */
export function injectWeaveIntoMutableRoles(resume, plan, weaveKeywords, maxPerRole = 2) {
  if (!resume?.experience || !plan?.tailorIndices?.length || !weaveKeywords?.length) return resume;
  const copy = JSON.parse(JSON.stringify(resume));
  const kws = weaveKeywords.filter((k) => isWeaveableNounPhrase(k));
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
    const bullets = Array.isArray(copy.experience[key]) ? copy.experience[key].map(stripInjectNoise) : [];
    if (!bullets.length) continue;

    const roleText = () => bullets.join('\n');
    let added = 0;
    const usedBullet = new Set();

    for (let n = 0; n < kws.length && added < maxPerRole; n++) {
      const kw = kws[(cursor + n) % kws.length];
      if (keywordCoveredInText(roleText(), kw)) continue;

      // Rank candidate bullets: skip metric tails and saturated bullets, prefer
      // upgradeable partial mentions, then bullets adjacent to the keyword.
      let target = -1;
      let best = -1;
      for (let bi = 0; bi < bullets.length; bi++) {
        if (usedBullet.has(bi)) continue;
        const base = String(bullets[bi] || '').replace(/\.$/, '').trim();
        if (!base || keywordCoveredInText(base, kw) || endsWithMetricTail(base)) continue;
        let score = 0;
        if (upgradePartialMention(base, kw)) score = 3;
        else if (weaveAdjacencyScore(base, kw) === 2) score = 2;
        else if (weaveAdjacencyScore(base, kw) === 1 && bulletHasTechContext(base)) score = 1;
        else continue;
        if (score > best) {
          best = score;
          target = bi;
        }
      }
      if (target < 0) continue;

      const base = String(bullets[target] || '').replace(/\.$/, '').trim();
      const upgraded = upgradePartialMention(base, kw);
      if (upgraded) {
        bullets[target] = `${upgraded.replace(/\.$/, '')}.`;
      } else {
        const form = weaveSuffixForm(kw);
        if (!form) continue;
        if (form.startsWith('(')) {
          if (!bulletHasTechContext(base)) continue;
          bullets[target] = `${base} ${form}.`;
        } else {
          if (/\b(with|in|across|via|on)\s+[^,.]{2,40}$/i.test(base) || base.length > 190) continue;
          bullets[target] = `${base}, ${form}.`;
        }
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
  // JD-first: weave + summarize against the full JD stack (gaps included)
  const jdLead = [...new Set([
    ...(plan.keywords.atsMirror || []),
    ...(plan.keywords.gaps || []),
    ...(plan.keywords.mustHave || []),
    ...(plan.keywords.honest || []),
  ])].filter((k) => isApprovedSkillPhrase(k) || isWeavableKeyword(k));
  const weave = selectWeaveKeywords(plan, profile);
  const bulletKeywords = weave.length ? weave : jdLead;

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
      jdLead,
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

  // Align mutable roles + summary with FULL JD keyword set
  const { resume: aligned } = alignResumeToJd(resume, atsKeywords, profile?.experience || [], {
    bulletKeywords,
    summaryKeywords: jdLead,
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

  // Final freeze + aggressive JD weave (gaps allowed)
  let finalResume = restorePreservedEmployers(polished, preserved);
  finalResume = injectWeaveIntoMutableRoles(finalResume, plan, bulletKeywords, 4);
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
  const jdLead = [...new Set([
    ...(plan.keywords.atsMirror || []),
    ...(plan.keywords.gaps || []),
    ...(plan.keywords.mustHave || []),
    ...(plan.keywords.honest || []),
  ])];
  const bulletKeywords = weave.length ? weave : jdLead;
  const preserved = snapshotPreservedBullets(profile, plan);

  // Patch summary / competencies with full JD stack
  const { resume: aligned } = alignResumeToJd(copy, ats, profile?.experience || [], {
    bulletKeywords,
    summaryKeywords: jdLead,
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

  const repaired = injectWeaveIntoMutableRoles(aligned, plan, bulletKeywords, 4);
  // Rebuild summary when top JD weave phrases are absent
  const topDomain = bulletKeywords
    .filter((k) => String(k).split(/\s+/).length >= 2 || /-/.test(k))
    .slice(0, 3);
  const summaryLower = String(repaired.summary || '').toLowerCase();
  const missingDomain = topDomain.filter((k) => !summaryLower.includes(String(k).toLowerCase()));
  if (missingDomain.length >= 2 || (topDomain.length && missingDomain.length === topDomain.length)) {
    repaired.summary = buildHonestSummary(
      repaired.summary || '',
      estimateYears(profile?.experience),
      [...jdLead, ...bulletKeywords],
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
  // Dedupe (case-insensitive) and drop junk/fragments so coverage reflects real skills
  const seen = new Set();
  const kws = [];
  for (const item of list) {
    if (!item || isJunkKeyword(item)) continue;
    if (!isWeaveableNounPhrase(item)) continue;
    const key = normalizeKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kws.push(item);
  }
  if (!kws.length || !plan.tailorIndices?.length) {
    return { score: 0, matchRatio: 0, matched: [], missing: kws, roleHits: {}, rolesWithHit: 0 };
  }

  const exp = resume?.experience;
  const roleHits = {};
  const corpusParts = [];
  let rolesWithHit = 0;
  for (const idx of plan.tailorIndices) {
    const bullets = Array.isArray(exp?.[String(idx)]) ? exp[String(idx)] : [];
    const text = bullets.join('\n');
    corpusParts.push(text);
    const hits = kws.filter((kw) => keywordCoveredInText(text, kw));
    roleHits[String(idx)] = hits;
    if (hits.length > 0) rolesWithHit += 1;
  }
  const corpus = corpusParts.join('\n');
  const matched = kws.filter((kw) => keywordCoveredInText(corpus, kw));
  const missing = kws.filter((kw) => !keywordCoveredInText(corpus, kw));
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
