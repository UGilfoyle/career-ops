import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { fillAtsTemplate } from '@/lib/resume/fill-template';
import { validateResumeDraft } from '@/lib/resume/schema';
import type { ResumeContext } from '@/lib/resume/types';
import { readR2Object, uploadToR2 } from '@/lib/r2-client';
import { writeFile, unlink, mkdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { execFile as execFileCb } from 'child_process';

const execFile = promisify(execFileCb);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Allow polling GitHub Actions → R2 for master PDF. */
export const maxDuration = 120;

const MASTER_EXPORT_META = '_master_export';

type MasterExportMeta = {
  pdf_key?: string;
  content_hash?: string;
  updated_at?: string;
};

type GithubSettings = {
  pat?: string;
  repo?: string;
};

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function contentHash(html: string): string {
  return createHash('sha256').update(html).digest('hex').slice(0, 24);
}

function masterPdfKey(userId: string, hash: string): string {
  return `users/${userId}/master-resume/${hash}.pdf`;
}

function masterHtmlKey(userId: string, hash: string): string {
  return `users/${userId}/master-resume/${hash}.html`;
}

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
        /* try next */
      }
    }

    await unlink(htmlPath).catch(() => {});
    return null;
  } catch {
    return null;
  }
}

async function tryPuppeteerPdf(html: string): Promise<Buffer | null> {
  try {
    // Dynamic imports — use loose typing; CJS/ESM interop differs on Vercel vs local.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteerMod: any = await import('puppeteer-core');
    const puppeteer = puppeteerMod.default ?? puppeteerMod;
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    let browser;
    if (isServerless) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chromiumMod: any = await import('@sparticuz/chromium-min');
      const chromium = chromiumMod.default ?? chromiumMod;
      if (typeof chromium.setGraphicsMode === 'function') {
        chromium.setGraphicsMode(false);
      }
      const packUrl =
        process.env.CHROMIUM_REMOTE_EXEC_PATH
        || 'https://github.com/Sparticuz/chromium/releases/download/v138.0.2/chromium-v138.0.2-pack.tar';
      const executablePath = await chromium.executablePath(packUrl);
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
        executablePath,
        headless: true,
      });
    } else {
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
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.emulateMediaType('print');
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0.4in', right: '0.45in', bottom: '0.4in', left: '0.45in' },
        preferCSSPageSize: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => {});
    }
  } catch (err) {
    console.error('[export-pdf] puppeteer render failed:', err);
    return null;
  }
}

async function renderPdfLocal(html: string): Promise<Buffer | null> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (!isServerless) {
    const viaPlaywright = await tryPlaywrightPdf(html);
    if (viaPlaywright?.length) return viaPlaywright;
  }
  return tryPuppeteerPdf(html);
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

