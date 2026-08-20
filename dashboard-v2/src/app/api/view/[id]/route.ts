import { NextResponse } from 'next/server';
import { buildDownloadFilename } from '@/lib/document-filename';
import sql from '@/lib/db';
import { auth } from '@/auth';
import { r2ConfigDebug, streamR2Object } from '@/lib/r2-client';
import { renderPdfFromHtml } from '@/lib/pdf-renderer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** On-demand HTML→PDF can take a while on cold Chromium. */
export const maxDuration = 60;

function pdfHeaders(filename: string, download: boolean, source: string): HeadersInit {
  return {
    'Content-Type': 'application/pdf',
    ...(download
      ? { 'Content-Disposition': `attachment; filename="${filename}"` }
      : { 'X-Frame-Options': 'SAMEORIGIN' }),
    'X-CareerOps-PDF-Source': source,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'resume'; // 'resume' or 'cl'
    const download = searchParams.get('download') === '1';
    const format = searchParams.get('format') || 'html'; // 'html' | 'pdf'

    const { id } = await params;
    const jobId = id;
    const userId = session.user.id;

    const [job] = await sql`
      SELECT
        company,
        title,
        resume_html,
        cover_letter_html,
        resume_pdf,
        cover_letter_pdf,
        resume_pdf_key,
        cover_letter_pdf_key
      FROM jobs
      WHERE id = ${jobId} AND user_id = ${userId}
    `;

    if (!job) {
      return new NextResponse('Job not found', { status: 404 });
    }

    const [profileRow] = await sql`
      SELECT resume_context FROM user_profiles WHERE user_id = ${userId} LIMIT 1
    `;
    const candidateName =
      (profileRow as any)?.resume_context?.candidate?.full_name || session.user.name;

    const downloadFilename = buildDownloadFilename({
      candidateName,
      company: job.company,
      roleTitle: job.title,
      kind: type === 'cl' ? 'cover' : 'resume',
    });

    if (format === 'pdf') {
      const filename = downloadFilename;
      const key = type === 'cl' ? job.cover_letter_pdf_key : job.resume_pdf_key;
      const htmlToRender = type === 'cl' ? job.cover_letter_html : job.resume_html;
      const pdfBytea = type === 'cl' ? job.cover_letter_pdf : job.resume_pdf;

      // 1) R2 (preferred when tailor --deep uploaded a PDF)
      if (key) {
        const dbg = r2ConfigDebug();
        try {
          const stream = await streamR2Object(String(key));
          if (stream) {
            return new NextResponse(stream, {
              headers: pdfHeaders(filename, download, 'r2'),
            });
          }
        } catch (e: unknown) {
          const msg = String((e as { message?: string })?.message || '');
          // Recoverable: fall through to BYTEA / on-demand
          const recoverable =
            msg.includes('NoSuchKey') ||
            msg.includes('AccessDenied') ||
            msg.includes('SignatureDoesNotMatch') ||
            msg.includes('InvalidAccessKeyId');

          if (!recoverable) {
            return new NextResponse(`R2 error: ${msg}`, {
              status: 500,
              headers: {
                'X-CareerOps-R2-Endpoint': String(dbg.endpoint),
                'X-CareerOps-R2-Force-Path-Style': String(dbg.forcePathStyle),
                'X-CareerOps-R2-Bucket': String(dbg.bucket),
                'X-CareerOps-R2-Key': String(key),
              },
            });
          }
          console.warn(`[view] R2 miss for job ${jobId} (${msg}); trying fallbacks`);
        }
      }

      // 2) Legacy DB BYTEA
      if (pdfBytea) {
        return new NextResponse(pdfBytea, {
          headers: pdfHeaders(filename, download, 'db'),
        });
      }

      // 3) On-demand: render from tailored HTML (most common after soft tailor)
      if (htmlToRender) {
        try {
          const renderedPdf = await renderPdfFromHtml(String(htmlToRender));
          if (renderedPdf?.length) {
            const bytes = Buffer.from(renderedPdf);
            if (type === 'cl') {
              void sql`
                UPDATE jobs SET cover_letter_pdf = ${bytes}
                WHERE id = ${jobId} AND user_id = ${userId}
              `.catch(() => {});
            } else {
              void sql`
                UPDATE jobs SET resume_pdf = ${bytes}
                WHERE id = ${jobId} AND user_id = ${userId}
              `.catch(() => {});
            }

            return new NextResponse(new Uint8Array(bytes), {
              headers: pdfHeaders(filename, download, 'on-demand-render'),
            });
          }
        } catch (err) {
          console.error('[view] On-demand PDF render failed:', err);
        }

        return new NextResponse(
          `PDF engine could not render this document. Preview HTML works; retry PDF in a moment, or run: tailor ${jobId} --deep`,
          { status: 503 }
        );
      }

      return new NextResponse(
        `PDF not found. Tailor this job first (HTML or PDF). Example: tailor ${jobId} --deep`,
        { status: 404 }
      );
    }

    const html = type === 'cl' ? job.cover_letter_html : job.resume_html;

    if (!html) {
      return new NextResponse('Content not found', { status: 404 });
    }

    const filename = downloadFilename.replace(/\.pdf$/i, '.html');
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN',
        ...(download
          ? { 'Content-Disposition': `attachment; filename="${filename}"` }
          : {}),
      },
    });
  } catch (error: any) {
    console.error('View Error:', error);
    return new NextResponse('Error loading content', { status: 500 });
  }
}
