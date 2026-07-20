/**
 * Canonical master resume shape — same JSON stored in user_profiles.resume_context.
 * Competencies map to narrative.superpowers (what agentic-tailor already reads).
 */

export type Candidate = {
  full_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio_url?: string;
};

export type Narrative = {
  headline?: string;
  exit_story?: string;
  superpowers?: string[];
  proof_points?: Array<{ name?: string; hero_metric?: string }>;
};

export type ExperienceEntry = {
  role?: string;
  company?: string;
  period?: string;
  location?: string;
  bullets?: string[];
};

export type EducationEntry = {
  degree?: string;
  school?: string;
  period?: string;
  location?: string;
};

export type StudioSettings = {
  template_id?: string;
};

export type ResumeContext = {
  candidate?: Candidate;
  narrative?: Narrative;
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  studio?: StudioSettings;
  github_settings?: { pat?: string; repo?: string };
  search?: { portals?: string[] };
  [key: string]: unknown;
};

export const DEFAULT_TEMPLATE_ID = 'ats-professional';

export function emptyResumeContext(): ResumeContext {
  return {
    candidate: {
      full_name: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      portfolio_url: '',
    },
    narrative: {
      headline: '',
      exit_story: '',
      superpowers: [],
      proof_points: [],
    },
    experience: [],
    education: [],
    studio: { template_id: DEFAULT_TEMPLATE_ID },
  };
}

/** Competencies chip list — canonical store is narrative.superpowers */
export function getCompetencies(ctx: ResumeContext): string[] {
  const list = ctx.narrative?.superpowers;
  return Array.isArray(list) ? list.map((s) => String(s || '').trim()).filter(Boolean) : [];
}

export function setCompetencies(ctx: ResumeContext, tags: string[]): ResumeContext {
  return {
    ...ctx,
    narrative: {
      ...(ctx.narrative || {}),
      superpowers: tags.map((s) => s.trim()).filter(Boolean),
    },
  };
}
