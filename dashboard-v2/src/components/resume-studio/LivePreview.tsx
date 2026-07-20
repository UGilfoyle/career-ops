'use client';

import { useEffect, useMemo, useState } from 'react';
import { estimateMasterAtsScore, fillAtsTemplate } from '@/lib/resume/fill-template';
import type { ResumeContext } from '@/lib/resume/types';

const PREVIEW_DEBOUNCE_MS = 280;

export function LivePreview({
  draft,
  zoom,
  onZoomChange,
}: {
  draft: ResumeContext;
  zoom: number;
  onZoomChange: (z: number) => void;
}) {
  const [html, setHtml] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setSyncing(true);
    const t = setTimeout(() => {
      setHtml(fillAtsTemplate(draft));
      setSyncing(false);
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft]);

  const atsScore = useMemo(() => estimateMasterAtsScore(draft), [draft]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E0] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[#1C1C1E]">Live Preview</span>
          <span className="rounded-full border border-[#E5E5E0] bg-[#F5F5F0] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
            ATS Classic
          </span>
          {syncing ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Syncing…</span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Synced</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#1C1C1E] px-2.5 py-1 font-mono text-[10px] text-white">
            ATS ~{atsScore}/100
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

      <div className="flex-1 min-h-0 overflow-auto bg-[#E8E8E3] p-6 flex justify-center items-start">
        <div
          className="bg-white shadow-lg origin-top transition-transform"
          style={{
            width: '210mm',
            minHeight: '297mm',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          <iframe
            title="Resume preview"
            srcDoc={html}
            className="w-full border-0"
            style={{ height: '297mm', minHeight: '297mm' }}
            sandbox=""
          />
        </div>
      </div>
    </div>
  );
}
