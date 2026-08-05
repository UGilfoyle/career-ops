import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import type { NextAuthConfig } from "next-auth"
import { adminPassword, isAdminEmail } from "@/lib/admin"
import {
  checkLoginAttemptLimits,
  clearLoginFailures,
  getClientIpFromHeaders,
  recordLoginFailure,
} from "@/lib/rate-limit"
import { verifyTurnstile } from "@/lib/turnstile"

const DAY_SECONDS = 24 * 60 * 60

/** Login lifetime in days. Env-overridable so ops can tune without a code change. */
function sessionMaxAgeSeconds(): number {
  const raw = Number(process.env.AUTH_SESSION_MAX_AGE_DAYS)
  const days = Number.isFinite(raw) && raw > 0 ? raw : 30
  return Math.round(days * DAY_SECONDS)
}

/** Single source of truth for session policy — shared by auth.ts so it can't drift. */
export const sessionConfig = {
  strategy: "jwt" as const,
  // Rolling 30-day login by default; the cookie inherits this maxAge.
  maxAge: sessionMaxAgeSeconds(),
  // Re-issue the JWT at most once a day so entitlement/admin claims stay fresh
  // without a write on every request.
  updateAge: DAY_SECONDS,
}

export const authConfig = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Turnstile", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email);
        const ip = await getClientIpFromHeaders();

        const captchaOk = await verifyTurnstile(
          credentials.turnstileToken as string | undefined,
          ip
        );
        if (!captchaOk) {
          throw new Error("Security check failed. Please complete the captcha and try again.");
        }

        const limits = await checkLoginAttemptLimits(email, ip);
        if (!limits.ok) {
          throw new Error(
            `Too many login attempts. Try again in ${Math.ceil(limits.retryAfterSec / 60)} minutes.`
          );
        }

        const pg = require("pg");
        const pool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
        });
        const bcrypt = require("bcryptjs");

        try {
          const res = await pool.query("SELECT * FROM users WHERE email = $1 LIMIT 1", [email]);
          const user = res.rows[0];

          if (user && user.password) {
            if (!user.email_verified && !isAdminEmail(email)) {
              throw new Error("Please verify your email before logging in.");
            }
            const isMatch = await bcrypt.compare(credentials.password as string, user.password);
            if (isMatch) {
              await clearLoginFailures(email);
              return { id: user.id.toString(), name: user.name, email: user.email };
            }
          }

          if (isAdminEmail(email)) {
            const pass = adminPassword();
            if (pass && credentials.password === pass) {
              await clearLoginFailures(email);
              return {
                id: user?.id?.toString() || "admin",
                name: user?.name || "Admin",
                email,
              };
            }
          }

          await recordLoginFailure(email);
          return null;
        } catch (error) {
          if (error instanceof Error && error.message.includes("verify your email")) {
            throw error;
          }
          if (error instanceof Error && (error.message.includes("Too many") || error.message.includes("Security check"))) {
            throw error;
          }
          console.error("Auth Error:", error);
          return null;
        } finally {
          await pool.end();
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      if (session.user?.email) {
        session.user.isAdmin = Boolean(token.isAdmin) || isAdminEmail(session.user.email);
      }
      if (typeof token.githubLogin === 'string') {
        session.user.githubLogin = token.githubLogin;
      }
      return session;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.sub = user.id;
        token.isAdmin = isAdminEmail(user.email);
      } else if (token.email) {
        token.isAdmin = isAdminEmail(String(token.email));
      }
      if (account?.provider === 'github' && profile && typeof profile === 'object' && 'login' in profile) {
        token.githubLogin = String((profile as { login: string }).login);
      }
      return token;
    },
  },
  session: sessionConfig,
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
