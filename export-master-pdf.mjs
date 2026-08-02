#!/usr/bin/env node
/**
 * export-master-pdf.mjs — Generate master resume PDF via Playwright (GitHub Actions).
 *
 * Prefers HTML from R2; falls back to master_pdf_exports.html in Neon
 * (so Vercel does not need R2_* to queue an export).
 *
 * Writes PDF to R2 when configured, and always to master_pdf_exports.pdf.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hashArg = (process.argv[2] || process.env.ACTION_ARGS || '').trim().split(/\s+/)[0];
const userId = String(process.env.SCAN_USER_ID || '').trim();

if (!userId || !hashArg || !/^[a-f0-9]{16,64}$/i.test(hashArg)) {
  console.error('Usage: SCAN_USER_ID=<id> node export-master-pdf.mjs <contentHash>');
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
    forcePathStyle: process.env.R2_FORCE_PATH_STYLE === '1',
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function readR2(key) {
  const bucket = process.env.R2_BUCKET || '';
  const client = getR2Client();
  if (!bucket || !client) return null;
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await out.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (e) {
    console.warn(`[master-pdf] R2 read miss ${key}:`, e?.name || e?.message);
    return null;
  }
}

async function putR2(key, body, contentType) {
  const bucket = process.env.R2_BUCKET || '';
  const client = getR2Client();
  if (!bucket || !client) {
    console.warn('[master-pdf] R2 not configured — skipping upload');
    return false;
  }
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
    console.error(`[master-pdf] R2 upload failed:`, e?.name || e?.message);
    return false;
  }
}

async function ensureTable() {
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

async function loadHtmlFromDb() {
  await ensureTable();
  const [row] = await sql`
    SELECT html FROM master_pdf_exports
    WHERE user_id = ${userId} AND content_hash = ${hashArg} AND html IS NOT NULL
    LIMIT 1
  `;
  return row?.html ? Buffer.from(String(row.html), 'utf8') : null;
}

async function main() {
  const htmlKey = `users/${userId}/master-resume/${hashArg}.html`;
  const pdfKey = `users/${userId}/master-resume/${hashArg}.pdf`;
  console.log(`[master-pdf] user=${userId} hash=${hashArg}`);

  let htmlBuf = await readR2(htmlKey);
  if (!htmlBuf?.length) {
    console.log('[master-pdf] R2 HTML miss — loading from Neon master_pdf_exports');
    htmlBuf = await loadHtmlFromDb();
  }
  if (!htmlBuf?.length) {
    throw new Error('No HTML found in R2 or database for this export');
  }

  const workDir = path.join(__dirname, 'output', 'master-pdf');
  fs.mkdirSync(workDir, { recursive: true });
  const htmlPath = path.join(workDir, `${hashArg}.html`);
  const pdfPath = path.join(workDir, `${hashArg}.pdf`);
  fs.writeFileSync(htmlPath, htmlBuf);

  const generatePdf = path.join(__dirname, 'generate-pdf.mjs');
  if (!fs.existsSync(generatePdf)) {
    throw new Error('generate-pdf.mjs not found');
  }

  console.log('[master-pdf] rendering with Playwright...');
  execFileSync(process.execPath, [generatePdf, htmlPath, pdfPath, '--format=a4'], {
    stdio: 'inherit',
    timeout: 120000,
  });

  const pdfBuf = fs.readFileSync(pdfPath);
  if (!pdfBuf.length) throw new Error('Empty PDF output');

  await ensureTable();
  await sql`
    INSERT INTO master_pdf_exports (user_id, content_hash, pdf, updated_at)
    VALUES (${userId}, ${hashArg}, ${pdfBuf}, NOW())
    ON CONFLICT (user_id, content_hash) DO UPDATE SET
      pdf = EXCLUDED.pdf,
      updated_at = NOW()
  `;
  console.log('[master-pdf] PDF saved to Neon');

  const uploaded = await putR2(pdfKey, pdfBuf, 'application/pdf');
  console.log(uploaded ? `[master-pdf] uploaded ${pdfKey}` : '[master-pdf] R2 upload skipped/failed');

  const patch = {
    _master_export: {
      pdf_key: pdfKey,
      content_hash: hashArg,
      updated_at: new Date().toISOString(),
    },
  };
  await sql`
    UPDATE user_profiles
    SET resume_context = COALESCE(resume_context, '{}'::jsonb) || ${sql.json(patch)}
    WHERE user_id = ${userId}
  `;
  console.log('[master-pdf] done');

  try {
    fs.unlinkSync(htmlPath);
    fs.unlinkSync(pdfPath);
  } catch {
    /* ignore */
  }
}

main()
  .catch((e) => {
    console.error('[master-pdf] failed:', e?.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await sql.end().catch(() => {});
  });
