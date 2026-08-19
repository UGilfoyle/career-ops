import { NextResponse } from 'next/server';
import { canAccessPracticeBeta } from '@/lib/lifetime-access';

export { canAccessPracticeBeta };

/** 403 when the signed-in user is outside the Interview Practice beta allowlist. */
export function practiceComingSoonResponse() {
  return NextResponse.json(
    {
      error: 'coming_soon',
      message: 'Interview Practice is not available on your account yet.',
    },
    { status: 403 },
  );
}

export function assertPracticeBetaAccess(email?: string | null): NextResponse | null {
  if (canAccessPracticeBeta(email)) return null;
  return practiceComingSoonResponse();
}
