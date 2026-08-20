import { NextResponse } from 'next/server';
import { buildDownloadFilename } from '@/lib/document-filename';
import sql from '@/lib/db';
import { auth } from '@/auth';
import { r2ConfigDebug, streamR2Object } from '@/lib/r2-client';
import { renderPdfFromHtml } from '@/lib/pdf-renderer';
import { ensureBackgroundSchema } from '@/lib/ops-schema';
import { parseRunMetadata } from '@/lib/analytics/run-metadata';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Local Chromium or Actions poll can take a while. */
export const maxDuration = 120;

type GithubSettings = { pat?: string; repo?: string };

function pdfHeaders(filename: string, download: boolean, source: string): HeadersInit {
  return {
    'Content-Type': 'application/pdf',
    ...(download
      ? { 'Content-Disposition': `attachment; filename="${filename}"` }
      : { 'X-Frame-Options': 'SAMEORIGIN' }),
    'X-CareerOps-PDF-Source': source,
  };
}

async function resolveGithub(userId: string): Promise<{ pat: string; repo: string } | null> {
  let pat = process.env.GITHUB_PAT || '';
  let repo = process.env.GITHUB_REPO || 'UGilfoyle/career-ops';
  try {
    const [row] = await sql`
      SELECT resume_context FROM user_profiles WHERE user_id = ${userId} LIMIT 1
    `;
    const settings = (row?.resume_context as { github_settings?: GithubSettings } | undefined)
      ?.github_settings;
    if (settings?.pat) pat = settings.pat;
    if (settings?.repo) repo = settings.repo;
  } catch {
    /* keep env defaults */
  }
  if (!pat) return null;
  return { pat, repo };
}

async function dispatchJobPdfAction(
  userId: string,
  jobId: string,
  which: 'resume' | 'cl'
): Promise<{ ok: boolean; error?: string }> {
  const gh = await resolveGithub(userId);
  if (!gh) {
    return {
      ok: false,
      error:
        'PDF engine unavailable on this server and GITHUB_PAT is not set. Add PAT in Settings → GitHub Automation, or run: tailor ' +
        jobId +
        ' --deep',
    };
  }

  const actionArgs = `${jobId} ${which}`;
  const runId = `job-pdf-${jobId}-${which}-${Date.now()}`;
  const runMeta = parseRunMetadata({
    actionScript: 'export-job-pdf.mjs',
    actionArgs,
    jobId,
  });

  try {
    await ensureBackgroundSchema(sql);
    await sql`
      INSERT INTO background_runs (id, user_id, action_script, action_args, status, job_id, action_type)
      VALUES (
        ${runId},
        ${String(userId)},
        ${'export-job-pdf.mjs'},
        ${actionArgs},
        ${'queued'},
        ${runMeta.job_id},
        ${'export_pdf'}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  } catch {
    /* non-fatal */
  }

  const res = await fetch(
    `https://api.github.com/repos/${gh.repo}/actions/workflows/scraper-cron.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${gh.pat}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          user_id: String(userId),
          run_id: runId,
          action_script: 'export-job-pdf.mjs',
          action_args: actionArgs,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `GitHub Actions dispatch failed (${res.status}): ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

async function pollJobPdf(
  userId: string,
  jobId: string,
  type: 'resume' | 'cl',
  attempts = 28,
  intervalMs = 3000
): Promise<{ pdf: Buffer; key: string | null } | null> {
  // Actions runners often need ~15–40s to start; don't burn early polls.
  await new Promise((r) => setTimeout(r, 12000));

  for (let i = 0; i < attempts; i++) {
    const [row] = await sql`
      SELECT resume_pdf, cover_letter_pdf, resume_pdf_key, cover_letter_pdf_key
      FROM jobs
      WHERE id = ${jobId} AND user_id = ${userId}
      LIMIT 1
    `;
    if (row) {
      const pdf = type === 'cl' ? row.cover_letter_pdf : row.resume_pdf;
      const key = type === 'cl' ? row.cover_letter_pdf_key : row.resume_pdf_key;
      if (pdf) {
        const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf as Uint8Array);
        if (buf.length) return { pdf: buf, key: key ? String(key) : null };
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
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
    const waitActions = searchParams.get('wait') !== '0';

    const { id } = await params;
    const jobId = id;
    const userId = session.user.id;
    const docType: 'resume' | 'cl' = type === 'cl' ? 'cl' : 'resume';

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
      (profileRow as { resume_context?: { candidate?: { full_name?: string } } } | undefined)
        ?.resume_context?.candidate?.full_name || session.user.name;

    const downloadFilename = buildDownloadFilename({
      candidateName,
      company: job.company,
      roleTitle: job.title,
      kind: docType === 'cl' ? 'cover' : 'resume',
    });

    if (format === 'pdf') {
      const filename = downloadFilename;
      const key = docType === 'cl' ? job.cover_letter_pdf_key : job.resume_pdf_key;
      const htmlToRender = docType === 'cl' ? job.cover_letter_html : job.resume_html;
      const pdfBytea = docType === 'cl' ? job.cover_letter_pdf : job.resume_pdf;

      // 1) R2
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
                'X-CareerOps-R2-Bucket': String(dbg.bucket),
                'X-CareerOps-R2-Key': String(key),
              },
            });
          }
          console.warn(`[view] R2 miss for job ${jobId} (${msg}); trying fallbacks`);
        }
      }

      // 2) DB BYTEA
      if (pdfBytea) {
        return new NextResponse(pdfBytea, {
          headers: pdfHeaders(filename, download, 'db'),
        });
      }

      if (!htmlToRender) {
        return new NextResponse(
          `PDF not found. Tailor this job first. Example: tailor ${jobId} --deep`,
          { status: 404 }
        );
      }

      // 3) On-demand Chromium — skipped on Vercel by default (burns the whole timeout).
      // Local/dev still tries Playwright/Puppeteer first.
      try {
        const renderedPdf = await renderPdfFromHtml(String(htmlToRender));
        if (renderedPdf?.length) {
          const bytes = Buffer.from(renderedPdf);
          if (docType === 'cl') {
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

      // 4) Reliable path: GitHub Actions + Playwright (same as Resume Studio master PDF)
      if (!waitActions) {
        return new NextResponse(
          `PDF engine could not render on this server. Retry PDF (wait enabled), or run: tailor ${jobId} --deep`,
          { status: 503 }
        );
      }

      const dispatched = await dispatchJobPdfAction(userId, String(jobId), docType);
      if (!dispatched.ok) {
        return new NextResponse(
          dispatched.error ||
            `PDF engine failed. Configure GITHUB_PAT in Settings, or run: tailor ${jobId} --deep`,
          { status: 503 }
        );
      }

      const fromActions = await pollJobPdf(userId, String(jobId), docType, 28, 3000);
      if (fromActions?.pdf?.length) {
        return new NextResponse(new Uint8Array(fromActions.pdf), {
          headers: pdfHeaders(filename, download, 'actions'),
        });
      }

      return new NextResponse(
        `PDF is still generating via GitHub Actions. Wait ~30–60s and click PDF again. (job ${jobId})`,
        { status: 202 }
      );
    }

    const html = docType === 'cl' ? job.cover_letter_html : job.resume_html;

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
  } catch (error: unknown) {
    console.error('View Error:', error);
    return new NextResponse('Error loading content', { status: 500 });
  }
}
