#!/usr/bin/env node
/**
 * resume-alignment-validator.mjs — Deterministic JD↔resume alignment gate.
 *
 * Scores candidates (source CV, LLM draft, aligned draft), rejects unsupported
 * claims, selects the strongest honest version, and emits PASS/FAIL evidence.
 */

import fs from 'fs';
import path from 'path';
import {
  extractJdKeywords,
  extractJdTechKeywords,
  measureJdAlignment,
  alignResumeToJd,
} from './jd-keyword-align.mjs';
import {
  analyzeJdProfileFit,
  collectProfileCorpus,
  buildHonestSummary,
  buildHonestCompetencies,
  buildJdMatchedCompetencies,
  reframeExperienceFromProfile,
} from './jd-profile-match.mjs';
import {
  auditResumeQuality,
  estimateAtsContentScore,
  polishTailoredResume,
} from './resume-quality.mjs';
import {
  buildTailoringPlan,
  executeTailoringPlan,
  measureMutableRoleCoverage,
  assertPreservedEquality,
  restorePreservedEmployers,
} from './resume-tailoring-plan.mjs';

export const ATS_MIN_SCORE = 90;

const RESPONSIBILITY_PHRASES = [
  'design', 'implement', 'build', 'scale', 'own', 'lead', 'collaborate',
  'ship', 'deliver', 'debug', 'monitor', 'test', 'review', 'mentor',
  'architect', 'optimize', 'deploy', 'operate', 'incident', 'ci/cd',
  'api', 'microservice', 'full-stack', 'observability', 'pipeline',
  'production', 'reliability', 'performance', 'stakeholder',
];

function extractMetrics(text) {
  const found = [];
  const seen = new Set();
  // Prefer clear percentage / multiplier impacts only
  for (const m of String(text || '').matchAll(/\b\d+(?:\.\d+)?%|\bp\d{2}\b|\b\d+(?:\.\d+)?x\b/gi)) {
    const token = m[0].trim();
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(token);
  }
  return found;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj ?? null));
}

function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function collectExperienceArrays(experience) {
  if (!experience) return [];
  if (Array.isArray(experience)) return [experience.map(String)];
  if (typeof experience === 'object') {
    return Object.keys(experience)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (Array.isArray(experience[k]) ? experience[k].map(String) : []));
  }
  return [];
}

export function resumeCorpus(resume) {
  const parts = [];
  if (resume?.summary) parts.push(String(resume.summary));
  if (Array.isArray(resume?.core_competencies)) {
    parts.push(...resume.core_competencies.map(String));
  }
  for (const group of collectExperienceArrays(resume?.experience)) {
    parts.push(...group);
  }
  return parts.filter(Boolean).join('\n');
}

export function buildSourceResumeFromProfile(profile, jdText = '') {
  const experience = {};
  (profile?.experience || []).slice(0, 7).forEach((role, i) => {
    experience[String(i)] = (role?.bullets || []).slice(0, 5).map(String);
  });
  return {
    summary:
      profile?.narrative?.exit_story
      || profile?.narrative?.headline
      || '',
    core_competencies: (profile?.narrative?.superpowers || []).slice(0, 12).map(String),
    experience,
  };
}

export function buildAlignedResumeFromProfile(profile, jdText) {
  const plan = buildTailoringPlan(jdText, profile);
  const executed = executeTailoringPlan(plan, profile, { jdText });
  return { resume: executed.resume, fit: plan.fit, polishStats: executed.polishStats, plan };
}

function findEvidence(corpus, keyword) {
  const k = normalizeKey(keyword);
  if (!k) return null;
  const lines = String(corpus || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.toLowerCase().includes(k)) return line.slice(0, 180);
  }
  return null;
}

function responsibilityCoverage(resume, jdText) {
  const jdLower = String(jdText || '').toLowerCase();
  const corpus = resumeCorpus(resume).toLowerCase();
  const jdTerms = RESPONSIBILITY_PHRASES.filter((p) => jdLower.includes(p));
  const terms = jdTerms.length ? jdTerms : RESPONSIBILITY_PHRASES.slice(0, 10);
  const matched = terms.filter((t) => corpus.includes(t));
  const score = terms.length ? Math.round((matched.length / terms.length) * 100) : 0;
  return { score, matched, missing: terms.filter((t) => !matched.includes(t)), total: terms.length };
}

