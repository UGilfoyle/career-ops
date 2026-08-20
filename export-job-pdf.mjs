#!/usr/bin/env node
/**
 * export-job-pdf.mjs — Render tailored job resume/cover HTML → PDF (GitHub Actions).
 *
 * Usage:
 *   SCAN_USER_ID=<id> node export-job-pdf.mjs <jobId> [resume|cl|both]
 *
 * Reads HTML from Neon jobs table, renders with Playwright (generate-pdf.mjs),
 * writes BYTEA + optional R2 keys back onto the job row.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rawArgs = (process.argv[2] || process.env.ACTION_ARGS || '').trim().split(/\s+/).filter(Boolean);
const jobId = rawArgs[0];
const which = (rawArgs[1] || 'both').toLowerCase();
const userId = String(process.env.SCAN_USER_ID || '').trim();

if (!userId || !jobId || !/^\d+$/.test(jobId)) {
  console.error('Usage: SCAN_USER_ID=<id> node export-job-pdf.mjs <jobId> [resume|cl|both]');
  process.exit(1);
}

const cleanDbUrl = (process.env.DATABASE_URL || '')
  .replace('&channel_binding=require', '')
  .replace('?channel_binding=require&', '?')
  .replace('?channel_binding=require', '');

const sql = postgres(cleanDbUrl, {
  ssl: 'require',
  max: 2,
  idle_timeout: 10,
  connect_timeout: 20,
});

function r2ForcePathStyle() {
  const forceFlag = String(process.env.R2_FORCE_PATH_STYLE || '').trim();
  return forceFlag === '' || forceFlag === '1' || forceFlag.toLowerCase() === 'true';
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  const endpoint =
    process.env.R2_ENDPOINT?.trim()
    || `https://${accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: r2ForcePathStyle(),
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function putR2(key, body, contentType) {
  const bucket = process.env.R2_BUCKET || '';
  const client = getR2Client();
  if (!bucket || !client) return false;
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return true;
  } catch (e) {
    console.error(`[job-pdf] R2 upload failed:`, e?.name || e?.message);
    return false;
  }
}

function renderHtmlToPdf(html, outBase) {
  const workDir = path.join(__dirname, 'output', 'job-pdf');
  fs.mkdirSync(workDir, { recursive: true });
  const htmlPath = path.join(workDir, `${outBase}.html`);
  const pdfPath = path.join(workDir, `${outBase}.pdf`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  const generatePdf = path.join(__dirname, 'generate-pdf.mjs');
  if (!fs.existsSync(generatePdf)) {
    throw new Error('generate-pdf.mjs not found');
  }

  execFileSync(process.execPath, [generatePdf, htmlPath, pdfPath, '--format=a4'], {
    stdio: 'inherit',
    timeout: 120000,
  });

  const pdfBuf = fs.readFileSync(pdfPath);
  if (!pdfBuf.length) throw new Error('Empty PDF output');

  try {
    fs.unlinkSync(htmlPath);
    fs.unlinkSync(pdfPath);
  } catch {
    /* ignore */
  }
  return pdfBuf;
}

async function main() {
  console.log(`[job-pdf] user=${userId} job=${jobId} which=${which}`);

  const [job] = await sql`
    SELECT id, company, title, resume_html, cover_letter_html
    FROM jobs
    WHERE id = ${Number(jobId)} AND user_id = ${userId}
    LIMIT 1
  `;

  if (!job) {
    throw new Error(`Job ${jobId} not found for user ${userId}`);
  }

  const doResume = which === 'resume' || which === 'both' || which === 'all';
  const doCover = which === 'cl' || which === 'cover' || which === 'both' || which === 'all';
  const ts = Date.now();
  const baseKey = `users/${userId}/jobs/${jobId}/${ts}`;

  let resumeKey = null;
  let coverKey = null;

  if (doResume) {
    if (!job.resume_html) {
      console.warn('[job-pdf] No resume_html — skipping resume');
    } else {
      console.log('[job-pdf] rendering resume…');
      const pdfBuf = renderHtmlToPdf(String(job.resume_html), `${jobId}-resume`);
      resumeKey = `${baseKey}-resume.pdf`;
      const uploaded = await putR2(resumeKey, pdfBuf, 'application/pdf');
      await sql`
        UPDATE jobs
        SET resume_pdf = ${pdfBuf},
            resume_pdf_key = COALESCE(${uploaded ? resumeKey : null}, resume_pdf_key)
        WHERE id = ${Number(jobId)} AND user_id = ${userId}
      `;
      console.log(`[job-pdf] resume saved (r2=${uploaded ? resumeKey : 'skip'})`);
    }
  }

  if (doCover) {
    if (!job.cover_letter_html) {
      console.warn('[job-pdf] No cover_letter_html — skipping cover');
    } else {
      console.log('[job-pdf] rendering cover letter…');
      const pdfBuf = renderHtmlToPdf(String(job.cover_letter_html), `${jobId}-cover`);
      coverKey = `${baseKey}-cover-letter.pdf`;
      const uploaded = await putR2(coverKey, pdfBuf, 'application/pdf');
      await sql`
        UPDATE jobs
        SET cover_letter_pdf = ${pdfBuf},
            cover_letter_pdf_key = COALESCE(${uploaded ? coverKey : null}, cover_letter_pdf_key)
        WHERE id = ${Number(jobId)} AND user_id = ${userId}
      `;
      console.log(`[job-pdf] cover saved (r2=${uploaded ? coverKey : 'skip'})`);
    }
  }

  console.log('[job-pdf] done');
}

main()
  .catch((e) => {
    console.error('[job-pdf] failed:', e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end().catch(() => {});
  });
