'use client';

import { useMemo } from 'react';
import { Download, FileCheck2 } from 'lucide-react';
import { fillAtsTemplate } from '@/lib/resume/fill-template';
import type { ResumeContext } from '@/lib/resume/types';
import { AiScoreBadge } from '../PageSectionHeader';

type JobReviewLiteProps = {
  draft: ResumeContext;
  jobId: number;
  company?: string;
  title?: string;
  pipelineScore?: string | number | null;
  atsContentScore?: number | null;
  hasResumeHtml?: boolean;
  hasResumePdf?: boolean;
  onClose?: () => void;
};

function tailoredPreviewUrl(jobId: number, hasHtml?: boolean, hasPdf?: boolean): string | null {
  if (hasHtml) return `/api/view/${jobId}`;
  if (hasPdf) return `/api/view/${jobId}?format=pdf`;
  return null;
}

function tailoredDownloadUrl(jobId: number, hasPdf?: boolean): string | null {
  if (hasPdf) return `/api/view/${jobId}?format=pdf&download=1`;
  return null;
}

export function JobReviewLite({
  draft,
  jobId,
  company,
  title,
  pipelineScore,
  atsContentScore,
  hasResumeHtml,
  hasResumePdf,
  onClose,
}: JobReviewLiteProps) {
  const masterHtml = useMemo(() => fillAtsTemplate(draft), [draft]);
  const tailoredUrl = tailoredPreviewUrl(jobId, hasResumeHtml, hasResumePdf);
  const pdfUrl = tailoredDownloadUrl(jobId, hasResumePdf);
  const hasSavedDoc = Boolean(hasResumeHtml || hasResumePdf);

  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E0] bg-[#FAFAF8] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
            Per-job review
          </div>
          <h4 className="truncate text-sm font-bold text-[#1C1C1E]">
            {company || 'Company'} — {title || 'Role'}
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <AiScoreBadge score={pipelineScore} />
          {atsContentScore != null ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-800">
              ATS {atsContentScore}/100
            </span>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] hover:text-[#1C1C1E]"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      {hasSavedDoc ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-900">
            <FileCheck2 size={14} />
            Saved tailored resume — loaded from storage (no re-tailor needed)
          </div>
          {pdfUrl ? (
            <a
              href={pdfUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-900 hover:bg-emerald-100"
            >
              <Download size={12} />
              PDF
            </a>
          ) : null}
        </div>
      ) : (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          No saved document yet — run tailor once for this job.
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-[#E5E5E0] md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="flex min-h-[240px] flex-col sm:min-h-[280px]">
          <div className="border-b border-[#F5F5F0] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
            Master ({draft.studio?.template_id || 'ats-professional'})
          </div>
          <iframe title="Master preview" srcDoc={masterHtml} className="w-full flex-1 border-0 bg-white" sandbox="" />
        </div>
        <div className="flex min-h-[240px] flex-col sm:min-h-[280px]">
          <div className="border-b border-[#F5F5F0] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
            Tailored output (saved)
          </div>
          {tailoredUrl ? (
            <iframe title="Tailored resume" src={tailoredUrl} className="w-full flex-1 border-0 bg-white" />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-[#6B6B6B]">
              Document not found in storage. Run tailor once from Terminal or JD Matcher.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
