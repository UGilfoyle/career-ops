import type { ResumeContext } from './types';
import { masterSummaryText } from './fill-template';
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

/**
 * Real ATS-style score vs JD: honest keyword coverage from jd-profile-match.
 */
export async function scoreMasterAgainstJd(
  profile: ResumeContext,
  jdText: string
): Promise<AtsScoreResult> {
  if (!jdText || jdText.trim().length < 40) {
    return structureAtsScore(profile);
  }
  const jdMatch = await runJdMatch(profile, jdText);
  return {
    score: jdMatch.coveragePct,
    matched: jdMatch.honest,
    missing: jdMatch.gaps,
    total: jdMatch.jdKeywords.length,
    source: 'jd',
    jdMatch,
  };
}
