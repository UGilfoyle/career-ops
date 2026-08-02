import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  const endpoint =
    process.env.R2_ENDPOINT?.trim()
    || `https://${accountId}.r2.cloudflarestorage.com`;
  const forcePathStyle = process.env.R2_FORCE_PATH_STYLE === '1';
  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function streamR2Object(key: string): Promise<ReadableStream | null> {
  const bucket = process.env.R2_BUCKET || '';
  const client = getR2Client();
  if (!bucket || !client) return null;

  let out: Awaited<ReturnType<S3Client['send']>>;
  try {
    out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    throw new Error(err?.name || err?.message || 'R2GetObjectFailed');
  }

  const body = (out as { Body?: unknown }).Body;
  if (!body) return null;

  const nodeStream = body instanceof Readable ? body : Readable.fromWeb(body as ReadableStream);
  return Readable.toWeb(nodeStream) as unknown as ReadableStream;
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
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    console.error(`[R2] Upload failed for ${key}:`, err?.name || err?.message);
    return false;
  }
}

export async function readR2Object(key: string): Promise<Buffer | null> {
  const bucket = process.env.R2_BUCKET || '';
  const client = getR2Client();
  if (!bucket || !client) return null;

  try {
    const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = (out as { Body?: { transformToByteArray?: () => Promise<Uint8Array> } }).Body;
    if (!body?.transformToByteArray) return null;
    return Buffer.from(await body.transformToByteArray());
  } catch {
    return null;
  }
}
