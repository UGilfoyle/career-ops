import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { isAdminEmail } from '@/lib/admin';

export const dynamic = 'force-dynamic';

type AuthMethod = 'email' | 'github' | 'both' | 'unknown';

function resolveAuthMethod(hasPassword: boolean, providers: string[]): AuthMethod {
  const hasGithub = providers.includes('github');
  if (hasPassword && hasGithub) return 'both';
  if (hasGithub) return 'github';
  if (hasPassword) return 'email';
  return 'unknown';
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.email_verified,
        (u.password IS NOT NULL AND u.password <> '') AS has_password,
        u.newsletter_opt_in,
        u.referred_by,
        u.referral_code,
        COALESCE(
          array_agg(DISTINCT a.provider) FILTER (WHERE a.provider IS NOT NULL),
          ARRAY[]::text[]
        ) AS oauth_providers,
        (SELECT COUNT(*)::int FROM jobs j WHERE j.user_id = u.id) AS jobs_count,
        (SELECT COUNT(*)::int FROM applications ap WHERE ap.user_id = u.id) AS applications_count
      FROM users u
      LEFT JOIN accounts a ON a.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC NULLS LAST, u.id DESC
    `;

    const users = rows.map((row: Record<string, unknown>) => {
      const providers = Array.isArray(row.oauth_providers)
        ? (row.oauth_providers as string[])
        : [];
      const hasPassword = Boolean(row.has_password);
      return {
        id: Number(row.id),
        name: String(row.name || ''),
        email: String(row.email || ''),
        created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
        email_verified: Boolean(row.email_verified),
        auth_method: resolveAuthMethod(hasPassword, providers),
        oauth_providers: providers,
        newsletter_opt_in: row.newsletter_opt_in !== false,
        referred_by: row.referred_by ? String(row.referred_by) : null,
        referral_code: row.referral_code ? String(row.referral_code) : null,
        jobs_count: Number(row.jobs_count || 0),
        applications_count: Number(row.applications_count || 0),
      };
    });

    const summary = {
      total_users: users.length,
      email_only: users.filter((u) => u.auth_method === 'email').length,
      github_only: users.filter((u) => u.auth_method === 'github').length,
      both_methods: users.filter((u) => u.auth_method === 'both').length,
      verified: users.filter((u) => u.email_verified).length,
      unverified: users.filter((u) => !u.email_verified).length,
      newsletter_on: users.filter((u) => u.newsletter_opt_in).length,
      referred: users.filter((u) => u.referred_by).length,
      new_today: users.filter((u) => {
        if (!u.created_at) return false;
        const d = new Date(u.created_at);
        const now = new Date();
        return d.toDateString() === now.toDateString();
      }).length,
      new_week: users.filter((u) => {
        if (!u.created_at) return false;
        return Date.now() - new Date(u.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000;
      }).length,
    };

    return NextResponse.json({ summary, users });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Admin overview failed';
    console.error('[admin/overview]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
