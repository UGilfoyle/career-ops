import { formatEducationLine, type EducationEntry as EduFmt } from '@/lib/education-format';
import {
  normalizeExperienceBulletList,
  sanitizeExperienceEntries,
} from '@/lib/resume/bullet-pipeline';
import { extractTechFromTexts, renderCategorizedSkills } from '@/lib/resume/skills-html-bridge';
import { renderContactBarHtml } from '@/lib/resume/contact-bar';
import { getTemplateHtml } from './ats-professional-template';
import { DEFAULT_TEMPLATE_ID, type ExperienceEntry, type ResumeContext } from './types';
import { formatPeriodDisplay } from './date-range';

function escapeHtml(s: unknown): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripBulletMarkdown(text: string): string {
  return String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^[•\-*▸]\s*/, '')
    .trim();
}

function formatBulletHtml(text: string): string {
  return escapeHtml(stripBulletMarkdown(text));
}

function normalizeHref(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '#';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, '')}`;
}

function displayLink(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

function parseJobMonthIndex(periodStr: string | undefined, which: 'start' | 'end'): number | null {
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  // Split on dashes or prose "to" (same forms accepted by parse-resume-text)
  const parts = String(periodStr || '').split(/\s*(?:[-–—]|to)\s*/i);
  const target = which === 'start' ? parts[0] : parts[1] || parts[0];
  const clean = (target || '').trim().toLowerCase();
  if (/^(?:present|current|now)$/.test(clean)) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }
  // Full names, Sept, and 3-letter abbreviations (case already lowercased)
  const m = clean.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|sept|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\.?\s+(\d{4})\b/
  );
  if (m) {
    const key = m[1].slice(0, 3);
    return parseInt(m[2], 10) * 12 + monthNames[key];
  }
  const y = clean.match(/\b(19|20)\d{2}\b/);
  if (y) return parseInt(y[0], 10) * 12;
  return null;
}

export function calculateYearsOfExperience(experience: ExperienceEntry[] | undefined): number {
  if (!Array.isArray(experience) || experience.length === 0) return 0;
  let earliest = Infinity;
  let latest = 0;
  const nowMonths = new Date().getFullYear() * 12 + new Date().getMonth();
  for (const job of experience) {
    const start = parseJobMonthIndex(job.period, 'start');
    const end = parseJobMonthIndex(job.period, 'end');
    if (start != null) earliest = Math.min(earliest, start);
    if (end != null) latest = Math.max(latest, end);
    else if (start != null) latest = Math.max(latest, nowMonths);
  }
  if (!Number.isFinite(earliest) || earliest === Infinity) return 0;
  const months = Math.max(0, latest - earliest);
  return Math.max(1, Math.round(months / 12));
}

/**
 * Senior profiles (7+ yrs) should fill ~2 pages; 10+ can use 3.
 * Modern Compact can still look short — budget + traditional spacing fix that.
 */
function resolveResumePageBudget(yearsExp: number, roleCount: number): number {
  if (yearsExp >= 10 || roleCount >= 8) return 3;
  // 7+ years → always at least 2 full pages of content budget
  if (yearsExp >= 7 || roleCount >= 5) return 2;
  if (yearsExp >= 4 || roleCount >= 4) return 2;
  if (yearsExp >= 6) return 2;
  return 1;
}

function bulletsBudgetForRole(roleIndex: number, maxPages: number, yearsExp = 0): number {
  // Fuller bullets so 7–9 yr resumes don't look like a half-page dump
  if (maxPages >= 3) return roleIndex < 3 ? 7 : roleIndex < 6 ? 5 : 3;
  if (maxPages >= 2) {
    if (yearsExp >= 7) return roleIndex < 3 ? 7 : roleIndex < 5 ? 5 : 3;
    return roleIndex < 3 ? 6 : roleIndex < 5 ? 4 : 3;
  }
  return roleIndex < 2 ? 4 : 3;
}

function stripDates(text: string): string {
  const datePatterns = [
    /\b\d{4}\s*(?:[-–—]|to)\s*(?:\d{4}|present|current|now)\b/gi,
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Sept|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s*\d{4}\b/gi,
    /\b20\d{2}\b/g,
    /\b(?:present|current|now)\b/gi,
  ];
  let cleaned = text;
  for (const pattern of datePatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }
  return cleaned.replace(/\s*[|—–-]\s*$/, '').replace(/^\s*[|—–-]\s*/, '').trim();
}

export function renderExperienceHtml(
  exp: ExperienceEntry[] | undefined,
  maxPages = 2,
  yearsExp = 0
): string {
  if (!Array.isArray(exp) || exp.length === 0) return '';

  const sanitized = sanitizeExperienceEntries(exp);

  return sanitized
    .map((job, idx) => {
      const employerKey = `${job.company || ''} ${job.role || ''}`;
      const budget = bulletsBudgetForRole(idx, maxPages, yearsExp);
      const bullets = normalizeExperienceBulletList(
        (job.bullets || []).slice(0, budget + 2),
        employerKey
      ).slice(0, budget);
      let role = String(job.role || '').trim().replace(/\s*\((?:contract|freelance|temporary|project)\)\s*/gi, '').trim();
      let company = String(job.company || '').trim();
      const dates = formatPeriodDisplay(job.period || '');
      role = stripDates(role);
      company = stripDates(company);
      if (role.toLowerCase() === company.toLowerCase()) company = '';

      const hasCompanyInRole = company.length > 3 && role.toLowerCase().includes(company.toLowerCase());
      const hasRoleInCompany = role.length > 3 && company.toLowerCase().includes(role.toLowerCase());

      let titleLeft = '';
      if (company && role && !hasCompanyInRole && !hasRoleInCompany) {
        titleLeft = `<span class="job-company">${escapeHtml(company)}</span> - <span class="job-title">${escapeHtml(role)}</span>`;
      } else if (role && hasCompanyInRole) {
        titleLeft = `<span class="job-title">${escapeHtml(role)}</span>`;
      } else if (company && hasRoleInCompany) {
        titleLeft = `<span class="job-company">${escapeHtml(company)}</span>`;
      } else if (company) {
        titleLeft = `<span class="job-company">${escapeHtml(company)}</span>`;
      } else if (role) {
        titleLeft = `<span class="job-title">${escapeHtml(role)}</span>`;
      }

      return `
    <div class="job">
      <div class="job-header">
        <div>${titleLeft}</div>
        <div class="job-dates">${escapeHtml(dates)}</div>
      </div>
      <ul>
        ${bullets.map((b) => `<li>${formatBulletHtml(b)}</li>`).join('')}
      </ul>
    </div>`;
    })
    .join('');
}

export function renderEducationHtml(edu: EduFmt[] | undefined): string {
  if (!Array.isArray(edu) || edu.length === 0) return '';
  return edu.map((e) => `<div>${escapeHtml(formatEducationLine(e))}</div>`).join('');
}

export function renderAchievementsHtml(
  proofPoints: Array<{ name?: string; hero_metric?: string }> | undefined
): string {
  if (!Array.isArray(proofPoints) || proofPoints.length === 0) return '';
  return `<ul>${proofPoints
    .map((p) => {
      const name = escapeHtml(p?.name || 'Achievement');
      const metric = escapeHtml(p?.hero_metric || '');
      return `<li><strong>${name}:</strong> ${metric}</li>`;
    })
    .join('')}</ul>`;
}

/** Technical Skills bullet list — tech stacks only, no narrative / employer brands. */
export function renderSkillsLines(
  superpowers: string[] | undefined,
  limit = 16,
  tailoredCompetencies: string[] | undefined = [],
  jdText = '',
): string {
  void limit;
  return renderCategorizedSkills(superpowers, tailoredCompetencies || [], jdText);
}

/** Soft-wrap long lines on word boundaries — never mid-word ellipsis. */
function wrapSummaryLine(line: string, maxLen: number): string[] {
  const text = String(line || '').trim();
  if (!text) return [];
  if (text.length <= maxLen) return [text];
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }
    if (`${cur} ${w}`.length <= maxLen) {
      cur = `${cur} ${w}`;
    } else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function normalizeResumeSummaryPlain(rawSummary: string, yearsExp: number): string {
  let t = String(rawSummary || '').trim();
  const y = Number(yearsExp) || 0;
  if (!t) {
    t =
      y > 0
        ? `Engineer with ${y}+ years shipping production software, APIs, and reliability-focused systems.\nHands-on with design, delivery, incident ownership, and performance tuning.\nComfortable owning features end-to-end across distributed backends and cloud infrastructure.`
        : `Engineer focused on production systems, APIs, and measurable delivery.\nOwns implementation through monitoring, incidents, and iterative improvements.\nWorks with modern backend stacks and cross-functional partners.`;
  }
  let lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 1) {
    const parts = t.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length > 1) lines = parts;
  }
  // Full summary — wrap long lines, keep enough room for senior profiles. No "…" cuts.
  const maxLines = y >= 7 ? 8 : 6;
  const maxLen = 320;
  const wrapped = lines.flatMap((line) => wrapSummaryLine(line, maxLen));
  return wrapped.slice(0, maxLines).join('\n');
}

/** Master summary: headline + exit_story (no LLM tailor package). */
export function masterSummaryText(ctx: ResumeContext): string {
  const headline = String(ctx.narrative?.headline || '').trim();
  const story = String(ctx.narrative?.exit_story || '').trim();
  if (headline && story) return `${headline}\n${story}`;
  return headline || story || '';
}

export type FillAtsOptions = {
  templateId?: string;
  templateHtml?: string;
};

/**
 * Fill ATS template placeholders from master ResumeContext.
 * Same path used by Studio live preview and PDF/HTML export.
 */
export function fillAtsTemplate(profile: ResumeContext, options: FillAtsOptions = {}): string {
  const templateId = options.templateId || profile.studio?.template_id || DEFAULT_TEMPLATE_ID;
  const templateHtml = options.templateHtml || getTemplateHtml(templateId);
  const c = profile.candidate || {};
  const experience = sanitizeExperienceEntries(Array.isArray(profile.experience) ? profile.experience : []);
  const education = Array.isArray(profile.education) ? profile.education : [];
  const yearsExp = calculateYearsOfExperience(experience);
  const maxPages = resolveResumePageBudget(yearsExp, experience.length);

  const linkedinRaw = String(c.linkedin || '').trim();
  const githubRaw = String(c.github || '').trim();
  const portfolioRaw = String(c.portfolio_url || '').trim();

  const contactBar = renderContactBarHtml(c);
  // Legacy plain-text rows (older template copies)
  const contactParts = [c.location, c.email, c.phone]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  const contactLine = escapeHtml(contactParts.join(' · '));

  const linkParts: string[] = [];
  if (linkedinRaw) {
    linkParts.push(
      `<a href="${escapeHtml(normalizeHref(linkedinRaw))}">${escapeHtml(displayLink(linkedinRaw))}</a>`
    );
  }
  if (githubRaw) {
    linkParts.push(
      `<a href="${escapeHtml(normalizeHref(githubRaw))}">${escapeHtml(displayLink(githubRaw).replace(/^github\.com\//i, 'github.com/'))}</a>`
    );
  } else if (portfolioRaw) {
    linkParts.push(
      `<a href="${escapeHtml(normalizeHref(portfolioRaw))}">${escapeHtml(displayLink(portfolioRaw))}</a>`
    );
  }
  const linksLine = linkParts.join(' · ');

  const profileTech = extractTechFromTexts([
    profile.narrative?.headline,
    profile.narrative?.exit_story,
    ...(Array.isArray(profile.experience)
      ? profile.experience.flatMap((e) => [e?.role, ...(e?.bullets || [])])
      : []),
  ], yearsExp >= 7 ? 18 : 14);
  const skillsLines = renderSkillsLines(
    profile.narrative?.superpowers,
    yearsExp >= 7 ? 22 : 16,
    profileTech,
  );
  const hasSkills = Boolean(skillsLines.trim());
  const hasExperience = experience.length > 0;
  const hasEducation = education.length > 0;
  const hasAchievements =
    Array.isArray(profile.narrative?.proof_points) && profile.narrative!.proof_points!.length > 0;

  const displayName = String(c.full_name || '').trim() || 'Your Name';

  const reps: Record<string, string> = {
    NAME: escapeHtml(displayName),
    CONTACT_BAR: contactBar,
    CONTACT_LINE: contactLine,
    LINKS_LINE: linksLine,
    // Legacy placeholders (kept for older template copies)
    EMAIL: escapeHtml(c.email || ''),
    LOCATION: escapeHtml(c.location || ''),
    PHONE: escapeHtml(c.phone || ''),
    LINKEDIN_URL: linkedinRaw ? escapeHtml(normalizeHref(linkedinRaw)) : '#',
    LINKEDIN_DISPLAY: escapeHtml(displayLink(linkedinRaw)),
    PORTFOLIO_LINK: '',
    SUMMARY_TEXT: escapeHtml(normalizeResumeSummaryPlain(masterSummaryText(profile), yearsExp)),
    EXPERIENCE: hasExperience ? renderExperienceHtml(experience, maxPages, yearsExp) : '',
    EXPERIENCE_DISPLAY: hasExperience ? 'block' : 'none',
    ACHIEVEMENTS: hasAchievements ? renderAchievementsHtml(profile.narrative?.proof_points) : '',
    ACHIEVEMENTS_DISPLAY: hasAchievements ? 'block' : 'none',
    EDUCATION: hasEducation ? renderEducationHtml(education) : '',
    EDUCATION_DISPLAY: hasEducation ? 'block' : 'none',
    SKILLS_LINES: skillsLines,
    SKILLS_DISPLAY: hasSkills ? 'block' : 'none',
    YEARS_EXP: String(yearsExp),
    MAX_PAGES: String(maxPages),
  };

  let html = templateHtml;
  for (const [key, val] of Object.entries(reps)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
  }
  // Clear any leftover placeholders
  html = html.replace(/\{\{[A-Z0-9_]+\}\}/g, '');
  return html;
}

/** Lightweight preview ATS estimate (structure completeness, not JD match). */
export function estimateMasterAtsScore(profile: ResumeContext): number {
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
  return Math.min(100, score);
}
