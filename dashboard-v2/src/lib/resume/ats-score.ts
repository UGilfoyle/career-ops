import type { ResumeContext } from './types';
import { masterSummaryText } from './fill-template';
import { getCompetencies, setCompetencies } from './types';
import { runJdMatch, type JdMatchResult } from './jd-match';

export type AtsScoreResult = {
  score: number;
  matched: string[];
  missing: string[];
  total: number;
  source: 'jd' | 'structure';
  jdMatch?: JdMatchResult;
  /** When mirror ran — updated master profile (skills + summary). */
  alignedProfile?: ResumeContext;
  scoredFrom?: 'draft' | 'tailored' | 'structure';
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
    scoredFrom: 'structure',
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

function applyAlignedResumeToProfile(
  profile: ResumeContext,
  aligned: { summary?: string; core_competencies?: string[] },
): ResumeContext {
  let next = setCompetencies(
    profile,
    Array.isArray(aligned.core_competencies) ? aligned.core_competencies.map(String) : getCompetencies(profile),
  );
  const summary = String(aligned.summary || '').trim();
  if (summary) {
    const headline = String(next.narrative?.headline || '').trim();
    // Prefer keeping headline; park full ATS summary in exit_story.
    next = {
      ...next,
      narrative: {
        ...(next.narrative || {}),
        exit_story: headline && summary.startsWith(headline)
          ? summary.slice(headline.length).trim() || summary
          : summary,
      },
    };
  }
  return next;
}

export function htmlToPlainText(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
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
  jdText: string,
  opts?: { resumeHtml?: string | null },
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
      scoredFrom: 'draft',
    };
  }

  try {
    const mod = await importJdKeywordAlign();
    const tailoredText = opts?.resumeHtml ? htmlToPlainText(opts.resumeHtml) : '';
    if (tailoredText.length > 80) {
      const tailoredMeasured = mod.measureJdAlignment(
        { summary: tailoredText, core_competencies: [], experience: {} },
        keywords,
      ) as { score: number; matched: string[]; missing: string[] };
      return {
        score: tailoredMeasured.score,
        matched: tailoredMeasured.matched,
        missing: tailoredMeasured.missing,
        total: keywords.length,
        source: 'jd',
        scoredFrom: 'tailored',
        jdMatch: { ...jdMatch, coveragePct: tailoredMeasured.score },
      };
    }

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
      scoredFrom: 'draft',
      jdMatch: {
        ...jdMatch,
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
      scoredFrom: 'draft',
      jdMatch,
    };
  }
}

/**
 * Push JD keywords into master profile skills/summary until ≥94% coverage.
 * This is what Studio Live Preview must do — scoring alone does not change the resume.
 */
export async function mirrorJdKeywordsIntoProfile(
  profile: ResumeContext,
  jdText: string,
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
      scoredFrom: 'draft',
      alignedProfile: profile,
      jdMatch,
    };
  }

  const mod = await importJdKeywordAlign();
  const target = Number(mod.JD_ALIGNMENT_TARGET) || 95;
  const pushed = mod.forceJdKeywordCoverage(profileToResumeShape(profile), keywords, {
    target,
    maxPasses: 5,
    sourceExperience: profile.experience || [],
  }) as {
    resume: { summary?: string; core_competencies?: string[]; experience?: Record<string, string[]> };
    alignment: { score: number; matched: string[]; missing: string[] };
  };

  let alignedProfile = applyAlignedResumeToProfile(profile, pushed.resume);
  // also fold weaved bullets back onto experience when shape matches
  const expMap = pushed.resume.experience;
  if (expMap && typeof expMap === 'object' && Array.isArray(alignedProfile.experience)) {
    alignedProfile.experience = alignedProfile.experience.map((role, i) => {
      const bullets = expMap[String(i)];
      if (!Array.isArray(bullets) || !bullets.length) return role;
      return { ...role, bullets: bullets.map(String) };
    });
  }

  // Strip unsolicited AI + decorative arrows for non-AI JDs (same gate as tailor).
  try {
    const { pathToFileURL } = await import('url');
    const { join } = await import('path');
    const rqPath = join(/* turbopackIgnore: true */ process.cwd(), '..', 'resume-quality.mjs');
    const rq = await import(/* webpackIgnore: true */ pathToFileURL(rqPath).href);
    const cleaned = rq.stripUnsolicitedAiFromResume(
      {
        summary: masterSummaryText(alignedProfile),
        core_competencies: getCompetencies(alignedProfile),
        experience: profileToResumeShape(alignedProfile).experience,
      },
      jdText,
    );
    alignedProfile = applyAlignedResumeToProfile(alignedProfile, cleaned);
    if (cleaned.experience && Array.isArray(alignedProfile.experience)) {
      alignedProfile.experience = alignedProfile.experience.map((role, i) => {
        const bullets = cleaned.experience[String(i)];
        if (!Array.isArray(bullets)) return role;
        return { ...role, bullets: bullets.map(String) };
      });
    }
    const remeasured = mod.measureJdAlignment(
      {
        summary: masterSummaryText(alignedProfile),
        core_competencies: getCompetencies(alignedProfile),
        experience: profileToResumeShape(alignedProfile).experience,
      },
      keywords,
    ) as { score: number; matched: string[]; missing: string[] };
    return {
      score: remeasured.score,
      matched: remeasured.matched,
      missing: remeasured.missing,
      total: keywords.length,
      source: 'jd',
      scoredFrom: 'draft',
      alignedProfile,
      jdMatch: { ...jdMatch, coveragePct: remeasured.score },
    };
  } catch {
    /* fall through with mirrored profile */
  }

  return {
    score: pushed.alignment.score,
    matched: pushed.alignment.matched,
    missing: pushed.alignment.missing,
    total: keywords.length,
    source: 'jd',
    scoredFrom: 'draft',
    alignedProfile,
    jdMatch: { ...jdMatch, coveragePct: pushed.alignment.score },
  };
}
