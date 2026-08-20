import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

type DocsBody = {
  cover_letter_html?: string;
  resume_html?: string;
  /** When true, clear PDF keys/bytes so UI does not serve stale PDFs after HTML edits. */
  invalidate_pdfs?: boolean;
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;
    const jobId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(jobId)) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
    }

    const [job] = await sql`
      SELECT
        id,
        company,
        title,
        resume_html,
        cover_letter_html,
        (resume_pdf_key IS NOT NULL OR resume_pdf IS NOT NULL) AS has_resume_pdf,
        (cover_letter_pdf_key IS NOT NULL OR cover_letter_pdf IS NOT NULL) AS has_cover_letter_pdf
      FROM jobs
      WHERE id = ${jobId} AND user_id = ${session.user.id}
      LIMIT 1
    `;

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      company: job.company,
      title: job.title,
      resume_html: job.resume_html || null,
      cover_letter_html: job.cover_letter_html || null,
      has_resume_pdf: Boolean(job.has_resume_pdf),
      has_cover_letter_pdf: Boolean(job.has_cover_letter_pdf),
    });
  } catch (error: unknown) {
    console.error('[job/docs GET]', error);
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;
    const jobId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(jobId)) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as DocsBody;
    const hasCover = typeof body.cover_letter_html === 'string';
    const hasResume = typeof body.resume_html === 'string';
    if (!hasCover && !hasResume) {
      return NextResponse.json(
        { error: 'Provide cover_letter_html and/or resume_html' },
        { status: 400 }
      );
    }

    const invalidate = body.invalidate_pdfs !== false;
    const coverHtml = hasCover ? body.cover_letter_html : undefined;
    const resumeHtml = hasResume ? body.resume_html : undefined;

    const [updated] = await sql`
      UPDATE jobs
      SET
        cover_letter_html = CASE
          WHEN ${hasCover} THEN ${coverHtml ?? null}
          ELSE cover_letter_html
        END,
        resume_html = CASE
          WHEN ${hasResume} THEN ${resumeHtml ?? null}
          ELSE resume_html
        END,
        cover_letter_pdf_key = CASE
          WHEN ${hasCover && invalidate} THEN NULL
          ELSE cover_letter_pdf_key
        END,
        cover_letter_pdf = CASE
          WHEN ${hasCover && invalidate} THEN NULL
          ELSE cover_letter_pdf
        END,
        resume_pdf_key = CASE
          WHEN ${hasResume && invalidate} THEN NULL
          ELSE resume_pdf_key
        END,
        resume_pdf = CASE
          WHEN ${hasResume && invalidate} THEN NULL
          ELSE resume_pdf
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${jobId} AND user_id = ${session.user.id}
      RETURNING id
    `;

    if (!updated) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      id: updated.id,
      pdfs_invalidated: invalidate,
    });
  } catch (error: unknown) {
    console.error('[job/docs PATCH]', error);
    return NextResponse.json({ error: 'Failed to save documents' }, { status: 500 });
  }
}
