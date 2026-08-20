import type { ResumeContext } from './types';
import { masterSummaryText } from './fill-template';
import { getCompetencies } from './types';
import { runJdMatch, type JdMatchResult } from './jd-match';

export type AtsScoreResult = {
  score: number;
  matched: string[];
  missing: string[];
  total: number;
  source: 'jd' | 'structure';
  jdMatch?: JdMatchResult;
};

/** Structure completeness (no JD) — kept for empty-job state. */
export function structureAtsScore(profile: ResumeContext): AtsScoreResult {
  let score = 20;
  const c = profile.candidate || {};
  if (c.full_name?.trim()) score += 10;
  if (c.email?.trim()) score += 10;
  if (c.phone?.trim()) score += 5;
  if (c.linkedin?.trim()) score += 5;
  if (masterSummaryText(profile).trim().length > 40) score += 15;
  if ((profile.narrative?.superpowers || []).length >= 3) score += 10;
  if ((profile.experience || []).length >= 1) score += 15;
  if ((profile.experience || []).some((e) => (e.bullets || []).length >= 2)) score += 10;
  if ((profile.education || []).length >= 1) score += 10;
  return {
    score: Math.min(100, score),
    matched: [],
    missing: [],
    total: 0,
    source: 'structure',
  };
}

function profileToResumeShape(profile: ResumeContext) {
  const experience: Record<string, string[]> = {};
  (profile.experience || []).forEach((role, i) => {
    experience[String(i)] = Array.isArray(role.bullets) ? role.bullets.map(String) : [];
  });
  return {
    summary: masterSummaryText(profile),
    core_competencies: getCompetencies(profile),
    experience,
  };
}

async function importJdKeywordAlign() {
  const { pathToFileURL } = await import('url');
  const { join } = await import('path');
  const candidates = [
    join(/* turbopackIgnore: true */ process.cwd(), '..', 'jd-keyword-align.mjs'),
    join(/* turbopackIgnore: true */ process.cwd(), 'runtime-assets', '..', '..', 'jd-keyword-align.mjs'),
  ];
  let lastErr: unknown;
  for (const file of candidates) {
    try {
      return await import(/* webpackIgnore: true */ pathToFileURL(file).href);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('jd-keyword-align.mjs not found');
}

/**
 * JD ATS score = % of JD keywords present in the resume draft text
 * (summary + competencies + bullets) — same idea as tailor jd_alignment_score.
 */
export async function scoreMasterAgainstJd(
  profile: ResumeContext,
  jdText: string
): Promise<AtsScoreResult> {
  if (!jdText || jdText.trim().length < 40) {
    return structureAtsScore(profile);
  }
  const jdMatch = await runJdMatch(profile, jdText);
  const keywords = jdMatch.jdKeywords || [];
  if (!keywords.length) {
    return {
      score: 0,
      matched: [],
      missing: [],
      total: 0,
      source: 'jd',
      jdMatch,
    };
  }

  try {
    const mod = await importJdKeywordAlign();
    const measured = mod.measureJdAlignment(profileToResumeShape(profile), keywords) as {
      score: number;
      matched: string[];
      missing: string[];
    };
    return {
      score: measured.score,
      matched: measured.matched,
      missing: measured.missing,
      total: keywords.length,
      source: 'jd',
      jdMatch: {
        ...jdMatch,
        // Keep profile honest/gaps for chips, but primary score is resume-text coverage
        coveragePct: measured.score,
      },
    };
  } catch {
    return {
      score: jdMatch.coveragePct,
      matched: jdMatch.honest,
      missing: jdMatch.gaps,
      total: keywords.length,
      source: 'jd',
      jdMatch,
    };
  }
}
