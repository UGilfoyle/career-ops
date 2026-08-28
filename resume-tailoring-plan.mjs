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
  keywordAppearsInJd,
  appendToolToTrailingParen,
  mergeStackedToolParens,
  DOMAIN_EVIDENCE_STEMS,
  isMethodologySkillPhrase,
  listKnownTechInText,
} from './jd-keyword-align.mjs';
import {
  analyzeJdProfileFit,
  reframeExperienceFromProfile,
  buildHonestSummary,
  buildJdMatchedCompetencies,
  inferRoleTitleFromJd,
  isEmbeddedSystemsJd,
  isDotnetAzureJd,
  extractJdPostedTitle,
} from './jd-profile-match.mjs';
import {
  polishTailoredResume,
  parseTenureMonths,
  bulletsBudgetForRole,
  elevateBulletForEmployer,
  normalizeBulletText,
  isSeniorToneEmployer,
  scrubSummaryKeywordParenSpam,
  scrubResumeArtifacts,
} from './resume-quality.mjs';

/** LLM summary seed only — never exit_story; strip paren-keyword spam. */
function scrubSummaryFromOpts(llmSummary) {
  const raw = String(llmSummary || '').trim();
  if (!raw) return '';
  // Reject exit_story-shaped dumps that are mostly parenthetical keyword stacks
  if (/^(\s*\([^)]{2,90}\)\s*){2,}/.test(raw)) return '';
  if (/\(DynamoDB|WebSockets|\.NET|REST API,\s*Azure\)/i.test(raw) && raw.split('(').length >= 3) {
    return '';
  }
  return scrubSummaryKeywordParenSpam(scrubResumeArtifacts(raw));
}

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
  // C++ / Linux / satellite / real-time must beat incidental CI/CD or "software engineer"
  if (isEmbeddedSystemsJd(jdText)) return 'embedded_systems';
  if (isDotnetAzureJd(jdText)) return 'azure_dotnet';
  if (/\bfull[-\s]?stack\b/.test(t)) return 'fullstack';
  if (/\bfront[-\s]?end\b|\bfrontend\b/.test(t) && !/\bback[-\s]?end\b|\bfull[-\s]?stack\b/.test(t)) {
    return 'frontend';
  }
  if (/\bdevops\b|\bsite reliability\b|\bsre\b|\baws platform engineer\b/.test(t)) return 'devops_sre';
  if (/\bplatform engineer\b/.test(t) && /\b(aws|terraform|cloudformation|iam|vpc)\b/.test(t)) {
    return 'devops_sre';
  }
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
  const yearsForTitle = Number(profile?.candidate?.years_experience) || estimateYears(profile?.experience) || 0;
  const family = classifyRoleFamily(jdText);
  const title = inferRoleTitleFromJd(jdText, yearsForTitle);

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
    postedTitle: extractJdPostedTitle(jdText),
    jdText: String(jdText || ''),
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
        .filter((k) => isWeavableKeyword(k) && !isMethodologySkillPhrase(k))
        .slice(0, 6),
    },
    // Gaps allowed only when they are real tech tools (NestJS/Azure) — prose never lands in skills
    competencies: { min: 10, max: 20, includeGaps: true },
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
 * Keywords to weave into mutable-role bullets.
 * THIS posting's stack (including gap languages like C# / Angular) goes into bullets.
 * Profile-only stack that is not in the JD (TypeScript on a .NET role) does not.
 */
export function selectWeaveKeywords(plan, profile) {
  const out = [];
  const seen = new Set();
  const corpus = profileCorpusText(profile);
  const honest = plan?.keywords?.honest || [];
  const jdBlob = String(plan?.jdText || '');
  const push = (kw) => {
    const raw = String(kw || '').trim();
    if (!raw || isJunkKeyword(raw)) return;
    if (!isWeaveableNounPhrase(raw) && !isApprovedSkillPhrase(raw)) return;
    if (isMethodologySkillPhrase(raw)) return;
    if (!isApprovedSkillPhrase(raw) && !isWeavableKeyword(raw)) return;
    const key = normalizeKey(raw);
    if (!key || seen.has(key)) return;
    if (jdBlob.length >= 40 && !keywordAppearsInJd(raw, jdBlob)) return;
    seen.add(key);
    out.push(raw);
  };

  for (const kw of [
    ...(plan?.parsed?.jdTech || []),
    ...(plan?.keywords?.mustHave || []),
    ...(plan?.keywords?.atsMirror || []),
  ]) {
    push(kw);
  }
  for (const kw of honest) push(kw);
  for (const kw of plan?.keywords?.domain || []) {
    if (domainPhraseTransferable(kw, corpus, honest)) push(kw);
  }
  return out.slice(0, 20);
}

