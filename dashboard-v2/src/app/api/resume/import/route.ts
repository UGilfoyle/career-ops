import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseResumeText } from '@/lib/resume/parse-resume-text';
import { assertProAccess } from '@/lib/billing/entitlements';
import { countryFromRequest } from '@/lib/billing/geo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

async function extractPdfText(bytes: Buffer): Promise<string> {
  const { extractText } = await import('unpdf');
  const uint8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result = await extractText(uint8);
  return Array.isArray(result?.text) ? result.text.join('\n') : '';
}

export async function POST(req: NextRequest) {
  let step = 'auth';
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const proBlock = await assertProAccess(
      session.user.id,
      session.user.email,
      countryFromRequest(req),
      session.user.githubLogin,
    );
    if (proBlock) return proBlock;

    step = 'formData';
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    step = 'readFile';
    const name = file.name || 'resume';
    const lower = name.toLowerCase();
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB` },
        { status: 413 }
      );
    }

    step = 'parse';
    let text = '';
    if (lower.endsWith('.pdf')) {
      text = await extractPdfText(bytes);
    } else if (lower.endsWith('.docx')) {
      const mammothMod: any = await import('mammoth');
      const mammoth: any = mammothMod?.default || mammothMod;
      const result = await mammoth.extractRawText({ buffer: bytes });
      text = result.value || '';
    } else {
      return NextResponse.json({ error: 'Unsupported file type (use PDF or DOCX)' }, { status: 400 });
    }

    step = 'postProcess';
    const parsed = parseResumeText(text);
    const { experience, education, candidate, raw_text_preview } = parsed;

    return NextResponse.json(
      {
        ok: true,
        experience,
        education,
        candidate,
        raw_text_preview,
        extracted: {
          experience,
          education,
          candidate,
          raw_text_preview,
        },
      },
      {
        headers: {
          'X-CareerOps-ResumeImport-Version': 'v5-name-twoline-exp',
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        error: `Resume import failed at step="${step}": ${e?.message || 'unknown error'}`,
      },
      { status: 500 }
    );
  }
}
