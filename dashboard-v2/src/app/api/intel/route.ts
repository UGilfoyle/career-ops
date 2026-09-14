import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { ensureInterviewIntelSchema } from '@/lib/ops-schema';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  try {
    await ensureInterviewIntelSchema(sql);

    const { searchParams } = new URL(req.url);
    const company = searchParams.get('company')?.trim().toLowerCase();
    const round = searchParams.get('round')?.trim().toLowerCase();
    const query = searchParams.get('q')?.trim().toLowerCase();

    let items;

    if (company && round) {
      items = await sql`
        SELECT id, company, company_slug, role, round_type, difficulty, questions, tips, offer_outcome, upvotes, verified, created_at
        FROM interview_intel
        WHERE (company_slug = ${company} OR LOWER(company) LIKE ${`%${company}%`})
          AND round_type = ${round}
        ORDER BY upvotes DESC, created_at DESC
        LIMIT 50
      `;
    } else if (company) {
      items = await sql`
        SELECT id, company, company_slug, role, round_type, difficulty, questions, tips, offer_outcome, upvotes, verified, created_at
        FROM interview_intel
        WHERE company_slug = ${company} OR LOWER(company) LIKE ${`%${company}%`}
        ORDER BY upvotes DESC, created_at DESC
        LIMIT 50
      `;
    } else if (round) {
      items = await sql`
        SELECT id, company, company_slug, role, round_type, difficulty, questions, tips, offer_outcome, upvotes, verified, created_at
        FROM interview_intel
        WHERE round_type = ${round}
        ORDER BY upvotes DESC, created_at DESC
        LIMIT 50
      `;
    } else if (query) {
      const pattern = `%${query}%`;
      items = await sql`
        SELECT id, company, company_slug, role, round_type, difficulty, questions, tips, offer_outcome, upvotes, verified, created_at
        FROM interview_intel
        WHERE LOWER(company) LIKE ${pattern}
           OR LOWER(role) LIKE ${pattern}
           OR LOWER(COALESCE(tips, '')) LIKE ${pattern}
        ORDER BY upvotes DESC, created_at DESC
        LIMIT 50
      `;
    } else {
      items = await sql`
        SELECT id, company, company_slug, role, round_type, difficulty, questions, tips, offer_outcome, upvotes, verified, created_at
        FROM interview_intel
        ORDER BY upvotes DESC, created_at DESC
        LIMIT 50
      `;
    }

    return NextResponse.json({
      items: items || [],
      total: items?.length || 0,
    });
  } catch (error) {
    console.error('Failed to load interview intel:', error);
    return NextResponse.json({ error: 'Failed to load interview intel' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'You must be logged in to contribute interview intel.' }, { status: 401 });
    }

    const userId = session.user.id || session.user.email || 'anon';

    // Rate limiting: Max 5 contributions per rolling hour per user
    const rlKey = `intel:post:${userId}`;
    const rl = await rateLimit(rlKey, { windowMs: 60 * 60 * 1000, max: 5 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many submissions. Please wait ${rl.retryAfterSec}s before sharing more intel.` },
        { status: 429 }
      );
    }

    const body = (await req.json()) as {
      company: string;
      role: string;
      round_type: string;
      difficulty?: string;
      questions: string[];
      tips?: string;
      offer_outcome?: string;
    };

    const company = String(body.company || '').trim();
    const role = String(body.role || '').trim();
    const roundType = String(body.round_type || '').trim().toLowerCase();
    const difficulty = String(body.difficulty || 'medium').trim().toLowerCase();
    const tips = String(body.tips || '').trim() || null;
    const offerOutcome = String(body.offer_outcome || 'pending').trim().toLowerCase();

    if (!company || company.length < 2) {
      return NextResponse.json({ error: 'Company name is required.' }, { status: 400 });
    }
    if (!role || role.length < 2) {
      return NextResponse.json({ error: 'Role title is required.' }, { status: 400 });
    }

    const validRounds = ['system_design', 'coding_dsa', 'bar_raiser', 'hiring_manager', 'take_home'];
    if (!validRounds.includes(roundType)) {
      return NextResponse.json({ error: 'Invalid round type specified.' }, { status: 400 });
    }

    const rawQuestions = Array.isArray(body.questions) ? body.questions : [];
    const questions = rawQuestions
      .map((q) => String(q || '').trim())
      .filter((q) => q.length > 5);

    if (questions.length === 0) {
      return NextResponse.json({ error: 'Please include at least one interview question.' }, { status: 400 });
    }

    await ensureInterviewIntelSchema(sql);

    const companySlug = company.toLowerCase().replace(/[^a-z0-9]/g, '');

    const [inserted] = await sql`
      INSERT INTO interview_intel (
        user_id,
        company,
        company_slug,
        role,
        round_type,
        difficulty,
        questions,
        tips,
        offer_outcome,
        upvotes,
        verified
      )
      VALUES (
        ${String(userId)},
        ${company},
        ${companySlug},
        ${role},
        ${roundType},
        ${difficulty},
        ${JSON.stringify(questions)},
        ${tips},
        ${offerOutcome},
        1,
        true
      )
      RETURNING id, company, role, round_type, difficulty, questions, tips, offer_outcome, upvotes, created_at
    `;

    return NextResponse.json({
      success: true,
      item: inserted,
    });
  } catch (error) {
    console.error('Failed to submit interview intel:', error);
    return NextResponse.json({ error: 'Failed to submit interview intel' }, { status: 500 });
  }
}
