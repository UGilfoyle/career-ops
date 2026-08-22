'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { estimateMasterAtsScore, fillAtsTemplate } from '@/lib/resume/fill-template';
import { getTemplateMeta } from '@/lib/resume/ats-professional-template';
import type { ResumeContext } from '@/lib/resume/types';
import { getCompetencies } from '@/lib/resume/types';
import { CompetencyBadgeStack, type CompetencyScore } from './CompetencyBadge';

const PAGE_WIDTH_PX = 794; // ~210mm at 96dpi
const PAGE_HEIGHT_PX = 1123; // ~297mm at 96dpi (one A4 page)

/** Derive section-level competency scores from draft content + ATS score. */
function computeCompetencyScores(draft: ResumeContext, atsScore: number | null): CompetencyScore[] {
  if (atsScore == null) return [];

  const expCount = (draft.experience || []).length;
  const eduCount = (draft.education || []).length;
  const skillCount = getCompetencies(draft).length;
  const hasHeadline = Boolean(draft.narrative?.headline?.trim());

  // Normalized sub-scores derived from profile completeness
  const base = (atsScore ?? 0) / 100;
  const scores: CompetencyScore[] = [];

  if (expCount > 0) {
    const depth = Math.min(10, base * 10 * (0.8 + Math.min(expCount, 4) * 0.05));
    scores.push({ label: 'Technical Depth', score: Math.round(depth * 10) / 10 });
  }

  if (hasHeadline || expCount >= 2) {
    const leadership = Math.min(10, base * 10 * (0.6 + Math.min(expCount, 3) * 0.1));
    scores.push({ label: 'Leadership', score: Math.round(leadership * 10) / 10 });
  }

  if (skillCount > 0) {
    const domain = Math.min(10, base * 10 * (0.7 + Math.min(skillCount, 10) * 0.03));
    scores.push({ label: 'Domain Fit', score: Math.round(domain * 10) / 10 });
  }

  if (eduCount > 0) {
    const academic = Math.min(10, base * 8 * (0.7 + Math.min(eduCount, 2) * 0.15));
    scores.push({ label: 'Academic', score: Math.round(academic * 10) / 10 });
  }

  return scores;
}

export function LivePreview({
  draft,
  zoom,
  onZoomChange,
  onOpenTemplates,
  externalAtsScore,
  externalAtsSource,
  previewMode = 'master',
  onPreviewModeChange,
  tailoredPreviewUrl = null,
  showTailoredToggle = false,
}: {
  draft: ResumeContext;
  zoom: number;
  onZoomChange: (z: number) => void;
  onOpenTemplates?: () => void;
  externalAtsScore?: number | null;
  externalAtsSource?: 'jd' | 'structure' | null;
  previewMode?: 'master' | 'tailored';
  onPreviewModeChange?: (mode: 'master' | 'tailored') => void;
  tailoredPreviewUrl?: string | null;
  showTailoredToggle?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(PAGE_WIDTH_PX);
  const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT_PX);
  const [showBadges, setShowBadges] = useState(true);
  const deferredDraft = useDeferredValue(draft);
  const html = useMemo(() => fillAtsTemplate(deferredDraft), [deferredDraft]);
  const syncing = deferredDraft !== draft;
  const showTailored = previewMode === 'tailored' && Boolean(tailoredPreviewUrl);

  const structureScore = useMemo(() => estimateMasterAtsScore(draft), [draft]);
  const atsScore = externalAtsScore != null ? externalAtsScore : structureScore;
  const atsLabel = externalAtsSource === 'jd' ? 'JD ATS' : 'Profile';
  const missingName = !String(draft.candidate?.full_name || '').trim();
  const templateMeta = getTemplateMeta(draft.studio?.template_id);

  const competencyScores = useMemo(
    () => computeCompetencyScores(draft, atsScore),
    [draft, atsScore],
  );

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

  // Re-measure after HTML changes on frame load
  const handleIframeLoad = () => {
    measureIframe();
  };

  const measureIframe = () => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.body) return;
    const h = Math.max(
      PAGE_HEIGHT_PX,
      Math.ceil(doc.documentElement.scrollHeight || 0),
      Math.ceil(doc.body.scrollHeight || 0),
    );
    setContentHeight(h + 8);
  };

  const fitScale = Math.min(1, Math.max(0.35, (containerWidth - 32) / PAGE_WIDTH_PX));
  const effectiveScale = Math.min(zoom / 100, fitScale);
  const scaledExtra = contentHeight * (1 - effectiveScale);

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
          {showTailoredToggle ? (
            <div className="flex rounded-lg border border-[#E5E5E0] bg-white p-0.5">
              <button
                type="button"
                onClick={() => onPreviewModeChange?.('tailored')}
                className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  showTailored ? 'bg-[#1C1C1E] text-white' : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
                }`}
              >
                Tailored
              </button>
              <button
                type="button"
                onClick={() => onPreviewModeChange?.('master')}
                className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  !showTailored ? 'bg-[#1C1C1E] text-white' : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
                }`}
              >
                Master
              </button>
            </div>
          ) : null}
          {syncing && !showTailored ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Syncing…</span>
          ) : !showTailored ? (
            <span className="hidden text-[10px] font-bold uppercase tracking-widest text-emerald-700 sm:inline">Synced</span>
          ) : (
            <span className="hidden text-[10px] font-bold uppercase tracking-widest text-emerald-700 sm:inline">Saved tailor</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span
            className="rounded-full bg-[#1C1C1E] px-2 py-0.5 font-mono text-[9px] text-white sm:px-2.5 sm:py-1 sm:text-[10px]"
            title={
              externalAtsSource === 'jd'
                ? 'JD keywords present in resume text (target 94%+)'
                : 'Profile completeness estimate'
            }
          >
            {atsLabel} {atsScore}
            {externalAtsSource === 'jd' ? '%' : '/100'}
          </span>
          {competencyScores.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowBadges((v) => !v)}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
                showBadges
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'border border-[#E5E5E0] bg-white text-[#6B6B6B] hover:text-[#1C1C1E]'
              }`}
              title="Toggle competency badges"
            >
              Scores
            </button>
          ) : null}
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
                title={`Preview zoom ${z}%`}
              >
                Zoom {z}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {missingName ? (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 sm:px-4">
          Add your full name in Personal Info — preview is showing the placeholder &quot;Your Name&quot;.
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
            marginBottom: scaledExtra > 0 ? `${scaledExtra}px` : undefined,
          }}
        >
          {/* Competency score badges — floating overlay */}
          <CompetencyBadgeStack scores={competencyScores} visible={showBadges} />

          <div
            className="bg-white"
            style={{
              width: `${PAGE_WIDTH_PX}px`,
              minHeight: `${PAGE_HEIGHT_PX}px`,
              height: `${contentHeight}px`,
              boxShadow:
                '0 1px 2px rgba(28,28,30,0.06), 0 12px 40px rgba(28,28,30,0.12), 0 0 0 1px rgba(28,28,30,0.06)',
            }}
          >
            <iframe
              ref={iframeRef}
              title="Resume preview"
              src={showTailored ? tailoredPreviewUrl || undefined : undefined}
              srcDoc={showTailored ? undefined : html}
              onLoad={measureIframe}
              className="block w-full border-0 bg-white"
              style={{ width: `${PAGE_WIDTH_PX}px`, height: `${contentHeight}px`, minHeight: `${PAGE_HEIGHT_PX}px` }}
              sandbox=""
            />
          </div>
        </div>
      </div>
    </div>
  );
}
