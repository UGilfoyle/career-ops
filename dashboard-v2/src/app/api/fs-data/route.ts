import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // Get user profile data from DB
    const profileRow = await sql`
      SELECT resume_context, targeting_keywords
      FROM user_profiles 
      WHERE user_id = ${userId}
    `;

    const baseProfile = profileRow[0] || {
      resume_context: {},
      targeting_keywords: { positive: [], negative: [] }
    };
    
    const resumeContext = baseProfile.resume_context || {};

    return NextResponse.json({
      profile: resumeContext,
      pdfs: [],
      reports: []
    });
  } catch (error: any) {
    console.error('fs-data API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
