'use client';

import { useDeferredValue, useMemo } from 'react';
import { estimateMasterAtsScore, fillAtsTemplate } from '@/lib/resume/fill-template';
import { getTemplateMeta } from '@/lib/resume/ats-professional-template';
import type { ResumeContext } from '@/lib/resume/types';

export function LivePreview({
  draft,
  zoom,
  onZoomChange,
  onOpenTemplates,
  externalAtsScore,
  externalAtsSource,
}: {
  draft: ResumeContext;
  zoom: number;
  onZoomChange: (z: number) => void;
  onOpenTemplates?: () => void;
  externalAtsScore?: number | null;
  externalAtsSource?: 'jd' | 'structure' | null;
}) {
  const deferredDraft = useDeferredValue(draft);
  const html = useMemo(() => fillAtsTemplate(deferredDraft), [deferredDraft]);
  const syncing = deferredDraft !== draft;

  const structureScore = useMemo(() => estimateMasterAtsScore(draft), [draft]);
  const atsScore = externalAtsScore != null ? externalAtsScore : structureScore;
  const atsLabel = externalAtsSource === 'jd' ? 'JD ATS' : 'Profile';
  const missingName = !String(draft.candidate?.full_name || '').trim();
  const templateMeta = getTemplateMeta(draft.studio?.template_id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E0] bg-[#FAFAF8] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#1C1C1E]">Live Preview</span>
          <button
            type="button"
            onClick={onOpenTemplates}
            className="rounded-full border border-[#E5E5E0] bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] hover:text-[#1C1C1E] hover:border-[#1C1C1E]/40"
          >
            {templateMeta.name}
          </button>
          {syncing ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Syncing…</span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Synced</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full bg-[#1C1C1E] px-2.5 py-1 font-mono text-[10px] text-white"
            title={externalAtsSource === 'jd' ? 'Honest JD keyword coverage' : 'Profile completeness estimate'}
          >
            {atsLabel} ~{atsScore}/100
          </span>
          {[75, 100, 125].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => onZoomChange(z)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors ${
                zoom === z
                  ? 'bg-[#1C1C1E] text-white'
                  : 'border border-[#E5E5E0] bg-white text-[#6B6B6B] hover:text-[#1C1C1E]'
              }`}
            >
              {z}%
            </button>
          ))}
        </div>
      </div>

      {missingName ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
          Add your full name in Personal Info — preview is showing the placeholder “Your Name”.
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto bg-[#D6D3D1] px-6 py-8 flex justify-center items-start">
        <div
          className="relative origin-top transition-transform"
          style={{
            width: '210mm',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            marginBottom: zoom < 100 ? `${(100 - zoom) * 2.2}mm` : undefined,
          }}
        >
          <div
            className="bg-white overflow-hidden"
            style={{
              width: '210mm',
              minHeight: '297mm',
              boxShadow:
                '0 1px 2px rgba(28,28,30,0.06), 0 12px 40px rgba(28,28,30,0.12), 0 0 0 1px rgba(28,28,30,0.06)',
            }}
          >
            <iframe
              title="Resume preview"
              srcDoc={html}
              className="w-full border-0 block bg-white"
              style={{ width: '210mm', height: '297mm', minHeight: '297mm' }}
              sandbox=""
            />
          </div>
        </div>
      </div>
    </div>
  );
}
