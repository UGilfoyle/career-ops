import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fillAtsTemplate } from '@/lib/resume/fill-template';
import { validateResumeDraft } from '@/lib/resume/schema';
import type { ResumeContext } from '@/lib/resume/types';
import { writeFile, unlink, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import { execFile as execFileCb } from 'child_process';

const execFile = promisify(execFileCb);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function tryRenderPdf(html: string): Promise<Buffer | null> {
  // Prefer playwright if installed in this package or hoisted from monorepo tools.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pw: any = await import('playwright');
    const chromium = pw.chromium;
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
        preferCSSPageSize: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  } catch {
    // fall through
  }

  try {
    const id = randomUUID();
    const dir = join(tmpdir(), 'career-ops-studio');
    await mkdir(dir, { recursive: true });
    const htmlPath = join(dir, `${id}.html`);
    const pdfPath = join(dir, `${id}.pdf`);
    await writeFile(htmlPath, html, 'utf8');

    const candidates = [
      join(process.cwd(), 'runtime-assets', 'generate-pdf.mjs'),
      join(process.cwd(), '..', 'generate-pdf.mjs'),
    ];

    let ran = false;
    for (const script of candidates) {
      try {
        await execFile('node', [script, htmlPath, pdfPath, '--format=a4'], {
          timeout: 45000,
          env: process.env,
        });
        ran = true;
        break;
      } catch {
        // try next
      }
    }

    if (!ran) {
      await unlink(htmlPath).catch(() => {});
      return null;
    }

    const buf = await readFile(pdfPath);
    await Promise.all([unlink(htmlPath).catch(() => {}), unlink(pdfPath).catch(() => {})]);
    return buf;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const resumeContext = (body.resume_context || {}) as ResumeContext;
    const validation = validateResumeDraft(resumeContext);
    // Soft gate: allow export with warnings but require name for filename sanity
    if (!resumeContext.candidate?.full_name?.trim()) {
      return NextResponse.json(
        { error: 'Full name is required before export.', issues: validation.errors },
        { status: 400 }
      );
    }

    const html = fillAtsTemplate(resumeContext);
    const pdf = await tryRenderPdf(html);

    if (pdf) {
      const safeName = String(resumeContext.candidate?.full_name || 'resume')
        .replace(/[^\w\- ]+/g, '')
        .replace(/\s+/g, '_');
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${safeName}_master_resume.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(
      {
        error:
          'PDF engine unavailable on this host (Playwright not installed). HTML uses the same ATS template — download below or run tailor --deep via GitHub Actions for PDF.',
        html,
        message: 'PDF unavailable — HTML returned for download.',
      },
      { status: 501 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
