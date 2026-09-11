'use client';

import { 
  ArrowRight, 
  ExternalLink, 
  Target,
  Sparkles
} from 'lucide-react';
import { PageSectionHeader } from './PageSectionHeader';
import InstantTailorCard from './InstantTailorCard';

interface UiverseLabPanelProps {
  onOpenStudio?: () => void;
  onRefresh?: () => void;
  onOpenGcc?: () => void;
}

export function UiverseLabPanel({ onOpenStudio, onRefresh, onOpenGcc }: UiverseLabPanelProps) {
  const headerActions = (
    <div className="flex items-center gap-2">
      <a
        href="/uiverse"
        target="_blank"
        rel="noreferrer"
        className="uiverse-btn !h-9 !px-3 !text-xs !bg-white !text-zinc-900 !border-zinc-300 hover:!bg-zinc-50"
      >
        <span>Open Standalone Tab</span>
        <ExternalLink size={13} />
      </a>
      <a
        href="https://uiverse.io"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-900 px-2 py-1 transition-colors"
      >
        <span>uiverse.io</span>
        <ExternalLink size={12} />
      </a>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageSectionHeader
        title="UIverse Design System"
        subtitle="Tactile micro-interactions, ambient glow surfaces, and instant AI resume tailoring"
        actions={headerActions}
      />

      {/* Instant Tailor Card */}
      <InstantTailorCard
        onOpenStudio={onOpenStudio}
        onRefresh={onRefresh}
      />

      {/* GCC Campaign Feature Card */}
      <div className="uiverse-glow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-emerald-200/70 bg-gradient-to-r from-emerald-50/40 via-white to-zinc-50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Active Feature
            </span>
            <h3 className="text-sm font-bold text-zinc-900">
              GCC Campaign Integration
            </h3>
          </div>
          <p className="text-xs text-zinc-600 font-normal leading-relaxed">
            The full UIverse UX is now natively running in GCC Campaign with 1-click captive scans, live SSE progress, and outreach tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onOpenGcc) {
              onOpenGcc();
            } else {
              const gccNav = document.getElementById('nav-gcc');
              if (gccNav) gccNav.click();
            }
          }}
          className="uiverse-btn !h-9 !px-4 !text-xs shrink-0"
          style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
        >
          <Target size={14} />
          <span>Open GCC Campaign</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
