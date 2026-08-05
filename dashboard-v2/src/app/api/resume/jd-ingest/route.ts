import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { assertProAccess } from '@/lib/billing/entitlements';
import { countryFromRequest } from '@/lib/billing/geo';
import { extractDocumentText, inferTitleFromJd } from '@/lib/resume/extract-document-text';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIN_JD_LEN = 40;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const proBlock = await assertProAccess(
      userId,
      session.user.email,
      countryFromRequest(req),
      session.user.githubLogin,
    );
    if (proBlock) return proBlock;

    const contentType = req.headers.get('content-type') || '';
    let jdText = '';
    let company = '';
    let title = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      company = String(form.get('company') || '').trim();
      title = String(form.get('title') || '').trim();
      if (file instanceof File) {
        const bytes = Buffer.from(await file.arrayBuffer());
        jdText = await extractDocumentText(bytes, file.name || 'jd.txt');
      } else {
        jdText = String(form.get('jdText') || form.get('jd_text') || '').trim();
      }
    } else {
      const body = await req.json().catch(() => ({}));
      jdText = String(body.jdText || body.jd_text || '').trim();
      company = String(body.company || '').trim();
      title = String(body.title || '').trim();
    }

    if (!jdText || jdText.length < MIN_JD_LEN) {
      return NextResponse.json(
        {
          error: `Paste or upload a job description (at least ${MIN_JD_LEN} characters).`,
          hasJd: false,
        },
        { status: 400 },
      );
    }

    const resolvedCompany = company || 'Custom JD';
    const resolvedTitle = title || inferTitleFromJd(jdText);
    const manualUrl = `manual:jd:${userId}:${randomUUID()}`;

    const rows = await sql`
      INSERT INTO jobs (url, canonical_url, company, title, source, user_id, jd_text)
      VALUES (
        ${manualUrl},
        ${manualUrl},
        ${resolvedCompany},
        ${resolvedTitle},
        'manual-jd',
        ${userId},
        ${jdText}
      )
      RETURNING id, company, title
    `;

    const job = rows[0];
    if (!job?.id) {
      return NextResponse.json({ error: 'Failed to save JD' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      hasJd: true,
      jobId: Number(job.id),
      company: job.company,
      title: job.title,
      jdTextLength: jdText.length,
      jdText,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'JD ingest failed';
    console.error('jd-ingest error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
