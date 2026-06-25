import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';
import fs from 'fs';
import path from 'path';

import { getDashboardData } from '@/lib/data-fetcher';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const data = await getDashboardData(userId);
    return NextResponse.json({
      ...data,
      apps: data.applications
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
