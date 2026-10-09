import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { generateResumeDocx } from '@/lib/resume/export-docx';
import { parseTailoredResumeHtml } from '@/lib/resume/parse-tailored-html';
import { emptyResumeContext, type ResumeContext } from '@/lib/resume/types';

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
      SELECT id, company, title, jd_text, resume_html
      FROM jobs
      WHERE id = ${jobId} AND user_id = ${session.user.id}
      LIMIT 1
    `) as { id: number; company: string; title: string; jd_text?: string; resume_html?: string }[];

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const [profile] = (await sql`
      SELECT resume_context FROM user_profiles WHERE user_id = ${session.user.id} LIMIT 1
    `) as { resume_context: ResumeContext }[];

    if (!profile?.resume_context && !job.resume_html) {
      return NextResponse.json({ error: 'No resume context or tailored document found' }, { status: 400 });
    }

    // Preserve 100% of tailored data from the job's resume_html if present, falling back to base profile
    let resumeContext: ResumeContext = profile?.resume_context || emptyResumeContext();
    if (job.resume_html) {
      const parsedTailored = parseTailoredResumeHtml(job.resume_html, profile?.resume_context);
      if (parsedTailored) {
        resumeContext = parsedTailored;
      }
    }

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