/**
 * Weave JD terms into mutable roles only where they integrate grammatically:
 * in-place mention upgrades, tool parentheticals, or "in a/an X" clauses.
 * Keywords without a natural home in a role are skipped for that role.
 */
export function injectWeaveIntoMutableRoles(resume, plan, weaveKeywords, maxPerRole = 2, profile = null) {
  if (!resume?.experience || !plan?.tailorIndices?.length || !weaveKeywords?.length) return resume;
  const copy = JSON.parse(JSON.stringify(resume));
  const kws = weaveKeywords.filter((k) => isWeaveableNounPhrase(k));

  const stripInjectNoise = (raw) => {
    let b = String(raw || '').trim();
    b = b
      .replace(/(?:\s+(?:covering|aligned to|supporting|for)\s+[A-Za-z0-9][A-Za-z0-9+./#\s-]{1,60})+\.?$/gi, '.')
      .replace(/\.\s*\./g, '.')
      .trim();
    b = mergeStackedToolParens(b);
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
      const sourceDigest = (profile?.experience?.[idx]?.bullets || []).join('\n');
      const jdBlob = String(plan?.jdText || '');
      const jdOwnsKw = jdBlob.length >= 40 && keywordAppearsInJd(kw, jdBlob);
      if (sourceDigest && !keywordCoveredInText(sourceDigest, kw) && !jdOwnsKw) continue;

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
          bullets[target] = `${appendToolToTrailingParen(base, kw)}.`;
        } else {
          if (/\b(with|in|across|via|on)\s+[^,.]{2,40}$/i.test(base) || base.length > 190) continue;
          bullets[target] = `${base}, ${form}.`;
        }
      }
      usedBullet.add(target);
      added += 1;
    }
    cursor += Math.max(1, added);
    copy.experience[key] = bullets.map((b) => {
      const merged = mergeStackedToolParens(String(b || ''));
      if (merged && !/[.!?]$/.test(merged)) return `${merged}.`;
      return merged;
    });
  }
  return copy;
}

function escapeGapRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripGapMention(bullet, gap) {
  const raw = String(gap || '').trim();
  if (!raw || raw.length < 2) return bullet;
  let t = String(bullet || '');
  const compact = raw.toLowerCase().replace(/\s+/g, '');
  if (
    compact === 'c#'
    || compact === '.net'
    || compact === 'asp.net'
    || compact === 'aspnet'
    || /asp\.net/i.test(raw)
  ) {
    t = t.replace(/\bASP\.?\s*NET(?:\s+Core)?\b/gi, '');
    t = t.replace(/\bASP\s+APIs?\b/gi, 'APIs');
    if (compact !== 'c#') t = t.replace(/\b\.NET(?:\s+Core)?\b/gi, '');
    if (compact === 'c#' || /asp\.net/i.test(raw)) t = t.replace(/\bC#\b/g, '');
    return t.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/\s+\./g, '.').trim();
  }
  const escaped = escapeGapRegex(raw).replace(/\\\./g, '\\.?');
  t = t.replace(new RegExp(`\\s*\\(${escaped}\\)`, 'gi'), '');
  t = t.replace(new RegExp(`(?:\\s*(?:,|/|and|&))?\\s*\\b${escaped}\\b`, 'gi'), '');
  return t.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/\s+\./g, '.').trim();
}

/**
 * Drop JD-gap tools (Angular, NestJS, Azure) from experience unless that role's
 * source digest already names them. Skills/summary may still list gaps for ATS.
 */
