import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import {
  checkOtpVerifyLimits,
  getClientIp,
  isOtpLockedOut,
  recordOtpFailure,
} from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    const { email, token } = await req.json();

    if (!email || !token) {
      return NextResponse.json({ error: 'Missing email or token' }, { status: 400 });
    }

    if (await isOtpLockedOut(email)) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Wait 15 minutes or request a new code.' },
        { status: 429 }
      );
    }

    const otpLimits = await checkOtpVerifyLimits(email, clientIp);
    if (!otpLimits.ok) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${otpLimits.retryAfterSec}s.` }, { status: 429 });
    }

    const [verificationToken] = await sql`
      SELECT * FROM verification_tokens 
      WHERE identifier = ${email} AND token = ${token}
    `;

    if (!verificationToken) {
      await recordOtpFailure(email);
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    const hasExpired = new Date(verificationToken.expires) < new Date();
    if (hasExpired) {
      await sql`DELETE FROM verification_tokens WHERE id = ${verificationToken.id}`;
      return NextResponse.json({ error: 'Verification code has expired' }, { status: 400 });
    }

    await sql`
      UPDATE users 
      SET email_verified = CURRENT_TIMESTAMP 
      WHERE email = ${email}
    `;

    await sql`DELETE FROM verification_tokens WHERE id = ${verificationToken.id}`;

    return NextResponse.json({ success: true, message: 'Email verified successfully' });
  } catch (error: unknown) {
    console.error('Verification API Error:', error);
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
