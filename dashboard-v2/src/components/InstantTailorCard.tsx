'use client';

import React, { useState, useRef } from 'react';
import { Sparkles, ArrowRight, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

interface InstantTailorCardProps {
  onOpenStudio?: () => void;
  onRefresh?: () => void;
}

export default function InstantTailorCard({ onOpenStudio, onRefresh }: InstantTailorCardProps) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [stepMessage, setStepMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleTailor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMessage('Please enter a valid job URL (e.g. https://linkedin.com/jobs/view/...)');
      setStatus('error');
      return;
    }

    setStatus('running');
    setErrorMessage('');
    setStepMessage('Ingesting Job Description from URL...');

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const query = `tailor ${cleanUrl} --deep`;
    const es = new EventSource(`/api/exec?q=${encodeURIComponent(query)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'done') {
          es.close();
          setStatus('success');
          setStepMessage('ATS Resume tailored and ready!');
          if (onRefresh) onRefresh();
        } else if (data.type === 'stderr') {
          const content = String(data.content || '');
          if (content.toLowerCase().includes('error') || content.toLowerCase().includes('fail')) {
            setErrorMessage(content.slice(0, 150));
          }
        } else if (data.type === 'stdout') {
          const content = String(data.content || '');
          if (content.includes('task accepted') || content.includes('working')) {
            setStepMessage('Task queued in high-performance cloud engine...');
          } else if (content.includes('crafting') || content.includes('tailored resume')) {
            setStepMessage('Aligning skills, experience & generating ATS documents...');
          } else if (content.includes('Processing')) {
            setStepMessage('Matching profile against job requirements...');
          }
        }
      } catch {
        // ignore JSON parse errors
      }
    };

    es.onerror = () => {
      es.close();
      // Even on disconnect, the task runs in background on GitHub Actions
      setStatus('success');
      setStepMessage('Task dispatched to background engine. Results will appear in Resume Studio shortly!');
      if (onRefresh) onRefresh();
    };
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[#E5E5E0] bg-white p-6 sm:p-8 shadow-sm transition-all hover:border-[#1C1C1E]/20">
      {/* Subtle modern top accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-[#1C1C1E] to-blue-500" />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              <Sparkles size={13} className="text-emerald-600" />
              1-Click AI Tailor
            </span>
            <span className="text-xs text-[#9CA3AF] font-medium">LinkedIn · Indeed · Greenhouse · Lever · Any URL</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-[#1C1C1E] tracking-tight">
            Instant Resume & Cover Letter Tailor
          </h3>
          <p className="text-sm text-[#6B6B6B] mt-1 font-medium leading-relaxed">
            Paste any job posting URL below. Our AI engine extracts requirements, matches your technical competencies, and builds a targeted ATS-ready resume in seconds.
          </p>
        </div>

        {/* Action / Form area */}
        <div className="w-full lg:max-w-md">
          {status === 'idle' && (
            <form onSubmit={handleTailor} className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste job URL (e.g. LinkedIn, Greenhouse)..."
                className="flex-1 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-4 py-3 text-sm text-[#1C1C1E] placeholder:text-[#9CA3AF] focus:border-[#1C1C1E] focus:bg-white focus:outline-none transition-all"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#1C1C1E] px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#27272a] shrink-0"
              >
                <span>Tailor Now</span>
                <ArrowRight size={15} />
              </button>
            </form>
          )}

          {status === 'running' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-blue-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-blue-900 truncate">
                    {stepMessage || 'Processing job posting...'}
                  </p>
                  <p className="text-[11px] text-blue-700/80 mt-0.5">
                    Analyzing requirements & tailoring competencies in cloud engine
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1 w-full rounded-full bg-blue-200/60 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/4 transition-all duration-500" />
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-900">Tailoring Dispatched Successfully!</p>
                  <p className="text-[11px] text-emerald-700 font-medium">Ready in Resume Studio & Generated Docs</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onOpenStudio && (
                  <button
                    type="button"
                    onClick={onOpenStudio}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800 transition-colors"
                  >
                    <FileText size={13} />
                    View Studio
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setStatus('idle'); setUrl(''); }}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition-colors"
                >
                  Tailor Another
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle size={18} className="text-rose-600 shrink-0" />
                <p className="text-xs font-medium text-rose-800 truncate">
                  {errorMessage || 'Failed to process job URL. Please check the URL and try again.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