export function scrubGapToolsFromMutableRoles(resume, plan, profile) {
  const gaps = (plan?.keywords?.gaps || []).filter(
    (g) => g && (isApprovedSkillPhrase(g) || isWeavableKeyword(g)),
  ).sort((a, b) => String(b).length - String(a).length);
  if (!gaps.length || !resume?.experience || !plan?.tailorIndices?.length) return resume;
  const copy = JSON.parse(JSON.stringify(resume));
  for (const idx of plan.tailorIndices) {
    const source = (profile?.experience?.[idx]?.bullets || []).join('\n');
    const key = String(idx);
    const bullets = Array.isArray(copy.experience[key]) ? copy.experience[key] : [];
    copy.experience[key] = bullets
      .map((b) => {
        let t = String(b || '');
        for (const gap of gaps) {
          if (plan?.jdText && keywordAppearsInJd(gap, plan.jdText)) continue;
          if (keywordCoveredInText(source, gap)) continue;
          if (!keywordCoveredInText(t, gap)) continue;
          t = stripGapMention(t, gap);
        }
        return t;
      })
      .filter((b) => String(b).replace(/[.\s]/g, '').length > 24);
  }
  return copy;
}

const OFF_JD_COMPETE = [
  'FastAPI', 'TypeScript', 'React', 'React.js', 'Next.js', 'NestJS',
  'Angular', 'Bun', 'Node.js', 'JavaScript', 'C#', '.NET', 'ASP.NET', '.NET Core',
  'C++', 'GDB', 'Valgrind', 'Java', 'Python', 'Spring Boot', 'GraphQL',
];

/**
 * Drop competing languages/frameworks that THIS posting did not ask for.
 * JD-required stack (C# on a .NET role, Angular on an Angular role) stays.
 */
