import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { generateVerificationToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/mail';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';
import {
  ensureNewsletterSchema,
  ensureUserReferralCode,
  generateReferralCode,
} from '@/lib/newsletter';
import { ensureUserProfilesSchema } from '@/lib/ops-schema';

// Lead Engineer Note: Enforcing a strict schema for the registration payload
const RegistrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  referral_code: z.string().trim().max(32).optional(),
  turnstile_token: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);
    const rl = await rateLimit(`register:ip:${clientIp}`, { windowMs: 60_000, max: 8 });
    if (!rl.ok) {
      return NextResponse.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
    }

    // 0. Vital Infrastructure Check
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "DATABASE_URL is missing in environment variables. Critical infrastructure setup required." }, { status: 500 });
    }

    const body = await req.json();
    
    // 1. Validate incoming data
    const validation = RegistrationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ 
        error: validation.error.issues[0].message 
      }, { status: 400 });
    }

    const { name, email, password, referral_code: rawRef, turnstile_token } = validation.data;

    const captchaOk = await verifyTurnstile(turnstile_token, clientIp);
    if (!captchaOk) {
      return NextResponse.json({ error: 'Security check failed. Please complete the captcha.' }, { status: 400 });
    }

    const emailRl = await rateLimit(`register:email:${email.trim().toLowerCase()}`, { windowMs: 60 * 60_000, max: 3 });
    if (!emailRl.ok) {
      return NextResponse.json({ error: `Too many signup attempts for this email. Try again in ${emailRl.retryAfterSec}s.` }, { status: 429 });
    }

    const referredBy = String(rawRef || '').trim().toUpperCase() || null;

    // 2. Lead Engineer Schema Guard: Ensure tables exist
    // This prevents 500 errors if the DB is fresh
    try {
      await ensureUserProfilesSchema(sql);
      await ensureNewsletterSchema(sql);
    } catch (schemaError) {
       console.error('Schema Sync Warning:', schemaError);
       // We continue as the table might already exist but we lack permissions to 'CREATE'
    }

    // 3. Check if user already exists
    const existingUser = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existingUser.length > 0) {
      return NextResponse.json({ error: 'User with this identity record already exists.' }, { status: 400 });
    }

    // Validate referrer code if present (ignore invalid codes — don't block signup)
    let validReferredBy: string | null = null;
    if (referredBy) {
      const [refUser] = await sql`
        SELECT id FROM users WHERE UPPER(referral_code) = ${referredBy} LIMIT 1
      `;
      if (refUser) validReferredBy = referredBy;
    }

    // 4. Hash password with lead engineer grade security
    const hashedPassword = await bcrypt.hash(password, 12);

    // 5. Create User in DB (Unverified) with referral fields
    let user: { id: number | string; name: string; email: string } | undefined;
    let ownCode = generateReferralCode();
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const rows = await sql`
          INSERT INTO users (name, email, password, newsletter_opt_in, referral_code, referred_by)
          VALUES (${name}, ${email}, ${hashedPassword}, true, ${ownCode}, ${validReferredBy})
          RETURNING id, name, email
        `;
        user = rows[0] as typeof user;
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/referral_code|unique/i.test(msg) && attempt < 5) {
          ownCode = generateReferralCode();
          continue;
        }
        // Columns may not exist yet on very old DBs — fall back
        if (/newsletter_opt_in|referral_code|referred_by|column/i.test(msg)) {
          const rows = await sql`
            INSERT INTO users (name, email, password)
            VALUES (${name}, ${email}, ${hashedPassword})
            RETURNING id, name, email
          `;
          user = rows[0] as typeof user;
          break;
        }
        throw e;
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Could not create user account.' }, { status: 500 });
    }

    try {
      await ensureUserReferralCode(sql, user.id);
      if (validReferredBy) {
        await sql`
          UPDATE users SET referred_by = COALESCE(referred_by, ${validReferredBy})
          WHERE id = ${user.id}
        `;
      }
    } catch (refErr) {
      console.warn('Referral code post-create warning:', refErr);
    }

    // 6. Initialize User Profile for Onboarding
    await sql`
      INSERT INTO user_profiles (user_id, resume_context, targeting_keywords)
      VALUES (${user.id}, ${sql.json({})}, ${sql.json({ positive: [], negative: [] })})
      ON CONFLICT (user_id) DO NOTHING
    `;

    // 7. Generate and Send OTP
    const verificationToken = await generateVerificationToken(email);
    
    try {
      await sendVerificationEmail(email, verificationToken.token);
    } catch (mailError) {
      console.error('Email Gateway Congestion:', mailError);
    }

    return NextResponse.json({ 
      success: true, 
      user: { id: user.id, name: user.name, email: user.email },
      message: "Verification sequence initialized"
    });

  } catch (error: any) {
    console.error('CRITICAL: Registration Breakdown:', error);
    // Lead Engineer: Ensure we ALWAYS return JSON, even in catastrophic failure.
    return NextResponse.json({ 
      error: `Infrastructure Error: ${error.message || 'Unknown breakdown'}. Please verify your DATABASE_URL connectivity.` 
    }, { status: 500 });
  }
}
