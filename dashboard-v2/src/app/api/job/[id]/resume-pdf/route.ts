import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { uploadToR2 } from '@/lib/r2-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Store a rendered resume PDF on the job so Generated Docs can download it. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;
    const jobId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(jobId)) {
      return NextResponse.json({ error: 'Invalid job id' }, { status: 400 });
    }

    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length < 64 || bytes.subarray(0, 5).toString('utf8') !== '%PDF-') {
      return NextResponse.json({ error: 'Expected a PDF body' }, { status: 400 });
    }

    const userId = session.user.id;
    const key = `users/${userId}/jobs/${jobId}/${Date.now()}-resume.pdf`;
    const uploaded = await uploadToR2({
      key,
      body: bytes,
      contentType: 'application/pdf',
    });

    const [updated] = await sql`
      UPDATE jobs
      SET
        resume_pdf_key = ${uploaded ? key : null},
        resume_pdf = ${uploaded ? null : bytes},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${jobId} AND user_id = ${userId}
      RETURNING id
    `;

    if (!updated) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      id: updated.id,
      has_resume_pdf: true,
      stored: uploaded ? 'r2' : 'db',
    });
  } catch (error: unknown) {
    console.error('[job/resume-pdf POST]', error);
    return NextResponse.json({ error: 'Failed to store resume PDF' }, { status: 500 });
  }
}
