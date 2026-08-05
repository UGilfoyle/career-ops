import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyProAccessToken } from '@/lib/billing/access-token';
import { activateProSubscription, hasProAccess } from '@/lib/billing/entitlements';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.json();
  const token = String(body.token || '').trim();
  const userIdFromToken = verifyProAccessToken(token);
  if (!userIdFromToken) {
    return NextResponse.json({ error: 'Invalid or expired access link' }, { status: 400 });
  }

  if (session?.user?.id && String(session.user.id) !== userIdFromToken) {
    return NextResponse.json({ error: 'Log in with the account that purchased Pro' }, { status: 403 });
  }

  await activateProSubscription({ userId: userIdFromToken, provider: 'access_link' });
  const pro = await hasProAccess(userIdFromToken, session?.user?.email);

  return NextResponse.json({ ok: true, hasPro: pro, userId: userIdFromToken });
}
