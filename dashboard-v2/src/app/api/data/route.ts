import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDashboardData } from '@/lib/data-fetcher';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const pollOnly = req.nextUrl.searchParams.get('poll') === '1';
    const data = await getDashboardData(userId, { pollOnly });
    if (pollOnly) {
      return NextResponse.json(data);
    }
    return NextResponse.json({
      ...data,
      apps: data.applications
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load dashboard data';
    console.error('API Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
