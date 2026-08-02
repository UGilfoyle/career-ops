import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import type { NextAuthConfig } from "next-auth"
import { adminPassword, isAdminEmail } from "@/lib/admin"

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
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Note: For Edge compatibility, we use a separate fetch or 
        // a subset of DB logic if required. For now, this is Node-compatible.
        const pg = require("pg");
        const pool = new pg.Pool({ 
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
        });
        const bcrypt = require("bcryptjs");

        try {
          const res = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [credentials.email]);
          const user = res.rows[0];

          if (user && user.password) {
            if (!user.email_verified && !isAdminEmail(credentials.email as string)) {
              throw new Error("Please verify your email before logging in.");
            }
            const isMatch = await bcrypt.compare(credentials.password as string, user.password);
            if (isMatch) {
              return { id: user.id.toString(), name: user.name, email: user.email };
            }
          }

          // Dedicated admin credentials (admin@career-ops.local or any ADMIN_EMAILS entry)
          if (isAdminEmail(credentials.email as string)) {
            const pass = adminPassword();
            if (pass && credentials.password === pass) {
              return {
                id: user?.id?.toString() || "admin",
                name: user?.name || "Admin",
                email: credentials.email as string,
              };
            }
          }

          return null;
        } catch (error) {
          console.error("Auth Error:", error);
          return null;
        } finally {
          await pool.end();
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      if (session.user?.email) {
        session.user.isAdmin = Boolean(token.isAdmin) || isAdminEmail(session.user.email);
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.isAdmin = isAdminEmail(user.email);
      } else if (token.email) {
        token.isAdmin = isAdminEmail(String(token.email));
      }
      return token;
    }
  },
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;
