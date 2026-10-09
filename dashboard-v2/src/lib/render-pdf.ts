import { writeFile, unlink, mkdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { execFile as execFileCb } from 'child_process';
import { randomUUID } from 'crypto';

const execFile = promisify(execFileCb);

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function tryPlaywrightPdf(html: string): Promise<Buffer | null> {
  try {
    const id = randomUUID();
    const dir = join(/* turbopackIgnore: true */ tmpdir(), 'career-ops-pdf');
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
        /* try next candidate */
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

      // Strip empty sections
      await page.evaluate(() => {
        document.querySelectorAll('section').forEach((sec) => {
          const clone = sec.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('h1, h2, h3, h4, .rule, .top-rule, hr').forEach((el) => el.remove());
          const text = clone.textContent?.replace(/\s+/g, ' ').trim();
          if (!text) {
            sec.style.setProperty('display', 'none', 'important');
            sec.remove();
          }
        });
      });

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
    console.warn('[renderHtmlToPdf puppeteer error]', err);
    return null;
  }
}

/**
 * Universal HTML -> PDF renderer.
 * Tries Playwright first (local/node), then Puppeteer / Sparticuz Chromium (serverless).
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer | null> {
  if (!html || html.trim().length === 0) return null;
  const pwPdf = await tryPlaywrightPdf(html);
  if (pwPdf && pwPdf.length > 100) return pwPdf;
  const pupPdf = await tryPuppeteerPdf(html);
  if (pupPdf && pupPdf.length > 100) return pupPdf;
  return null;
}
