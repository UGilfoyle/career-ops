import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

function envTrim(key: string): string {
  return String(process.env[key] || '').trim();
}

/** Path-style is ON for R2 unless R2_FORCE_PATH_STYLE=0. */
export function r2ForcePathStyle(): boolean {
  const forceFlag = envTrim('R2_FORCE_PATH_STYLE');
  return forceFlag === '' || forceFlag === '1' || forceFlag.toLowerCase() === 'true';
}

/**
 * Cloudflare R2 via S3 API.
 * Secrets are trimmed (Vercel/GitHub often store trailing newlines → SignatureDoesNotMatch).
 */
export function getR2Client(): S3Client | null {
  const accountId = envTrim('R2_ACCOUNT_ID');
  const accessKeyId = envTrim('R2_ACCESS_KEY_ID');
  const secretAccessKey = envTrim('R2_SECRET_ACCESS_KEY');
  if (!accountId || !accessKeyId || !secretAccessKey) return null;

  const endpoint =
    envTrim('R2_ENDPOINT')
    || `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: r2ForcePathStyle(),
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function getR2Bucket(): string {
  return envTrim('R2_BUCKET');
}

export function r2ConfigDebug(): Record<string, string | boolean> {
  const accountId = envTrim('R2_ACCOUNT_ID');
  return {
    hasAccountId: Boolean(accountId),
    accountIdPrefix: accountId ? `${accountId.slice(0, 6)}…` : '',
    hasAccessKey: Boolean(envTrim('R2_ACCESS_KEY_ID')),
    hasSecret: Boolean(envTrim('R2_SECRET_ACCESS_KEY')),
    bucket: getR2Bucket() || '(empty)',
    endpoint: envTrim('R2_ENDPOINT') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '(none)'),
    forcePathStyle: r2ForcePathStyle(),
  };
}

export async function streamR2Object(key: string): Promise<ReadableStream | null> {
  const bucket = getR2Bucket();
  const client = getR2Client();
  if (!bucket || !client) return null;

  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = out.Body as Readable | { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body) return null;

    if (body instanceof Readable) {
      return Readable.toWeb(body) as unknown as ReadableStream;
    }
    if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === 'function') {
      const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
      return new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
    }
    return null;
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    throw new Error(err?.name || err?.message || 'R2GetObjectFailed');
  }
}

export async function uploadToR2({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<boolean> {
  const bucket = getR2Bucket();
  const client = getR2Client();
  if (!bucket || !client) {
    console.warn('[R2] Skip upload — missing bucket or credentials', r2ConfigDebug());
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
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    console.error(`[R2] Upload failed for ${key}:`, err?.name || err?.message, r2ConfigDebug());
    return false;
  }
}

export async function readR2Object(key: string): Promise<Buffer | null> {
  const bucket = getR2Bucket();
  const client = getR2Client();
  if (!bucket || !client) return null;

  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = out.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body?.transformToByteArray) return null;
    return Buffer.from(await body.transformToByteArray());
  } catch {
    return null;
  }
}
