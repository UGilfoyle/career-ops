import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { generateResumeDocx } from '@/lib/resume/export-docx';
import type { ResumeContext } from '@/lib/resume/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
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

    const [job] = (await sql`
      SELECT id, company, title, jd_text
      FROM jobs
      WHERE id = ${jobId} AND user_id = ${session.user.id}
      LIMIT 1
    `) as { id: number; company: string; title: string; jd_text?: string }[];

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const [profile] = (await sql`
      SELECT resume_context FROM user_profiles WHERE user_id = ${session.user.id} LIMIT 1
    `) as { resume_context: ResumeContext }[];

    if (!profile?.resume_context) {
      return NextResponse.json({ error: 'No resume context found for user' }, { status: 400 });
    }

    const resumeContext = profile.resume_context;
    const docxBuffer = await generateResumeDocx(resumeContext, {
      templateId: resumeContext.studio?.template_id || 'ats-professional',
      jdText: job.jd_text || '',
    });

    const safeCompany = (job.company || 'Job').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    const safeTitle = (job.title || 'Resume').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    const filename = `${safeCompany}_${safeTitle}_Resume.docx`;

    return new NextResponse(docxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    console.error('[job/resume-docx GET]', error);
    return NextResponse.json({ error: 'Failed to generate tailored resume DOCX' }, { status: 500 });
  }
}
