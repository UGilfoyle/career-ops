import { NextResponse } from 'next/server';
import { buildDownloadFilename } from '@/lib/document-filename';
import sql from '@/lib/db';
import { auth } from '@/auth';
import { r2ConfigDebug, streamR2Object } from '@/lib/r2-client';

import { renderPdfFromHtml } from '@/lib/pdf-renderer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    
    // In Next.js 15+, params is a Promise that must be awaited
    const { id } = await params;
    const jobId = id;

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
      WHERE id = ${jobId} AND user_id = ${session.user.id}
    `;

    if (!job) {
      return new NextResponse('Job not found', { status: 404 });
    }

    const [profileRow] = await sql`
      SELECT resume_context FROM user_profiles WHERE user_id = ${session.user.id} LIMIT 1
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
      if (key) {
        const dbg = r2ConfigDebug();
        let stream: ReadableStream | null = null;
        try {
          stream = await streamR2Object(String(key));
        } catch (e: unknown) {
          const msg = String((e as { message?: string })?.message || '');
          // Resilience: if R2 key missing or auth broken, fall back to DB BYTEA (older runs)
          // so the user can still download a PDF when it exists.
          if (msg.includes('NoSuchKey') || msg.includes('AccessDenied') || msg.includes('SignatureDoesNotMatch') || msg.includes('InvalidAccessKeyId')) {
            const pdfFallback = type === 'cl' ? job.cover_letter_pdf : job.resume_pdf;
            if (pdfFallback) {
              return new NextResponse(pdfFallback, {
                headers: {
                  'Content-Type': 'application/pdf',
                  ...(download ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {}),
                  'X-CareerOps-PDF-Source': msg.includes('NoSuchKey') ? 'db-fallback-no-r2-key' : 'db-fallback',
                  'X-CareerOps-R2-Key': String(key),
                },
              });
            }
          }
        }
        if (stream) {
          return new NextResponse(stream, {
            headers: {
              'Content-Type': 'application/pdf',
              ...(download ? { 'Content-Disposition': `attachment; filename="${filename}"` } : { 'X-Frame-Options': 'SAMEORIGIN' }),
              'X-CareerOps-PDF-Source': 'r2',
            },
          });
        }
      }

      // Backward compatibility: DB BYTEA (older runs)
      const pdf = type === 'cl' ? job.cover_letter_pdf : job.resume_pdf;
      if (pdf) {
        return new NextResponse(pdf, {
          headers: {
            'Content-Type': 'application/pdf',
            ...(download ? { 'Content-Disposition': `attachment; filename="${filename}"` } : { 'X-Frame-Options': 'SAMEORIGIN' }),
            'X-CareerOps-PDF-Source': 'db',
          },
        });
      }

      // On-demand compilation from HTML if PDF key/bytea is not yet pre-rendered
      const htmlToRender = type === 'cl' ? job.cover_letter_html : job.resume_html;
      if (htmlToRender) {
        try {
          const renderedPdf = await renderPdfFromHtml(htmlToRender);
          if (renderedPdf?.length) {
            // Asynchronously save to DB bytea to cache future requests
            if (type === 'cl') {
              void sql`UPDATE jobs SET cover_letter_pdf = ${renderedPdf} WHERE id = ${jobId} AND user_id = ${session.user.id}`.catch(() => {});
            } else {
              void sql`UPDATE jobs SET resume_pdf = ${renderedPdf} WHERE id = ${jobId} AND user_id = ${session.user.id}`.catch(() => {});
            }

            return new Response(new Uint8Array(renderedPdf), {
              headers: {
                'Content-Type': 'application/pdf',
                ...(download ? { 'Content-Disposition': `attachment; filename="${filename}"` } : { 'X-Frame-Options': 'SAMEORIGIN' }),
                'X-CareerOps-PDF-Source': 'on-demand-render',
              },
            });
          }
        } catch (err) {
          console.error('[view] On-demand PDF render failed:', err);
        }
      }

      return new NextResponse('PDF not found (run tailor --deep first)', { status: 404 });
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
