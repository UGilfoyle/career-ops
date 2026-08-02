'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { estimateMasterAtsScore, fillAtsTemplate } from '@/lib/resume/fill-template';
import { getTemplateMeta } from '@/lib/resume/ats-professional-template';
import type { ResumeContext } from '@/lib/resume/types';

const PAGE_WIDTH_PX = 794; // ~210mm at 96dpi

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(PAGE_WIDTH_PX);
  const deferredDraft = useDeferredValue(draft);
  const html = useMemo(() => fillAtsTemplate(deferredDraft), [deferredDraft]);
  const syncing = deferredDraft !== draft;

  const structureScore = useMemo(() => estimateMasterAtsScore(draft), [draft]);
  const atsScore = externalAtsScore != null ? externalAtsScore : structureScore;
  const atsLabel = externalAtsSource === 'jd' ? 'JD ATS' : 'Profile';
  const missingName = !String(draft.candidate?.full_name || '').trim();
  const templateMeta = getTemplateMeta(draft.studio?.template_id);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? PAGE_WIDTH_PX;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitScale = Math.min(1, Math.max(0.35, (containerWidth - 32) / PAGE_WIDTH_PX));
  const effectiveScale = Math.min(zoom / 100, fitScale);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="text-sm font-bold text-[#1C1C1E]">Live Preview</span>
          <button
            type="button"
            onClick={onOpenTemplates}
            className="max-w-[140px] truncate rounded-full border border-[#E5E5E0] bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] hover:border-[#1C1C1E]/40 hover:text-[#1C1C1E] sm:max-w-none"
          >
            {templateMeta.name}
          </button>
          {syncing ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Syncing…</span>
          ) : (
            <span className="hidden text-[10px] font-bold uppercase tracking-widest text-emerald-700 sm:inline">Synced</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span
            className="rounded-full bg-[#1C1C1E] px-2 py-0.5 font-mono text-[9px] text-white sm:px-2.5 sm:py-1 sm:text-[10px]"
            title={externalAtsSource === 'jd' ? 'Honest JD keyword coverage' : 'Profile completeness estimate'}
          >
            {atsLabel} ~{atsScore}/100
          </span>
          <div className="hidden sm:flex sm:items-center sm:gap-2">
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
      </div>

      {missingName ? (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 sm:px-4">
          Add your full name in Personal Info — preview is showing the placeholder “Your Name”.
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex flex-1 min-h-0 items-start justify-center overflow-auto bg-[#D6D3D1] px-2 py-4 sm:px-6 sm:py-8"
      >
        <div
          className="relative origin-top transition-transform"
          style={{
            width: `${PAGE_WIDTH_PX}px`,
            transform: `scale(${effectiveScale})`,
            transformOrigin: 'top center',
            marginBottom: effectiveScale < 1 ? `${(1 - effectiveScale) * 420}px` : undefined,
          }}
        >
          <div
            className="overflow-hidden bg-white"
            style={{
              width: `${PAGE_WIDTH_PX}px`,
              minHeight: '1123px',
              boxShadow:
                '0 1px 2px rgba(28,28,30,0.06), 0 12px 40px rgba(28,28,30,0.12), 0 0 0 1px rgba(28,28,30,0.06)',
            }}
          >
            <iframe
              title="Resume preview"
              srcDoc={html}
              className="block w-full border-0 bg-white"
              style={{ width: `${PAGE_WIDTH_PX}px`, height: '1123px', minHeight: '1123px' }}
              sandbox=""
            />
          </div>
        </div>
      </div>
    </div>
  );
}