async function dispatchMasterPdfAction(userId: string, hash: string): Promise<{ ok: boolean; error?: string }> {
  const gh = await resolveGithub(userId);
  if (!gh) {
    return {
      ok: false,
      error:
        'GITHUB_PAT missing. Same PAT used for tailor --deep (Settings → GitHub Automation).',
    };
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
          run_id: `master-pdf-${hash}-${Date.now()}`,
          action_script: 'export-master-pdf.mjs',
          action_args: hash,
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

async function pollR2Pdf(pdfKey: string, attempts = 28, intervalMs = 3000): Promise<Buffer | null> {
  for (let i = 0; i < attempts; i++) {
    const buf = await readR2Object(pdfKey);
    if (buf?.length) return buf;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

async function ensureMasterPdfTable(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS master_pdf_exports (
      user_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      html TEXT,
      pdf BYTEA,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, content_hash)
    )
  `;
}

async function persistPendingHtml(userId: string, hash: string, html: string): Promise<void> {
  await ensureMasterPdfTable();
  await sql`
    INSERT INTO master_pdf_exports (user_id, content_hash, html, updated_at)
    VALUES (${userId}, ${hash}, ${html}, NOW())
    ON CONFLICT (user_id, content_hash) DO UPDATE SET
      html = EXCLUDED.html,
      updated_at = NOW()
  `;
}

async function persistMasterPdfBytes(userId: string, hash: string, pdf: Buffer): Promise<void> {
  await ensureMasterPdfTable();
  await sql`
    INSERT INTO master_pdf_exports (user_id, content_hash, pdf, updated_at)
    VALUES (${userId}, ${hash}, ${pdf}, NOW())
    ON CONFLICT (user_id, content_hash) DO UPDATE SET
      pdf = EXCLUDED.pdf,
      updated_at = NOW()
  `;
}

async function loadPdfFromDb(userId: string, hash: string): Promise<Buffer | null> {
  try {
    await ensureMasterPdfTable();
    const [row] = await sql`
      SELECT pdf FROM master_pdf_exports
      WHERE user_id = ${userId} AND content_hash = ${hash} AND pdf IS NOT NULL
      LIMIT 1
    `;
    if (!row?.pdf) return null;
    return Buffer.isBuffer(row.pdf) ? row.pdf : Buffer.from(row.pdf);
  } catch {
    return null;
  }
}

async function pollDbPdf(
  userId: string,
  hash: string,
  attempts = 20,
  intervalMs = 3000
): Promise<Buffer | null> {
  for (let i = 0; i < attempts; i++) {
    const buf = await loadPdfFromDb(userId, hash);
    if (buf?.length) return buf;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

async function loadCachedMasterPdf(userId: string, hash: string): Promise<Buffer | null> {
  const fromDb = await loadPdfFromDb(userId, hash);
  if (fromDb?.length) return fromDb;

  const [row] = await sql`
    SELECT resume_context FROM user_profiles WHERE user_id = ${userId} LIMIT 1
  `;
  const meta = (row?.resume_context as ResumeContext & Record<string, unknown>)?.[
    MASTER_EXPORT_META
  ] as MasterExportMeta | undefined;

  const keys = [
    meta?.content_hash === hash ? meta.pdf_key : null,
    masterPdfKey(userId, hash),
  ].filter(Boolean) as string[];

  for (const key of keys) {
    const buf = await readR2Object(key);
    if (buf?.length) return buf;
  }
  return null;
}

async function persistMasterPdfMeta(
  userId: string,
  hash: string,
  pdfKey: string
): Promise<void> {
  const patch = {
    [MASTER_EXPORT_META]: {
      pdf_key: pdfKey,
      content_hash: hash,
      updated_at: new Date().toISOString(),
    },
  };
  await sql`
    UPDATE user_profiles
    SET resume_context = COALESCE(resume_context, '{}'::jsonb) || ${sql.json(patch)}
    WHERE user_id = ${userId}
  `;
}

function pdfResponse(
  pdf: Buffer,
  safeName: string,
  source: 'render' | 'r2-cache' | 'actions-r2'
): NextResponse {
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}_master_resume.pdf"`,
      'Cache-Control': 'no-store',
      'X-CareerOps-PDF-Source': source,
    },
  });
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
    const hash = contentHash(html);
    const userId = session.user.id;
    const safeName = String(resumeContext.candidate?.full_name || 'resume')
      .replace(/[^\w\- ]+/g, '')
      .replace(/\s+/g, '_');
    const pdfKey = masterPdfKey(userId, hash);
    const htmlKey = masterHtmlKey(userId, hash);

    const cached = await loadCachedMasterPdf(userId, hash);
    if (cached?.length) {
      return pdfResponse(cached, safeName, 'r2-cache');
    }

    // Persist HTML to DB so GitHub Actions can render even when Vercel lacks R2_*.
    await persistPendingHtml(userId, hash, html).catch((e) => {
      console.error('[export-pdf] pending HTML persist failed:', e);
    });

    // Fast path: Chromium on this runtime — does NOT require R2.
    const localPdf = await renderPdfLocal(html);
    if (localPdf?.length) {
      await persistMasterPdfBytes(userId, hash, localPdf).catch(() => {});
      await uploadToR2({ key: pdfKey, body: localPdf, contentType: 'application/pdf' }).catch(() => false);
      await persistMasterPdfMeta(userId, hash, pdfKey).catch(() => {});
      return pdfResponse(localPdf, safeName, 'render');
    }

    // Optional: stage HTML on R2 when credentials exist (Actions also reads DB).
    const htmlUploaded = await uploadToR2({
      key: htmlKey,
      body: Buffer.from(html, 'utf8'),
      contentType: 'text/html; charset=utf-8',
    });

    // Reliable path: GitHub Actions + Playwright (R2 on Actions secrets, HTML from DB fallback).
    const dispatched = await dispatchMasterPdfAction(userId, hash);
    if (!dispatched.ok) {
      return NextResponse.json(
        {
          error:
            dispatched.error
            || (!htmlUploaded
              ? 'PDF engine failed on server and GitHub Actions is not configured (GITHUB_PAT). Add R2_* on Vercel for caching, or set GITHUB_PAT for Actions PDF.'
              : 'GitHub Actions dispatch failed'),
        },
        { status: 503 }
      );
    }

    const fromActions =
      (await pollR2Pdf(pdfKey, 20, 3000))
      || (await pollDbPdf(userId, hash, 10, 3000));
    if (fromActions?.length) {
      await persistMasterPdfMeta(userId, hash, pdfKey).catch(() => {});
      return pdfResponse(fromActions, safeName, 'actions-r2');
    }

    return NextResponse.json(
      {
        error:
          'PDF is still generating via GitHub Actions. Wait ~30–60s and click PDF again. Tip: add the same R2_* env vars on Vercel as GitHub Actions for faster cache hits.',
        pending: true,
        hash,
      },
      { status: 202 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