export function scrubInventedStackFromMutableRoles(resume, plan, profile) {
  if (!resume?.experience || !plan?.tailorIndices?.length) return resume;
  const jd = String(plan?.jdText || '');
  const copy = JSON.parse(JSON.stringify(resume));
  for (const idx of plan.tailorIndices) {
    const key = String(idx);
    const bullets = Array.isArray(copy.experience[key]) ? copy.experience[key] : [];
    copy.experience[key] = bullets
      .map((b) => {
        let t = String(b || '');
        const extra = listKnownTechInText(t).filter((tech) => (
          OFF_JD_COMPETE.some((s) => normalizeKey(s) === normalizeKey(tech))
        ));
        const toStrip = [...OFF_JD_COMPETE, ...extra]
          .sort((a, c) => String(c).length - String(a).length);
        for (const tech of toStrip) {
          if (jd && keywordAppearsInJd(tech, jd)) continue;
          if (!keywordCoveredInText(t, tech) && !new RegExp(tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(t)) {
            continue;
          }
          t = stripGapMention(t, tech);
        }
        t = mergeStackedToolParens(t);
        return t;
      })
      .filter((b) => String(b).replace(/[.\s]/g, '').length > 24);
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
  // Summary/competencies may list the full JD stack. Experience weave is proven tools only.
  const jdLead = [...new Set([
    ...(plan.keywords.atsMirror || []),
    ...(plan.keywords.gaps || []),
    ...(plan.keywords.mustHave || []),
    ...(plan.keywords.honest || []),
  ])].filter((k) => isApprovedSkillPhrase(k) || isWeavableKeyword(k));
  const weave = selectWeaveKeywords(plan, profile);
  const bulletKeywords = weave.length ? weave : (plan.keywords.honest || []);

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

  // Summary is JD + proven stack only. Never seed from exit_story (paren-spam pollution).
  // Optional LLM draft is honesty-scrubbed; empty base → full deterministic rebuild.
  const llmSummaryClean = scrubSummaryFromOpts(opts.llmSummary);
  let resume = {
    summary: buildHonestSummary(
      llmSummaryClean,
      years,
      bulletKeywords,
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
    summaryKeywords: bulletKeywords,
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

  // Final freeze + honest weave only (gaps stay in competencies)
  let finalResume = restorePreservedEmployers(polished, preserved);
  finalResume = injectWeaveIntoMutableRoles(finalResume, plan, bulletKeywords, 3, profile);
  finalResume = scrubGapToolsFromMutableRoles(finalResume, plan, profile);
  finalResume = scrubInventedStackFromMutableRoles(finalResume, plan, profile);
  finalResume = restorePreservedEmployers(finalResume, preserved);
  if (typeof finalResume.summary === 'string') {
    finalResume.summary = scrubSummaryKeywordParenSpam(scrubResumeArtifacts(finalResume.summary));
  }

  const coverLetter = finalizeCoverLetter({
    llmText: opts.llmCoverLetter,
    plan,
    profile,
    companyName: opts.companyName || '',
    jdText,
    resume: finalResume,
  });

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

export function buildDeterministicCoverLetter(plan, profile, companyName, jdText = '', resume = null) {
  return buildJdAlignedCoverLetter(plan, profile, companyName, jdText, resume);
}

/**
 * JD-specific cover letter — 3 tight paragraphs, no date, no em-dash, mirrors the posting.
 */
export function stripCoverLetterDates(text) {
  let s = String(text || '');
  if (!s) return '';
  s = s.replace(
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi,
    '',
  );
  s = s.replace(
    /\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december),?\s+\d{4}\b/gi,
    '',
  );
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '');
  s = s.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '');
  s = s.replace(/^\s*date\s*:\s*.+$/gim, '');
  s = s.replace(/\s*—\s*/g, ', ');
  s = s.replace(/[^\S\n]{2,}/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

export function buildJdAlignedCoverLetter(plan, profile, companyName, jdText = '', resume = null) {
  const company = String(companyName || '').trim() || 'your organization';
  const family = plan?.family || classifyRoleFamily(jdText);
  const role = plan?.displayTitle || inferRoleTitleFromJd(jdText) || 'the open role';
  const jdBlob = String(jdText || plan?.jdText || '');
  const honest = [
    ...(plan?.parsed?.jdTech || []),
    ...(plan?.keywords?.honest || []),
  ]
    .filter((k) => isWeavableKeyword(k) && !isMethodologySkillPhrase(k) && (!jdBlob || keywordAppearsInJd(k, jdBlob)))
    .slice(0, 6);
  const hooks = honest.length
    ? honest.join(', ')
    : (plan?.keywords?.atsMirror || []).slice(0, 4).join(', ') || 'the technical requirements in your posting';
  const years = Number(profile?.candidate?.years_experience) || estimateYears(profile?.experience) || 7;
  const recent = (profile?.experience || [])[0] || {};
  const recentCo = String(recent.company || 'my current employer').trim();
  const recentRole = String(recent.role || recent.title || 'Software Engineer').trim();

  const digest = [
    ...(profile?.experience || []).flatMap((e) => e?.bullets || []),
    resume?.summary || '',
  ].join(' ');
  const metric = (digest.match(/\b\d+(?:\.\d+)?%|\bp99\b|\bp95\b|\b99\.\d+%\b/i) || [])[0];
  const metricBit = metric
    ? ` Recent work includes measurable outcomes such as ${metric} in production.`
    : '';

  let para1 = `I am applying for the ${role} position at ${company}. Your posting emphasizes ${hooks}, which matches the production systems I have designed, tested, and operated.`;
  let para2 = `I bring ${years}+ years owning backend platforms, APIs, and cloud delivery.${metricBit} In my recent role as ${recentRole} at ${recentCo}, I owned architecture, reliability, CI/CD, and mentoring mapped to the stack in your posting.`;

  if (family === 'embedded_systems') {
    para1 = `I am applying for the ${role} position at ${company}. The posting emphasizes ${hooks}.`;
    para2 = `I bring ${years}+ years shipping production software on Linux, with Python, Jenkins CI/CD, AWS/Azure, automated tests, and structured design reviews.${metricBit} As ${recentRole} at ${recentCo}, I own troubleshooting, release quality, and mentoring. That is the overlap I bring: Linux services, SDLC discipline, and collaborative delivery.`;
  } else if (family === 'azure_dotnet') {
    para1 = `I am applying for the ${role} position at ${company}. The posting emphasizes ${hooks} on a .NET and Azure integration stack.`;
    para2 = `I bring ${years}+ years shipping event-driven services, third-party API integrations, Kafka, PostgreSQL, and containerized cloud workloads.${metricBit} As ${recentRole} at ${recentCo}, I own API reliability, messaging, and production operations. That is the overlap I bring.`;
  } else if (family === 'data_etl') {
    para1 = `I am applying for the ${role} position at ${company}. Your posting emphasizes ${hooks} across warehouse, validation, and pipeline reliability.`;
    para2 = `I bring ${years}+ years owning Python/SQL data platforms, CI/CD for data jobs, and production troubleshooting.${metricBit} As ${recentRole} at ${recentCo}, I owned delivery from design through test and release.`;
  } else if (family === 'devops_sre') {
    para1 = `I am applying for the ${role} position at ${company}. Your posting emphasizes ${hooks} for platform reliability and cloud operations.`;
    para2 = `I bring ${years}+ years owning AWS platform work, CI/CD, infrastructure as code, and production reliability.${metricBit} As ${recentRole} at ${recentCo}, I owned architecture, incident response, and mentoring.`;
  } else if (family === 'scraping_js') {
    para1 = `I am applying for the ${role} position at ${company}. Your posting emphasizes ${hooks} for JavaScript services and data extraction.`;
    para2 = `I bring ${years}+ years shipping JavaScript services, production APIs, and cloud delivery.${metricBit} As ${recentRole} at ${recentCo}, I owned design, tests, and release quality.`;
  }

  const para3 = 'I would welcome the opportunity to discuss how I can contribute from day one. Thank you for your consideration.';
  return stripCoverLetterDates([para1, para2, para3].join('\n\n'));
}

/** Prefer deterministic JD letter when LLM output is generic, polluted, dated, or off-JD. */
export function finalizeCoverLetter(opts = {}) {
  const {
    llmText = '',
    plan,
    profile,
    companyName = '',
    jdText = '',
    resume = null,
  } = opts;
  const built = buildJdAlignedCoverLetter(plan, profile, companyName, jdText, resume);
  let raw = stripCoverLetterDates(String(llmText || '').trim());
  if (!raw || raw.length < 80) return built;

  raw = raw
    .replace(/^dear\s+hiring manager[,:\s]*/i, '')
    .replace(/\bsincerely[,:\s]*[\s\S]*$/i, '')
    .trim();
  raw = stripCoverLetterDates(raw);

  if (isWeakCoverLetter(raw)) return built;

  const paras = raw.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paras.length < 2 || paras.length > 4) return built;

  const hooks = (plan?.keywords?.honest || plan?.keywords?.atsMirror || []).slice(0, 6);
  const body = paras.join(' ').toLowerCase();
  const mentionsJd = !hooks.length || hooks.some((h) => {
    const k = String(h).toLowerCase().slice(0, Math.min(8, String(h).length));
    return k.length >= 3 && body.includes(k);
  });
  if (!mentionsJd) return built;

  const family = plan?.family || classifyRoleFamily(jdText);
  if (family === 'embedded_systems' && /\btypescript\b|\breact\.?js\b|\bfull[-\s]?stack\b/i.test(body) && !/\blinux\b|\bc\+\+\b|\bjenkins\b/i.test(body)) {
    return built;
  }
  if (family === 'azure_dotnet' && /\btypescript\b|\breact\.?js\b|\bfastapi\b/i.test(body) && !/\bazure\b|\bkafka\b|\btelemetry\b|\.net\b|\bintegrat/i.test(body)) {
    return built;
  }

  return stripCoverLetterDates(paras.slice(0, 3).join('\n\n'));
}

function isWeakCoverLetter(text) {
  const t = String(text || '');
  if (/\(\s*[^)]{2,},\s*[^)]+\)/.test(t)) return true;
  if (/production-grade distributed systems for consumer and enterprise/i.test(t)) return true;
  if (/quest, intverse, glidewell, and srijan maps directly/i.test(t)) return true;
  if (/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/i.test(t)) {
    return true;
  }
  if (/exit_story|superpowers/i.test(t)) return true;
  return false;
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
  const bulletKeywords = weave.length ? weave : (plan.keywords.honest || []);
  const preserved = snapshotPreservedBullets(profile, plan);

  // Patch summary / competencies with full JD stack
  const { resume: aligned } = alignResumeToJd(copy, ats, profile?.experience || [], {
    bulletKeywords,
    summaryKeywords: bulletKeywords,
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

  const repaired = injectWeaveIntoMutableRoles(aligned, plan, bulletKeywords, 3, profile);
  const scrubbed = scrubInventedStackFromMutableRoles(
    scrubGapToolsFromMutableRoles(repaired, plan, profile),
    plan,
    profile,
  );
  // Rebuild summary when top JD weave phrases are absent
  const topDomain = bulletKeywords
    .filter((k) => String(k).split(/\s+/).length >= 2 || /-/.test(k))
    .slice(0, 3);
  const summaryLower = String(scrubbed.summary || '').toLowerCase();
  const missingDomain = topDomain.filter((k) => !summaryLower.includes(String(k).toLowerCase()));
  if (missingDomain.length >= 2 || (topDomain.length && missingDomain.length === topDomain.length)) {
    scrubbed.summary = buildHonestSummary(
      scrubbed.summary || '',
      estimateYears(profile?.experience),
      [...jdLead, ...bulletKeywords],
      jdText,
    );
  }

  return restorePreservedEmployers(scrubbed, preserved);
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
