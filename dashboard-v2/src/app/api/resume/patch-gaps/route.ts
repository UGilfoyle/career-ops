import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { getCompetencies, setCompetencies, type ResumeContext } from '@/lib/resume/types';
import { scoreMasterAgainstJd, structureAtsScore } from '@/lib/resume/ats-score';
import { weaveKeywordsIntoExperience } from '@/lib/resume/experience-weave';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Surgical Gap-Patching API:
 * Micro-patches specific missing keywords into the resume profile
 * without running a 20-second full LLM cycle.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json().catch(() => ({}));
    const rawKeywords = Array.isArray(body.keywords)
      ? body.keywords.map((k: unknown) => String(k || '').trim()).filter(Boolean)
      : [];

    if (rawKeywords.length === 0) {
      return NextResponse.json(
        { error: 'No keywords provided for gap-patching' },
        { status: 400 },
      );
    }

    let profile = (body.resume_context || body.profile) as ResumeContext | undefined;
    if (!profile) {
      const rows = await sql`
        SELECT resume_context FROM user_profiles WHERE user_id = ${userId} LIMIT 1
      `;
      profile = (rows[0]?.resume_context || {}) as ResumeContext;
    }

    let jdText = String(body.jdText || body.jd_text || '').trim();
    const jobId = body.jobId != null ? Number(body.jobId) : null;

    if (!jdText && Number.isFinite(jobId)) {
      try {
        const rows = await sql`
          SELECT jd_text, notes, description, title, company
          FROM jobs
          WHERE id = ${jobId} AND user_id = ${userId}
          LIMIT 1
        `;
        const row = rows[0];
        jdText = String(row?.jd_text || row?.description || row?.notes || '').trim();
        if (!jdText && (row?.title || row?.company)) {
          jdText = `Position: ${row?.title || 'Engineer'}\nCompany: ${row?.company || 'Company'}\nKeywords: ${rawKeywords.join(', ')}`;
        }
      } catch {
        /* fallback */
      }
    }

    // 1. Current competencies
    const currentCompetencies = getCompetencies(profile);
    const existingLower = new Set(currentCompetencies.map((k) => k.toLowerCase()));

    // 2. Weave missing keywords into competencies cleanly (deduplicated)
    const newlyAdded: string[] = [];
    for (const kw of rawKeywords) {
      if (!existingLower.has(kw.toLowerCase())) {
        newlyAdded.push(kw);
        existingLower.add(kw.toLowerCase());
      }
    }

    const updatedCompetencies = [...currentCompetencies, ...newlyAdded];
    let patchedProfile = setCompetencies(profile, updatedCompetencies);

    // 3. Weave keywords into job experience bullets (so they appear in the jobs experience section too)
    const updatedExperience = weaveKeywordsIntoExperience(
      patchedProfile.experience,
      rawKeywords,
    );
    patchedProfile = {
      ...patchedProfile,
      experience: updatedExperience,
    };

    // 4. Optional: persist to user_profiles if saveProfile flag is present
    if (body.saveProfile) {
      try {
        await sql`
          UPDATE user_profiles
          SET resume_context = ${JSON.stringify(patchedProfile)}
          WHERE user_id = ${userId}
        `;
      } catch (err) {
        console.warn('Could not persist patched profile to database:', err);
      }
    }

    // 4. Recalculate ATS score against the JD
    let atsResult;
    if (jdText && jdText.length >= 40) {
      atsResult = await scoreMasterAgainstJd(patchedProfile, jdText);
    } else {
      atsResult = structureAtsScore(patchedProfile);
    }

    return NextResponse.json({
      ok: true,
      patchedCount: newlyAdded.length,
      newlyAdded,
      patchedProfile,
      score: atsResult.score,
      matched: atsResult.matched,
      missing: atsResult.missing,
      total: atsResult.total,
      source: atsResult.source,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Gap patching failed';
    console.error('patch-gaps error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
