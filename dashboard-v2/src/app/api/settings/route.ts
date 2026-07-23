import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';
import { normalizeEducationList } from '@/lib/education-format';

function normalizeContext(value: unknown): Record<string, unknown> {
  let parsed = value;
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
      };
    }
  }
  return outer;
}

function mergeCandidate(base: unknown, incoming: unknown) {
  const out: Record<string, unknown> = {
    ...((base && typeof base === 'object' && !Array.isArray(base) ? base : {}) as Record<string, unknown>),
  };
  const next =
    incoming && typeof incoming === 'object' && !Array.isArray(incoming)
      ? (incoming as Record<string, unknown>)
      : {};
  for (const [key, val] of Object.entries(next)) {
    if (typeof val === 'string') {
      if (val.trim()) out[key] = val.trim();
      continue;
    }
    if (val !== undefined && val !== null) out[key] = val;
  }
  return out;
}

function mergeResumeContext(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const base = normalizeContext(existing);
  const next = normalizeContext(incoming);

  const merged: Record<string, unknown> = {
    ...base,
    ...next,
    candidate: mergeCandidate(base.candidate, next.candidate),
    narrative: { ...(base.narrative as object || {}), ...(next.narrative as object || {}) },
    search: { ...(base.search as object || {}), ...(next.search as object || {}) },
    github_settings: { ...(base.github_settings as object || {}), ...(next.github_settings as object || {}) },
    studio: { ...(base.studio as object || {}), ...(next.studio as object || {}) },
    gcc_campaign: next.gcc_campaign ?? base.gcc_campaign,
  };

  const incomingExp = Array.isArray(next.experience) ? next.experience : [];
  const baseExp = Array.isArray(base.experience) ? base.experience : [];
  merged.experience = incomingExp.length > 0 ? incomingExp : baseExp;

  const incomingEdu = Array.isArray(next.education) ? next.education : [];
  const baseEdu = Array.isArray(base.education) ? base.education : [];
  merged.education = normalizeEducationList(incomingEdu.length > 0 ? incomingEdu : baseEdu);

  return merged;
}

const DEFAULT_PORTALS = ['linkedin', 'naukri', 'indeed', 'instahyre', 'flexiple', 'greenhouse', 'lever', 'japan-dev'];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // Get profile data
    const profileRow = await sql`
      SELECT resume_context, targeting_keywords, openai_key, hf_token 
      FROM user_profiles 
      WHERE user_id = ${userId}
    `;

    // Get user core data (email)
    const userRow = await sql`
      SELECT email FROM users WHERE id = ${userId}
    `;

    const baseProfile = profileRow[0] || {
      resume_context: {},
      targeting_keywords: { positive: [], negative: [] }
    };
    const resumeContext = normalizeContext(baseProfile.resume_context);
    if (Array.isArray(resumeContext.education) && resumeContext.education.length > 0) {
      resumeContext.education = normalizeEducationList(resumeContext.education);
    }
    const search = resumeContext.search as { portals?: unknown[] } | undefined;
    const hasSearchPortals = Array.isArray(search?.portals) && search.portals.length > 0;
    const userEmail = userRow[0]?.email || '';

    // Seed sensible defaults, especially for Akash's account, while preserving existing user data.
    if (!hasSearchPortals && userEmail === 'akash.k96.official@gmail.com') {
      resumeContext.search = { portals: DEFAULT_PORTALS };
      if (!resumeContext.gcc_campaign) {
        resumeContext.gcc_campaign = {
          started_at: new Date().toISOString().slice(0, 10),
          daily_log: {},
          targets: [],
        };
      }
      if (!baseProfile.targeting_keywords?.positive?.length) {
        baseProfile.targeting_keywords = {
          positive: [
            'Global Capability Center', 'GCC', 'platform ownership', 'senior software engineer',
            'data engineer', 'ML engineer', 'DevOps', 'SRE', 'product engineering',
          ],
          negative: ['bench', 'staff augmentation', 'body shopping', 'internship', '0-2 years'],
        };
      }
    }

    const targetingKeywords = baseProfile.targeting_keywords || {};
    const normalizedTargeting = {
      positive: Array.isArray(targetingKeywords.positive) ? targetingKeywords.positive : [],
      negative: Array.isArray(targetingKeywords.negative) ? targetingKeywords.negative : [],
    };

    return NextResponse.json({
      ...baseProfile,
      targeting_keywords: normalizedTargeting,
      resume_context: resumeContext,
      email: userEmail
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const data = await req.json();

    const resumeContext = normalizeContext(data.resume_context);
    const hasTargeting = Object.prototype.hasOwnProperty.call(data, 'targeting_keywords');
    const targetingKeywords = hasTargeting
      ? data.targeting_keywords || { positive: [], negative: [] }
      : null;
    const openaiKey = Object.prototype.hasOwnProperty.call(data, 'openai_key') ? data.openai_key : undefined;
    const hfToken = Object.prototype.hasOwnProperty.call(data, 'hf_token') ? data.hf_token : undefined;

    const [existingRow] = await sql`
      SELECT resume_context, targeting_keywords, openai_key, hf_token FROM user_profiles WHERE user_id = ${userId}
    `;
    const existingContext = normalizeContext(
      (existingRow as { resume_context?: Record<string, unknown> })?.resume_context
    );
    const mergedContext = mergeResumeContext(existingContext, resumeContext);
    const nextTargeting = targetingKeywords ?? (existingRow as { targeting_keywords?: unknown })?.targeting_keywords ?? { positive: [], negative: [] };
    const nextOpenai = openaiKey !== undefined ? openaiKey : (existingRow as { openai_key?: string | null })?.openai_key ?? null;
    const nextHf = hfToken !== undefined ? hfToken : (existingRow as { hf_token?: string | null })?.hf_token ?? null;

    // 1. Update Profile (JSON fields)
    await sql`
      INSERT INTO user_profiles (user_id, resume_context, targeting_keywords, openai_key, hf_token)
      VALUES (${userId}, ${sql.json(mergedContext as never)}, ${sql.json(nextTargeting as never)}, ${nextOpenai}, ${nextHf})
      ON CONFLICT (user_id) DO UPDATE SET 
        resume_context = EXCLUDED.resume_context,
        targeting_keywords = EXCLUDED.targeting_keywords,
        openai_key = EXCLUDED.openai_key,
        hf_token = EXCLUDED.hf_token,
        updated_at = CURRENT_TIMESTAMP
    `;

    // 2. Update Core Account Info (Email/Password)
    if (data.email) {
      await sql`UPDATE users SET email = ${data.email} WHERE id = ${userId}`;
    }

    if (data.password) {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${userId}`;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Settings API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
