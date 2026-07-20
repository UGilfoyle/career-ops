'use client';

import { useMemo } from 'react';
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
  onClose?: () => void;
};

export function JobReviewLite({
  draft,
  jobId,
  company,
  title,
  pipelineScore,
  atsContentScore,
  onClose,
}: JobReviewLiteProps) {
  const masterHtml = useMemo(() => fillAtsTemplate(draft), [draft]);
  const tailoredUrl = `/api/view/${jobId}`;

  return (
    <div className="rounded-2xl border border-[#E5E5E0] bg-white overflow-hidden flex flex-col min-h-[420px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E0] px-4 py-3 bg-[#FAFAF8]">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
            Per-job review
          </div>
          <h4 className="text-sm font-bold text-[#1C1C1E] truncate">
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

      <div className="grid grid-cols-1 md:grid-cols-2 min-h-0 flex-1 divide-y md:divide-y-0 md:divide-x divide-[#E5E5E0]">
        <div className="flex flex-col min-h-[280px]">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] border-b border-[#F5F5F0]">
            Master ({draft.studio?.template_id || 'ats-professional'})
          </div>
          <iframe title="Master preview" srcDoc={masterHtml} className="flex-1 w-full border-0 bg-white" sandbox="" />
        </div>
        <div className="flex flex-col min-h-[280px]">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] border-b border-[#F5F5F0]">
            Tailored output
          </div>
          <iframe title="Tailored resume" src={tailoredUrl} className="flex-1 w-full border-0 bg-white" />
        </div>
      </div>
    </div>
  );
}
