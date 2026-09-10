'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Sparkles, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  Copy, 
  Check, 
  Cpu, 
  ExternalLink 
} from 'lucide-react';
import InstantTailorCard from '@/components/InstantTailorCard';

export default function UiverseShowcasePage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'buttons' | 'cards' | 'inputs' | 'loaders'>('all');
  const [inputValue, setInputValue] = useState('');

  const copyCode = (key: string, snippet: string) => {
    navigator.clipboard?.writeText(snippet);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
              <span>Back to Home</span>
            </Link>
            <span className="text-zinc-300">/</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                UIverse Lab
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                branch: feature/uiverse-ui-experiment
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Header Intro */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold tracking-wide">
            <Sparkles size={13} />
            <span>UIverse.io Design System Integration</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
            Interactive UIverse Component Suite
          </h1>
          <p className="text-sm sm:text-base text-zinc-600 max-w-2xl leading-relaxed font-normal">
            Open-source CSS micro-animations, tactile shimmer buttons, glowing cards, and aligned input fields integrated into Career-Ops.
          </p>
        </div>

        {/* Live Working Component: InstantTailorCard */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-emerald-600" />
              <h2 className="text-base font-bold text-zinc-900">
                Live Working Feature: Instant Tailor Card
              </h2>
            </div>
            <span className="text-xs text-zinc-500 font-medium">
              Interactive test with mock trigger
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs">
            <InstantTailorCard 
              onOpenStudio={() => alert('Resume Studio opened')}
              onRefresh={() => alert('Refreshed')}
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
          {(['all', 'buttons', 'cards', 'inputs', 'loaders'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Showcase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Buttons */}
          {(activeTab === 'all' || activeTab === 'buttons') && (
            <div className="uiverse-glow-card flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900">Tactile Shimmer Buttons</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600">.uiverse-btn</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Hardware-accelerated skew light sweep on hover with active depression feedback.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button type="button" className="uiverse-btn">
                    <span>Tailor Job</span>
                    <ArrowRight size={14} />
                  </button>

                  <button 
                    type="button" 
                    className="uiverse-btn"
                    style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    <span>Run Scanner</span>
                    <Zap size={14} />
                  </button>

                  <button 
                    type="button" 
                    className="uiverse-btn"
                    style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    <span>Analyze ATS</span>
                    <Sparkles size={14} />
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 mt-6 flex justify-between items-center text-xs text-zinc-400">
                <span>Hover over buttons to see sweep light</span>
                <button 
                  type="button"
                  onClick={() => copyCode('btn', '<button className="uiverse-btn"><span>Action</span></button>')}
                  className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  {copiedKey === 'btn' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedKey === 'btn' ? 'Copied' : 'Copy class'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Card 2: Input Fields */}
          {(activeTab === 'all' || activeTab === 'inputs') && (
            <div className="uiverse-glow-card flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900">Aligned Input Controls</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600">.uiverse-input</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Fixed 44px touch target height matching buttons, inner inset depth, and soft focus halo.
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Target Company URL
                    </label>
                    <input 
                      type="text" 
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="https://jobs.lever.co/company/role"
                      className="uiverse-input"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 mt-6 flex justify-between items-center text-xs text-zinc-400">
                <span>44px standardized height</span>
                <button 
                  type="button"
                  onClick={() => copyCode('inp', '<input className="uiverse-input" />')}
                  className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  {copiedKey === 'inp' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedKey === 'inp' ? 'Copied' : 'Copy class'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Card 3: Glow & Hover Cards */}
          {(activeTab === 'all' || activeTab === 'cards') && (
            <div className="uiverse-glow-card flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900">Depth Glow Surface</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600">.uiverse-glow-card</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Smooth border transition from zinc-200 to zinc-400 with 30px diffused shadow elevation.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-zinc-400">Match Score</span>
                    <p className="text-lg font-extrabold text-emerald-600">94% ATS</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-zinc-400">GCC Status</span>
                    <p className="text-lg font-extrabold text-blue-600">Verified GDC</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 mt-6 flex justify-between items-center text-xs text-zinc-400">
                <span>Elevation without heavy shadows</span>
                <button 
                  type="button"
                  onClick={() => copyCode('card', '<div className="uiverse-glow-card">...</div>')}
                  className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  {copiedKey === 'card' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedKey === 'card' ? 'Copied' : 'Copy class'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Card 4: Loaders & Indicators */}
          {(activeTab === 'all' || activeTab === 'loaders') && (
            <div className="uiverse-glow-card flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-900">Multi-Dot Engine Loader</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600">.uiverse-dot-loader</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Smooth wave bounce animation with staggered negative delays for processing states.
                </p>

                <div className="p-4 rounded-xl bg-zinc-900 text-white flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-100">Tailoring Resume for ODC</p>
                    <p className="text-[11px] text-zinc-400 font-normal">Extracting competency signals</p>
                  </div>
                  <div className="uiverse-dot-loader">
                    <div className="uiverse-dot" style={{ backgroundColor: '#10b981' }} />
                    <div className="uiverse-dot" style={{ backgroundColor: '#10b981' }} />
                    <div className="uiverse-dot" style={{ backgroundColor: '#10b981' }} />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-100 mt-6 flex justify-between items-center text-xs text-zinc-400">
                <span>Pure CSS keyframe animation</span>
                <button 
                  type="button"
                  onClick={() => copyCode('loader', '<div className="uiverse-dot-loader"><div className="uiverse-dot" />...</div>')}
                  className="inline-flex items-center gap-1 font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  {copiedKey === 'loader' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedKey === 'loader' ? 'Copied' : 'Copy class'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="p-4 rounded-xl bg-zinc-100/70 border border-zinc-200/80 text-xs text-zinc-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>
            Branch: <strong className="font-mono text-zinc-900">feature/uiverse-ui-experiment</strong>. Isolated from main.
          </span>
          <span className="font-medium text-zinc-500">
            Zero external npm runtime overhead
          </span>
        </div>
      </div>
    </div>
  );
}
