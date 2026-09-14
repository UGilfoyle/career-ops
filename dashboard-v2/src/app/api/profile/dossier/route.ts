import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { ensureDossierSchema } from '@/lib/ops-schema';
import { updateUserDossierConfig, sanitizeSlug } from '@/lib/dossier/dossier-service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDossierSchema(sql);

    const [user] = await sql`
      SELECT
        id,
        email,
        github_login,
        public_slug,
        COALESCE(public_dossier_enabled, true) as public_dossier_enabled,
        public_dossier_custom
      FROM users
      WHERE email = ${session.user.email}
      LIMIT 1
    `;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const effectiveSlug = user.public_slug || user.github_login || String(user.id);
    const host = process.env.NEXTAUTH_URL || 'https://careerops.dpdns.org';

    return NextResponse.json({
      slug: effectiveSlug,
      isCustomSlug: Boolean(user.public_slug),
      enabled: Boolean(user.public_dossier_enabled),
      publicUrl: `${host}/p/${effectiveSlug}`,
      custom: user.public_dossier_custom || {},
    });
  } catch (error) {
    console.error('Failed to get dossier settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureDossierSchema(sql);

    const [user] = await sql`
      SELECT id FROM users WHERE email = ${session.user.email} LIMIT 1
    `;

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = (await req.json()) as {
      slug?: string;
      enabled?: boolean;
      customName?: string;
      customHeadline?: string;
      customBio?: string;
    };

    const result = await updateUserDossierConfig(user.id, body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const host = process.env.NEXTAUTH_URL || 'https://careerops.dpdns.org';
    return NextResponse.json({
      success: true,
      slug: result.slug,
      publicUrl: `${host}/p/${result.slug}`,
    });
  } catch (error) {
    console.error('Failed to update dossier settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
