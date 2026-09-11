'use client';

import Link from 'next/link';
import { 
  ArrowLeft, 
  Sparkles, 
  ArrowRight, 
  ExternalLink,
  Target
} from 'lucide-react';
import InstantTailorCard from '@/components/InstantTailorCard';

export default function UiverseShowcasePage() {
  return (
    <div className="min-h-screen bg-[#fafaf9] text-zinc-900 selection:bg-zinc-200">
      {/* Top Banner */}
      <div className="border-b border-zinc-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/"
              className="flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </Link>
            <span className="text-zinc-300">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                UIverse Integration
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a 
              href="https://uiverse.io" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <span>uiverse.io</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header Intro */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold tracking-wide">
            <Sparkles size={13} />
            <span>UIverse Design System Integration</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
            Instant AI Tailor & Design System
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 max-w-2xl leading-relaxed font-normal">
            Pure CSS micro-interactions, tactile shimmer buttons, glowing depth surfaces, and live streaming ATS tailoring.
          </p>
        </div>

        {/* Working Component: InstantTailorCard */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs">
          <InstantTailorCard 
            onOpenStudio={() => { if (typeof window !== 'undefined') window.location.href = '/'; }}
            onRefresh={() => { if (typeof window !== 'undefined') window.location.reload(); }}
          />
        </div>

        {/* GCC Production Feature Card */}
        <div className="uiverse-glow-card flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-emerald-200 bg-gradient-to-r from-emerald-50/50 via-white to-zinc-50">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                Production Feature
              </span>
              <h3 className="text-base font-bold text-zinc-900">
                GCC Campaign Break-in Engine
              </h3>
            </div>
            <p className="text-xs text-zinc-600 font-normal leading-relaxed max-w-xl">
              Natively built with the UIverse design system: 1-click captive MNC discovery, multi-dot wave loader, daily execution targets, and outreach tracking.
            </p>
          </div>

          <Link
            href="/"
            className="uiverse-btn !h-10 !px-5 !text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
          >
            <Target size={14} />
            <span>Go to Dashboard GCC Campaign</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