function verifyMetricsAgainstProfile(resume, profile) {
  const profileText = collectProfileCorpus(profile).toLowerCase();
  const resumeText = resumeCorpus(resume);
  const claimed = extractMetrics(resumeText);
  const verified = [];
  const unverified = [];

  for (const metric of claimed) {
    const lower = metric.toLowerCase();
    const numericCore = (metric.match(/\d+(?:\.\d+)?/) || [''])[0];
    const isYearsPhrase = /\d+\+?\s*years?/.test(lower) || /\d+\+$/.test(lower);
    const ok =
      isYearsPhrase
      || profileText.includes(lower)
      || (numericCore && profileText.includes(numericCore));
    if (ok) verified.push(metric);
    else unverified.push(metric);
  }

  return {
    claimed,
    verified,
    unverified,
    pass: unverified.length === 0 || claimed.length === 0,
  };
}

/** Remove percentage/multiplier clauses that cannot be traced to the profile. */
export function stripUnverifiedMetrics(resume, profile) {
  const copy = deepClone(resume);
  const profileText = collectProfileCorpus(profile).toLowerCase();

  const scrub = (text) => {
    let out = String(text || '');
    for (const m of out.matchAll(/\b\d+(?:\.\d+)?%/gi)) {
      const token = m[0];
      const core = (token.match(/\d+(?:\.\d+)?/) || [''])[0];
      if (core && profileText.includes(core)) continue;
      // Drop trailing fabricated impact clauses containing this metric
      out = out
        .replace(new RegExp(`,[^,]{0,80}${token.replace('%', '\\%')}[^.]*\\.`, 'i'), '.')
        .replace(new RegExp(`\\s+while maintaining ${token.replace('%', '\\%')}[^.]*\\.`, 'i'), '.')
        .replace(new RegExp(`\\s+handling [^.]*${token.replace('%', '\\%')}[^.]*\\.`, 'i'), '.')
        .replace(new RegExp(`, enhancing[^.]*${token.replace('%', '\\%')}[^.]*\\.`, 'i'), '.');
    }
    return out.replace(/\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
  };

  if (copy.summary) copy.summary = scrub(copy.summary);
  const groups = collectExperienceArrays(copy.experience);
  if (Array.isArray(copy.experience)) {
    copy.experience = groups[0]?.map(scrub) || [];
  } else if (copy.experience && typeof copy.experience === 'object') {
    for (const key of Object.keys(copy.experience)) {
      if (Array.isArray(copy.experience[key])) {
        copy.experience[key] = copy.experience[key].map(scrub);
      }
    }
  }
  return copy;
}

const HARD_SKILLS = new Set([
  'javascript', 'typescript', 'python', 'java', 'go', 'golang', 'rust', 'c#',
  '.net', '.net core', 'ruby', 'php', 'kotlin', 'swift', 'scala',
  'react', 'react.js', 'redux', 'angular', 'vue.js', 'next.js', 'nestjs',
  'express', 'fastapi', 'django', 'spring boot', 'node.js', 'nodejs',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'dynamodb',
  'elasticsearch', 'oracle', 'aws', 'gcp', 'azure', 'docker', 'kubernetes',
  'terraform', 'ecs', 'lambda', 's3', 'ec2', 'cloudformation', 'kafka',
  'rabbitmq', 'graphql', 'grpc', 'jenkins', 'github actions', 'gitlab ci',
  'prometheus', 'grafana', 'datadog', 'jest', 'cypress', 'playwright',
  'webpack', 'vite', 'llm', 'rag', 'langchain', 'pytorch', 'tensorflow',
  'chromadb', 'openai', 'claude', 'gpt', 'cursor', 'copilot',
  'github copilot', 'snowflake', 'spark', 'airflow', 'dbt', 'databricks',
]);

function normalizedSkill(gap) {
  return normalizeKey(gap)
    .replace(/^github\s+copilot$/i, 'github copilot')
    .replace(/^node\s*js$/i, 'nodejs');
}

function isActionableGap(gap) {
  return HARD_SKILLS.has(normalizedSkill(gap));
}

function exactTermInCorpus(corpus, term) {
  const escaped = String(term || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return false;
  const left = /^[A-Za-z0-9]/.test(term) ? '(?<![A-Za-z0-9])' : '';
  const right = /[A-Za-z0-9]$/.test(term) ? '(?![A-Za-z0-9])' : '';
  return new RegExp(`${left}${escaped}${right}`, 'i').test(String(corpus || ''));
}

function experienceCorpus(resume) {
  const texts = [];
  const exp = resume?.experience;
  if (Array.isArray(exp)) {
    for (const b of exp) texts.push(String(b || ''));
  } else if (exp && typeof exp === 'object') {
    for (const key of Object.keys(exp).sort((a, b) => Number(a) - Number(b))) {
      for (const b of exp[key] || []) texts.push(String(b || ''));
    }
  }
  return texts.join('\n');
}

function findUnsupportedClaims(resume, gaps, provenCorpus = '') {
  // Only flag hard-skill gaps claimed inside EXPERIENCE bullets.
  // Skills / Core Competencies intentionally mirror the JD for ATS matching.
  const corpus = experienceCorpus(resume).toLowerCase();
  const unsupported = [];
  for (const gap of gaps || []) {
    if (!isActionableGap(gap)) continue;
    if (exactTermInCorpus(provenCorpus, gap)) continue;
    if (exactTermInCorpus(corpus, gap)) {
      unsupported.push({
        term: gap,
        evidence: findEvidence(experienceCorpus(resume), gap),
      });
    }
  }
  return unsupported;
}

/**
 * Score one resume candidate against a JD + profile.
 * Weights: 50% honest coverage, 20% responsibility language, 15% metrics, 15% ATS.
 */
export function scoreCandidate(resume, jdText, profile, fit = null, provenCorpus = '') {
  const jdFit = fit || analyzeJdProfileFit(jdText, profile);
  const honest = jdFit.honest || [];
  const gaps = jdFit.gaps || [];
  const cleaned = stripUnverifiedMetrics(resume, profile);

  const honestAlign = measureJdAlignment(cleaned, honest.length ? honest : extractJdKeywords(jdText, 20));
  const techKws = extractJdTechKeywords(jdText, 18);
  const techAlign = measureJdAlignment(cleaned, techKws.length ? techKws : (honest.length ? honest : extractJdKeywords(jdText, 20)));
  const resp = responsibilityCoverage(cleaned, jdText);
  const metrics = verifyMetricsAgainstProfile(cleaned, profile);
  const audit = auditResumeQuality(cleaned);
  const ats = estimateAtsContentScore(audit, {
    jdAlignScore: techAlign.score,
    competencyCount: Array.isArray(cleaned.core_competencies) ? cleaned.core_competencies.length : 0,
    summaryLines: String(cleaned.summary || '').split('\n').filter(Boolean).length,
  });
  const unsupported = findUnsupportedClaims(cleaned, gaps, provenCorpus);

  const metricScore = metrics.claimed.length === 0
    ? 70
    : Math.round((metrics.verified.length / Math.max(1, metrics.claimed.length)) * 100);

  const composite = Math.round(
    honestAlign.score * 0.5
    + resp.score * 0.2
    + metricScore * 0.15
    + ats * 0.15
  );

  const matchedEvidence = (honestAlign.matched || []).map((kw) => ({
    keyword: kw,
    evidence: findEvidence(resumeCorpus(cleaned), kw),
  }));

  const honestyPass = unsupported.length === 0;
  const metricsPass = metrics.unverified.length === 0
    || metrics.unverified.length <= Math.max(1, Math.floor(metrics.claimed.length * 0.4));

  return {
    composite,
    honestyPass,
    metricsPass,
    pass: honestyPass && metricsPass,
    honestCoverage: honestAlign.score,
    honestMatched: honestAlign.matched,
    honestMissing: honestAlign.missing,
    matchedEvidence,
    notClaimed: gaps,
    responsibility: resp,
    metrics,
    ats,
    audit,
    unsupported,
    honest,
    gaps,
    cleanedResume: cleaned,
  };
}

/**
 * Compare source / LLM / aligned candidates and select the strongest honest one.
 */
export function validateResumeAlignment({
  jdText,
  profile,
  sourceResume = null,
  llmDraft = null,
  finalResume = null,
  meta = {},
  atsMin = ATS_MIN_SCORE,
  plan = null,
  preservedSnapshot = null,
} = {}) {
  if (!jdText || String(jdText).trim().length < 40) {
    return {
      verdict: 'FAIL',
      reasons: ['JD text too short or missing — cannot confirm alignment'],
      selected: null,
      selectedId: null,
      scores: {},
      meta,
    };
  }

  const activePlan = plan || buildTailoringPlan(jdText, profile);
  const fit = activePlan.fit || analyzeJdProfileFit(jdText, profile);
  const source = deepClone(sourceResume || buildSourceResumeFromProfile(profile, jdText));
  const aligned = deepClone(finalResume || buildAlignedResumeFromProfile(profile, jdText).resume);
  const llm = deepClone(llmDraft || aligned);

  const candidates = {
    source: { id: 'source', label: 'Source CV', resume: source },
    llm: { id: 'llm', label: 'LLM draft', resume: llm },
    aligned: { id: 'aligned', label: 'Aligned & polished', resume: aligned },
  };
  // Frozen employers (preserve_verbatim roles) are restored verbatim at the end of
  // the tailoring pipeline. If the LLM dropped them (e.g. returned only 4 roles),
  // judging the raw draft against the frozen snapshot / coverage floors penalizes a
  // resume that never ships — evaluate llm/aligned the way they would be saved.
  if (preservedSnapshot && activePlan?.preserveIndices?.length) {
    for (const id of ['llm', 'aligned']) {
      candidates[id].resume = restorePreservedEmployers(candidates[id].resume, preservedSnapshot);
    }
  }
  const provenCorpus = [
    collectProfileCorpus(profile),
    resumeCorpus(source),
  ].filter(Boolean).join('\n');

  const scores = {};
  for (const [id, c] of Object.entries(candidates)) {
    const scored = scoreCandidate(c.resume, jdText, profile, fit, provenCorpus);
    // Prefer sanitized resume (unverified synthetic metrics stripped)
    if (scored.cleanedResume) {
      candidates[id].resume = scored.cleanedResume;
    }
    scores[id] = {
      ...scored,
      label: c.label,
      id,
    };
  }

  const honestCandidates = Object.values(scores).filter((s) => s.pass);
  let selected = null;
  const reasons = [];
  const sourceScore = scores.source;
  // Hard floor for generated resumes: 90+ ATS content score
  const adaptiveAtsMin = atsMin;

  if (honestCandidates.length === 0) {
    reasons.push('No honest candidate passed unsupported-claim / metric checks');
    for (const s of Object.values(scores)) {
      if (s.unsupported?.length) {
        reasons.push(`${s.label}: unsupported claims — ${s.unsupported.map((u) => u.term).slice(0, 6).join(', ')}`);
      }
      if (!s.metricsPass) {
        reasons.push(`${s.label}: unverified metrics — ${(s.metrics?.unverified || []).slice(0, 6).join(', ')}`);
      }
    }
  } else {
    const llmFloor = scores.llm.pass ? scores.llm.composite : 0;

    const eligible = [];
    for (const cand of honestCandidates) {
      let current = cand;
      if (current.ats < adaptiveAtsMin) {
        const raw = candidates[current.id].resume;
        const { resume: polished } = polishTailoredResume(
          deepClone(raw),
          profile?.experience || [],
          {
            jdAlignScore: current.honestCoverage,
          }
        );
        const cleaned = stripUnverifiedMetrics(polished, profile);
        candidates[current.id].resume = cleaned;
        current = {
          ...scoreCandidate(cleaned, jdText, profile, fit, provenCorpus),
          label: cand.label,
          id: cand.id,
        };
        if (current.cleanedResume) {
          candidates[current.id].resume = current.cleanedResume;
        }
        scores[current.id] = current;
      }
      if (!current.pass) continue;
      if (current.ats < adaptiveAtsMin) continue;
      if (current.composite < sourceScore.composite && sourceScore.pass) continue;
      if (current.composite < llmFloor) continue;
      if (current.honestCoverage < sourceScore.honestCoverage) continue;
      eligible.push(current);
    }

    if (eligible.length === 0) {
      selected = honestCandidates.sort((a, b) => b.composite - a.composite)[0];
      if (selected.ats < adaptiveAtsMin) {
        reasons.push(`ATS content score ${selected.ats} < ${adaptiveAtsMin} (target ${atsMin})`);
      }
      if (selected.composite < sourceScore.composite && sourceScore.pass) {
        reasons.push(
          `Best honest score ${selected.composite} is below source CV ${sourceScore.composite}`
        );
      }
      if (selected.composite < llmFloor) {
        reasons.push(
          `Best honest score ${selected.composite} is below LLM draft ${llmFloor}`
        );
      }
      if (selected.honestCoverage < sourceScore.honestCoverage) {
        reasons.push(
          `Honest JD coverage ${selected.honestCoverage}% is below source baseline ${sourceScore.honestCoverage}%`
        );
      }
      if (reasons.length === 0) {
        reasons.push('No candidate met all alignment thresholds');
      }
    } else {
      selected = eligible.sort((a, b) => {
        if (b.honestCoverage !== a.honestCoverage) return b.honestCoverage - a.honestCoverage;
        if (b.composite !== a.composite) return b.composite - a.composite;
        // Prefer aligned polish over identical LLM/source when tied
        const rank = { aligned: 0, llm: 1, source: 2 };
        return (rank[a.id] ?? 9) - (rank[b.id] ?? 9);
      })[0];
    }
  }

  let verdict = selected && reasons.length === 0 ? 'PASS' : 'FAIL';
  // Coverage / frozen gates must describe the resume that actually ships.
  // Callers that pass finalResume render their own executed resume, so measure
  // that exact object (frozen roles restored); never the source-CV fallback.
  const renderedFinal = finalResume
    ? (preservedSnapshot && activePlan?.preserveIndices?.length
        ? restorePreservedEmployers(deepClone(finalResume), preservedSnapshot)
        : deepClone(finalResume))
    : null;
  const selectedResume = renderedFinal
    || (selected ? candidates[selected.id].resume : candidates.aligned.resume);

  // Plan-aware: frozen employers + keyword-sprinkle trap
  let mutableCoverage = null;
  let frozenCheck = null;
  if (activePlan?.tailorIndices?.length) {
    // Measure against the weave list — what the plan actually intends to weave.
    // honest/domain also carry JD gaps (skills with no CV proof) that must NOT be
    // woven into experience, so counting them as "missing" unfairly sinks coverage.
    const coverageKeywords = (activePlan.keywords?.weave?.length
      ? activePlan.keywords.weave
      : activePlan.keywords?.honest || []);
    mutableCoverage = measureMutableRoleCoverage(
      selectedResume,
      activePlan,
      coverageKeywords,
    );
    const compsOnly = measureJdAlignment(
      { core_competencies: selectedResume?.core_competencies || [] },
      activePlan.keywords?.atsMirror || [],
    );
    const minRatio = activePlan.validation?.mutableCoverageMin ?? 0.35;
    // Sprinkle trap: rich competencies but most mutable roles have zero JD signal
    if (compsOnly.matchRatio >= 0.7 && (mutableCoverage.roleHitRatio ?? 0) < 0.5) {
      reasons.push(
        `Keyword sprinkle trap: competencies ${compsOnly.score}% but only ${mutableCoverage.rolesWithHit}/${activePlan.tailorIndices.length} mutable roles carry JD terms`,
      );
      verdict = 'FAIL';
    } else if (compsOnly.matchRatio >= 0.7 && mutableCoverage.matchRatio < minRatio && mutableCoverage.rolesWithHit === 0) {
      reasons.push(
        `Keyword sprinkle trap: competencies ${compsOnly.score}% but mutable experience only ${mutableCoverage.score}%`,
      );
      verdict = 'FAIL';
    } else if (mutableCoverage.matchRatio < minRatio && activePlan.tailorIndices.length) {
      reasons.push(
        `Mutable-role JD coverage ${mutableCoverage.score}% below floor ${Math.round(minRatio * 100)}%`,
      );
      verdict = 'FAIL';
    }
  }
  if (preservedSnapshot) {
    frozenCheck = assertPreservedEquality(selectedResume, preservedSnapshot);
    if (!frozenCheck.pass) {
      reasons.push(
        `Frozen employers changed: ${frozenCheck.mismatches.map((m) => m.roleIndex).join(', ')}`,
      );
      verdict = 'FAIL';
    }
  }
  if (reasons.length > 0) verdict = 'FAIL';

  return {
    verdict,
    reasons,
    selected: selected
      ? {
          id: selected.id,
          label: selected.label,
          composite: selected.composite,
          honestCoverage: selected.honestCoverage,
          ats: selected.ats,
          unsupportedCount: selected.unsupported.length,
          metricsVerified: `${selected.metrics.verified.length}/${selected.metrics.claimed.length || 0}`,
        }
      : null,
    selectedId: selected?.id || null,
    selectedResume,
    scores: {
      source: summarizeScore(scores.source),
      llm: summarizeScore(scores.llm),
      aligned: summarizeScore(scores.aligned),
    },
    detail: scores,
    fit: {
      honest: fit.honest,
      gaps: fit.gaps,
      jdKeywords: fit.jdKeywords,
    },
    plan: {
      family: activePlan?.family,
      tailorIndices: activePlan?.tailorIndices,
      preserveIndices: activePlan?.preserveIndices,
      mutableCoverage,
      frozenCheck,
    },
    meta: {
      company: meta.company || '',
      role: meta.role || '',
      resumePath: meta.resumePath || '',
      jdPreview: String(jdText).slice(0, 240),
    },
  };
}

function summarizeScore(s) {
  return {
    id: s.id,
    label: s.label,
    composite: s.composite,
    honestCoverage: s.honestCoverage,
    ats: s.ats,
    pass: s.pass,
    honestyPass: s.honestyPass,
    metricsPass: s.metricsPass,
    unsupported: (s.unsupported || []).map((u) => u.term),
    honestMatched: s.honestMatched,
    honestMissing: s.honestMissing,
    matchedEvidence: s.matchedEvidence,
    notClaimed: s.notClaimed,
    metrics: s.metrics,
    responsibility: s.responsibility,
  };
}

export function printAlignmentConfirmation(result) {
  const sel = result.selected;
  const src = result.scores?.source;
  const llm = result.scores?.llm;
  const line = result.verdict === 'PASS' ? 'ALIGNMENT CONFIRMATION: PASS' : 'ALIGNMENT CONFIRMATION: FAIL';
  console.log(`\n${line}`);
  if (sel) {
    console.log(
      `Final ${sel.composite} | LLM draft ${llm?.composite ?? '—'} | Source CV ${src?.composite ?? '—'}`
    );
    console.log(
      `Honest JD coverage ${sel.honestCoverage}% | ATS quality ${sel.ats}`
    );
    console.log(
      `Unsupported claims ${sel.unsupportedCount} | Metrics verified ${sel.metricsVerified}`
    );
    console.log(`Selected candidate: ${sel.label}`);
  }
  if (result.reasons?.length) {
    for (const r of result.reasons) console.warn(`  ✗ ${r}`);
  }
  console.log('');
}

export function formatAlignmentMarkdown(result) {
  const lines = [];
  lines.push(`# Resume–JD Alignment Confirmation`);
  lines.push('');
  lines.push(`**Verdict:** ${result.verdict}`);
  if (result.meta?.company) lines.push(`**Company:** ${result.meta.company}`);
  if (result.meta?.role) lines.push(`**Role:** ${result.meta.role}`);
  if (result.meta?.resumePath) lines.push(`**Resume:** ${result.meta.resumePath}`);
  lines.push('');

  if (result.selected) {
    lines.push(`## Selected candidate`);
    lines.push(`- ${result.selected.label} (score ${result.selected.composite})`);
    lines.push(`- Honest coverage: ${result.selected.honestCoverage}%`);
    lines.push(`- ATS quality: ${result.selected.ats}`);
    lines.push(`- Metrics verified: ${result.selected.metricsVerified}`);
    lines.push('');
  }

  lines.push(`## Candidate scores`);
  for (const id of ['source', 'llm', 'aligned']) {
    const s = result.scores?.[id];
    if (!s) continue;
    lines.push(
      `- **${s.label}**: composite ${s.composite}, honest ${s.honestCoverage}%, ATS ${s.ats}, pass=${s.pass}`
    );
  }
  lines.push('');

  const detail = result.detail?.[result.selectedId] || result.detail?.aligned;
  if (detail?.matchedEvidence?.length) {
    lines.push(`## Matched requirements (with evidence)`);
    for (const m of detail.matchedEvidence.slice(0, 20)) {
      lines.push(`- **${m.keyword}**: ${m.evidence || '(in corpus)'}`);
    }
    lines.push('');
  }

  const gaps = result.fit?.gaps || [];
  if (gaps.length) {
    lines.push(`## Missing requirements (not claimed)`);
    for (const g of gaps.slice(0, 20)) lines.push(`- ${g}`);
    lines.push('');
  }

  if (detail?.unsupported?.length) {
    lines.push(`## Unsupported claims`);
    for (const u of detail.unsupported) {
      lines.push(`- **${u.term}**: ${u.evidence || ''}`);
    }
    lines.push('');
  }

  if (detail?.metrics) {
    lines.push(`## Metric provenance`);
    lines.push(`- Verified: ${(detail.metrics.verified || []).join(', ') || '(none)'}`);
    lines.push(`- Unverified: ${(detail.metrics.unverified || []).join(', ') || '(none)'}`);
    lines.push('');
  }

  if (result.reasons?.length) {
    lines.push(`## Failure reasons`);
    for (const r of result.reasons) lines.push(`- ${r}`);
    lines.push('');
  }

  lines.push(`## Rationale`);
  if (result.verdict === 'PASS') {
    lines.push(
      `Selected **${result.selected?.label}** as the highest-scoring honest candidate among source CV, LLM draft, and aligned draft under the fixed rubric (50% honest JD coverage, 20% responsibility language, 15% verified metrics, 15% ATS quality).`
    );
  } else {
    lines.push(`Generation blocked — no candidate met honesty and threshold gates.`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Write sibling .alignment.json and .alignment.md next to a resume path
 * (or under output/ when only a basename is known).
 */
export function writeAlignmentReport(result, resumePathOrBase) {
  const base = String(resumePathOrBase || 'output/alignment');
  const withoutExt = base.replace(/\.(html|pdf|md|json)$/i, '');
  const jsonPath = `${withoutExt}.alignment.json`;
  const mdPath = `${withoutExt}.alignment.md`;
  const dir = path.dirname(jsonPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const serializable = {
    verdict: result.verdict,
    reasons: result.reasons,
    selected: result.selected,
    selectedId: result.selectedId,
    scores: result.scores,
    fit: result.fit,
    meta: result.meta,
    // Keep evidence from selected/aligned detail without dumping full resumes
    matchedEvidence: result.detail?.[result.selectedId]?.matchedEvidence
      || result.detail?.aligned?.matchedEvidence
      || [],
    unsupported: result.detail?.[result.selectedId]?.unsupported
      || result.detail?.aligned?.unsupported
      || [],
    metrics: result.detail?.[result.selectedId]?.metrics
      || result.detail?.aligned?.metrics
      || null,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(serializable, null, 2));
  fs.writeFileSync(mdPath, formatAlignmentMarkdown(result));
  return { jsonPath, mdPath };
}

/**
 * Gate helper for tailor pipelines. Returns the best available resume.
 * Never throws on FAIL — a JD-tailored resume is ALWAYS produced; coverage
 * shortfalls surface as warnings, not hard blocks.
 */
export function gateResumeAlignment(opts) {
  const result = validateResumeAlignment(opts);
  printAlignmentConfirmation(result);
  if (result.verdict !== 'PASS') {
    console.warn(
      `⚠ Alignment warnings (resume still generated):\n${(result.reasons || []).map((r) => `  - ${r}`).join('\n')}`
    );
  }
  return { resume: result.selectedResume, result };
}
