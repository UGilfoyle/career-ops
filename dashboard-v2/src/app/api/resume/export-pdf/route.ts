import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fillAtsTemplate } from '@/lib/resume/fill-template';
import { validateResumeDraft } from '@/lib/resume/schema';
import type { ResumeContext } from '@/lib/resume/types';
import { writeFile, unlink, mkdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import { execFile as execFileCb } from 'child_process';
import { pathToFileURL } from 'url';

const execFile = promisify(execFileCb);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Local Playwright script (repo root / runtime-assets) — best ATS text fidelity. */
async function tryPlaywrightPdf(html: string): Promise<Buffer | null> {
  try {
    const id = randomUUID();
    const dir = join(/* turbopackIgnore: true */ tmpdir(), 'career-ops-studio');
    await mkdir(dir, { recursive: true });
    const htmlPath = join(dir, `${id}.html`);
    const pdfPath = join(dir, `${id}.pdf`);
    await writeFile(htmlPath, html, 'utf8');

    const cwd = /* turbopackIgnore: true */ process.cwd();
    const candidates = [
      join(cwd, 'runtime-assets', 'generate-pdf.mjs'),
      join(cwd, '..', 'generate-pdf.mjs'),
      join(cwd, 'generate-pdf.mjs'),
    ];

    for (const script of candidates) {
      if (!(await fileExists(script))) continue;
      try {
        await execFile('node', [script, htmlPath, pdfPath, '--format=a4'], {
          timeout: 45000,
          env: process.env,
        });
        const buf = await readFile(pdfPath);
        await Promise.all([unlink(htmlPath).catch(() => {}), unlink(pdfPath).catch(() => {})]);
        return buf;
      } catch {
        // try next
      }
    }

    await unlink(htmlPath).catch(() => {});
    return null;
  } catch {
    return null;
  }
}

/**
 * Vercel / serverless: puppeteer-core + @sparticuz/chromium-min (remote pack).
 * Full @sparticuz/chromium in the function zip breaks Vercel ("invalid deployment package" / symlinks).
 * Local fallback: system Chrome when Playwright script is missing.
 */
async function tryPuppeteerPdf(html: string): Promise<Buffer | null> {
  try {
    const puppeteerMod = await import('puppeteer-core');
    const puppeteer = (puppeteerMod as any).default ?? puppeteerMod;
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    let browser;
    if (isServerless) {
      const chromiumMod = await import('@sparticuz/chromium-min');
      const chromium = (chromiumMod as any).default ?? chromiumMod;
      // Pack must match the installed @sparticuz/chromium-min major line.
      const packUrl =
        process.env.CHROMIUM_REMOTE_EXEC_PATH
        || 'https://github.com/Sparticuz/chromium/releases/download/v138.0.2/chromium-v138.0.2-pack.tar';
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
        executablePath: await chromium.executablePath(packUrl),
        headless: true,
      });
    } else {
      // Local: prefer system Chrome / Chromium / Edge
      const localCandidates = [
        process.env.CHROME_PATH,
        process.env.PUPPETEER_EXECUTABLE_PATH,
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
      ].filter(Boolean) as string[];

      let executablePath: string | undefined;
      for (const p of localCandidates) {
        if (await fileExists(p)) {
          executablePath = p;
          break;
        }
      }
      if (!executablePath) return null;

      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
      });
    }

    try {
      const page = await browser.newPage();
      // Prefer file URL so relative assets (fonts) resolve when present
      const id = randomUUID();
      const dir = join(/* turbopackIgnore: true */ tmpdir(), 'career-ops-studio');
      await mkdir(dir, { recursive: true });
      const htmlPath = join(dir, `${id}.html`);
      await writeFile(htmlPath, html, 'utf8');
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 30000 });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0.4in', right: '0.45in', bottom: '0.4in', left: '0.45in' },
        preferCSSPageSize: true,
      });
      await unlink(htmlPath).catch(() => {});
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (err) {
    console.error('[export-pdf] puppeteer render failed:', err);
    return null;
  }
}

async function renderPdf(html: string): Promise<Buffer | null> {
  const viaPlaywright = await tryPlaywrightPdf(html);
  if (viaPlaywright?.length) return viaPlaywright;
  return tryPuppeteerPdf(html);
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
    if (!resumeContext.candidate?.full_name?.trim()) {
      return NextResponse.json(
        { error: 'Full name is required before export.', issues: validation.errors },
        { status: 400 }
      );
    }

    const html = fillAtsTemplate(resumeContext);
    const pdf = await renderPdf(html);

    if (pdf?.length) {
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
          'PDF engine failed. On Vercel, Chromium pack is downloaded at runtime; locally install Chrome or run `npx playwright install chromium`.',
      },
      { status: 503 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
