import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import pg from "pg"
import { generateVerificationToken } from "@/lib/tokens"
import { sendVerificationEmail } from "@/lib/mail"

// Strip channel_binding which is unsupported by the pg Node.js library
const cleanDbUrl = (process.env.DATABASE_URL || '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '')

const pool = new pg.Pool({
  connectionString: cleanDbUrl,
  ssl: { rejectUnauthorized: false },
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // NO adapter with JWT strategy - handle GitHub user creation in signIn callback
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // For GitHub OAuth: auto-create or find user in DB
      if (account?.provider === 'github') {
        if (!user.email) {
          return "/login?error=github-email-missing";
        }

        try {
          const client = await pool.connect();
          try {
            // Check if user exists and whether email verification is complete.
            const existing = await client.query(
              'SELECT id, email_verified FROM users WHERE email = $1',
              [user.email]
            );

            let userId: string | null = null;
            let emailVerified = false;

            if (existing.rows.length === 0) {
              // Create new GitHub user but keep email unverified until OTP confirmation.
              const inserted = await client.query(
                `INSERT INTO users (name, email, email_verified, image)
                 VALUES ($1, $2, NULL, $3)
                 ON CONFLICT (email) DO NOTHING
                 RETURNING id`,
                [user.name, user.email, user.image]
              );

              if (inserted.rows[0]) {
                userId = inserted.rows[0].id.toString();
              } else {
                const fallback = await client.query('SELECT id FROM users WHERE email = $1', [user.email]);
                userId = fallback.rows[0]?.id?.toString() || null;
              }
            } else {
              userId = existing.rows[0].id.toString();
              emailVerified = Boolean(existing.rows[0].email_verified);
            }

            if (userId) {
              await client.query(
                `INSERT INTO user_profiles (user_id, resume_context, targeting_keywords)
                 VALUES ($1, '{}'::jsonb, '{"positive": [], "negative": []}'::jsonb)
                 ON CONFLICT (user_id) DO NOTHING`,
                [userId]
              );

              // Store GitHub OAuth account credentials in accounts table
              await client.query(
                `INSERT INTO accounts (user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (provider, provider_account_id) DO UPDATE SET
                   refresh_token = EXCLUDED.refresh_token,
                   access_token = EXCLUDED.access_token,
                   expires_at = EXCLUDED.expires_at,
                   token_type = EXCLUDED.token_type,
                   scope = EXCLUDED.scope,
                   id_token = EXCLUDED.id_token,
                   session_state = EXCLUDED.session_state`,
                [
                  parseInt(userId),
                  account.type || 'oauth',
                  account.provider,
                  account.providerAccountId,
                  account.refresh_token || null,
                  account.access_token || null,
                  account.expires_at ? BigInt(account.expires_at) : null,
                  account.token_type || null,
                  account.scope || null,
                  account.id_token || null,
                  account.session_state || null
                ]
              );
            }

            if (!emailVerified) {
              const verificationToken = await generateVerificationToken(user.email);
              await sendVerificationEmail(user.email, verificationToken.token);
              return `/verify?email=${encodeURIComponent(user.email)}&provider=github`;
            }

            if (userId) {
              user.id = userId;
            }
          } finally {
            client.release();
          }
        } catch (err) {
          console.error('GitHub signIn DB error:', err);
          return "/login?error=github-auth-failed";
        }
      }
      return true;
    },
  },
})
