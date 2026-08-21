import type postgres from 'postgres';
import type { ResumeContext } from '@/lib/resume/types';
import { normalizeExternalUrl } from '@/lib/telemetry/urls';

/** Same unwrap as settings — resume_context may be string / double-nested. */
export function unwrapResumeContext(value: unknown): ResumeContext {
  let parsed: unknown = value;
  for (let depth = 0; depth < 3 && typeof parsed === 'string'; depth += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const outer = { ...(parsed as Record<string, unknown>) };
  for (const key of ['resume_context', 'profile']) {
    let nested = outer[key];
    if (typeof nested === 'string') {
      try {
        nested = JSON.parse(nested);
      } catch {
        nested = null;
      }
    }
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      delete outer[key];
      return {
        ...outer,
        ...(nested as Record<string, unknown>),
      } as ResumeContext;
    }
  }
  return outer as ResumeContext;
}

export type CompanionProfile = {
  name: string;
  headline: string;
  location: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  summary: string | null;
};

/**
 * Strip JD-keyword weave crumbs from companion copy so recruiters don't see
 * "(WebSockets, Jenkins) (CI/CD) (GCP)…" spam on the stealth landing page.
 */
export function cleanCompanionSummary(text: string | null | undefined): string | null {
  let s = String(text || '').trim();
  if (!s) return null;
  // Leading stacks of parenthetical skill lists: "(A, B) (C/D) (E). Bio…"
  s = s.replace(/^(\s*\([^)]{2,90}\)\s*)+/g, '').trim();
  s = s.replace(/^[.\u2026]+\s*/, '').trim();
  // Trailing skill-only paren crumbs (allows spaces inside tokens e.g. "REST API")
  s = s
    .replace(
      /\s*\((?:[A-Za-z0-9.+#/\-]+(?:\s+[A-Za-z0-9.+#/\-]+)*(?:,\s*)?){2,}\)\.?\s*$/g,
      '',
    )
    .trim();
  s = s.replace(/^[▸►▶•▪︎]\s*/gm, '');
  s = s.replace(/\s*[▸►▶➢➤⇒➔➜]\s*/g, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (!s || s.length < 24) return null;
  return s.length > 420 ? `${s.slice(0, 417)}…` : s;
}

export async function loadCompanionProfile(
  sql: postgres.Sql,
  userId: string | number
): Promise<CompanionProfile> {
  const uidText = String(userId ?? '').trim();
  const uidNum = Number(uidText);
  const empty: CompanionProfile = {
    name: 'Candidate',
    headline: '',
    location: null,
    githubUrl: null,
    linkedinUrl: null,
    portfolioUrl: null,
    summary: null,
  };
  if (!uidText) return empty;

  let rawContext: unknown = null;
  try {
    const rows = await sql`
      SELECT resume_context
      FROM user_profiles
      WHERE user_id::text = ${uidText}
         OR (${Number.isFinite(uidNum)} AND user_id = ${uidNum})
      LIMIT 1
    `;
    rawContext = rows[0]?.resume_context ?? null;
  } catch {
    try {
      const rows = await sql`
        SELECT resume_context FROM user_profiles
        WHERE user_id = ${Number.isFinite(uidNum) ? uidNum : uidText}
        LIMIT 1
      `;
      rawContext = rows[0]?.resume_context ?? null;
    } catch {
      rawContext = null;
    }
  }

  const ctx = unwrapResumeContext(rawContext);
  const candidate = (ctx.candidate || {}) as Record<string, unknown>;
  const narrative = (ctx.narrative || {}) as Record<string, unknown>;

  let name = String(candidate.full_name || '').trim();
  if (!name) {
    try {
      const users = await sql`
        SELECT name, email FROM users
        WHERE id::text = ${uidText}
           OR (${Number.isFinite(uidNum)} AND id = ${uidNum})
        LIMIT 1
      `;
      const u = users[0];
      name = String(u?.name || '').trim() || String(u?.email || '').split('@')[0] || '';
    } catch {
      // ignore
    }
  }

  const headline = String(narrative.headline || '').trim();
  const exitStory = String(narrative.exit_story || '').trim();
  const summary = cleanCompanionSummary(exitStory);

  return {
    name: name || 'Candidate',
    headline,
    location: String(candidate.location || '').trim() || null,
    githubUrl: normalizeExternalUrl(String(candidate.github || '')),
    linkedinUrl: normalizeExternalUrl(String(candidate.linkedin || '')),
    portfolioUrl: normalizeExternalUrl(String(candidate.portfolio_url || '')),
    summary,
  };
}
