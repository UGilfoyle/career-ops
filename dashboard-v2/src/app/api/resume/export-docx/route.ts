import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { generateResumeDocx } from '@/lib/resume/export-docx';
import type { ResumeContext } from '@/lib/resume/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json().catch(() => ({}));
    let ctx: ResumeContext = body.resume_context;

    if (!ctx && session?.user?.id) {
      const rows = (await sql`
        SELECT resume_context FROM user_profiles WHERE user_id = ${session.user.id} LIMIT 1
      `) as { resume_context: ResumeContext }[];
      if (rows?.[0]?.resume_context) {
        ctx = rows[0].resume_context;
      }
    }

    if (!ctx) {
      return NextResponse.json({ error: 'No resume context found to export' }, { status: 400 });
    }

    const templateId = body.template_id || ctx.studio?.template_id || 'ats-professional';
    const jdText = body.jdText || '';

    const docxBuffer = await generateResumeDocx(ctx, { templateId, jdText });

    const candidateName = (ctx.candidate?.full_name || 'Resume')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    const filename = `${candidateName}_Resume.docx`;

    return new NextResponse(docxBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[export-docx POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate DOCX' },
      { status: 500 }
    );
  }
}
