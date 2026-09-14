import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { ensureDossierSchema, ensureMasterPdfSchema } from '@/lib/ops-schema';
import { sanitizeSlug } from '@/lib/dossier/dossier-service';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const cleanSlug = sanitizeSlug(slug);
    if (!cleanSlug) {
      return new NextResponse('Invalid candidate slug', { status: 400 });
    }

    await ensureDossierSchema(sql);
    await ensureMasterPdfSchema(sql);

    const [user] = await sql`
      SELECT id, public_slug, COALESCE(public_dossier_enabled, true) as public_dossier_enabled, github_login
      FROM users
      WHERE LOWER(public_slug) = ${cleanSlug}
         OR (public_slug IS NULL AND (LOWER(github_login) = ${cleanSlug} OR id::text = ${cleanSlug}))
      LIMIT 1
    `;

    if (!user || user.public_dossier_enabled === false) {
      return new NextResponse('Resume not available', { status: 404 });
    }

    const [row] = await sql`
      SELECT pdf, content_hash
      FROM master_pdf_exports
      WHERE user_id = ${String(user.id)} AND pdf IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    if (!row?.pdf) {
      return new NextResponse('No compiled resume found for this candidate.', { status: 404 });
    }

    const pdfBuffer = Buffer.isBuffer(row.pdf) ? row.pdf : Buffer.from(row.pdf);
    const filename = `${cleanSlug}_Verified_ATS_Resume.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Failed to stream dossier PDF:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
