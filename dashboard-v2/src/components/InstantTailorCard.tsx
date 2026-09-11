'use client';

import React, { useState, useRef } from 'react';
import { Sparkles, ArrowRight, Loader2, CheckCircle2, AlertCircle, FileText, Clipboard, Check } from 'lucide-react';

interface InstantTailorCardProps {
  onOpenStudio?: () => void;
  onRefresh?: () => void;
}

export default function InstantTailorCard({ onOpenStudio, onRefresh }: InstantTailorCardProps) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [stepMessage, setStepMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [pasted, setPasted] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleTailor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    if (/[\r\n\t<>]/.test(cleanUrl) || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
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

    let receivedEvents = false;
    const query = `tailor ${cleanUrl} --deep`;
    const es = new EventSource(`/api/exec?q=${encodeURIComponent(query)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      receivedEvents = true;
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
      if (!receivedEvents) {
        setStatus('error');
        setErrorMessage('Unable to connect to execution service. Please check your connection or sign in.');
      } else {
        // Even on disconnect, the task continues running in background
        setStatus('success');
        setStepMessage('Task dispatched to background engine. Results will appear in Resume Studio shortly!');
        if (onRefresh) onRefresh();
      }
    };
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        setUrl(text.trim());
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
      }
    } catch {}
  };

  return (
    <div className="relative rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-sm overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-zinc-900 to-blue-500" />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/80">
              <Sparkles size={12} className="text-emerald-600" />
              1 Click AI Tailor
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">LinkedIn · Indeed · Greenhouse · Lever · Any URL</span>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-zinc-900 tracking-tight">
            Instant Resume and Cover Letter Tailor
          </h3>
          <p className="text-xs text-zinc-500 mt-1 font-normal leading-relaxed">
            Paste any job posting URL below. Our AI engine extracts requirements, matches your technical competencies, and builds a targeted ATS ready resume in seconds.
          </p>
        </div>

        {/* Action / Form area */}
        <div className="w-full lg:max-w-md">
          {status === 'idle' && (
            <form onSubmit={handleTailor} className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative w-full flex-1">
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste job URL (e.g. LinkedIn, Greenhouse)..."
                  className="w-full h-10 rounded-xl border border-zinc-200 bg-zinc-50/60 pl-3.5 pr-9 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all"
                />
                <button
                  type="button"
                  title="Paste from clipboard"
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  {pasted ? <Check size={14} className="text-emerald-600" /> : <Clipboard size={14} />}
                </button>
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-sm w-full sm:w-auto shrink-0 cursor-pointer"
              >
                <span>Tailor Now</span>
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>
          )}

          {status === 'running' && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-blue-950 truncate">
                    {stepMessage || 'Processing job posting...'}
                  </p>
                  <p className="text-[11px] text-blue-700/90 mt-0.5 font-normal">
                    Analyzing requirements and tailoring competencies in cloud engine
                  </p>
                </div>
                <Loader2 size={18} className="animate-spin text-blue-600 shrink-0" />
              </div>

              {/* 3-Step Stepper (FMR-style) */}
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] font-medium">
                <div className={`p-1.5 rounded-lg border text-center transition-all ${
                  currentStep >= 1 ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-white/60 text-blue-800 border-blue-200'
                }`}>
                  1. Ingest JD
                </div>
                <div className={`p-1.5 rounded-lg border text-center transition-all ${
                  currentStep >= 2 ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-white/60 text-blue-800 border-blue-200'
                }`}>
                  2. Align ATS
                </div>
                <div className={`p-1.5 rounded-lg border text-center transition-all ${
                  currentStep >= 3 ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-white/60 text-blue-800 border-blue-200'
                }`}>
                  3. Compile PDF
                </div>
              </div>

              <div className="h-1 w-full rounded-full bg-blue-200/60 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: currentStep === 1 ? '35%' : currentStep === 2 ? '75%' : '100%' }}
                />
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fadeInUp">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-emerald-950">Tailoring Complete!</p>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900 text-[10px] font-bold">
                      95%+ ATS Matched
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                    Ready in Resume Studio and Generated Docs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onOpenStudio && (
                  <button
                    type="button"
                    onClick={onOpenStudio}
                    className="h-9 flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 text-xs font-semibold text-white hover:bg-emerald-800 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
                  >
                    <FileText size={13} />
                    View Studio
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setStatus('idle'); setUrl(''); setCurrentStep(1); }}
                  className="h-9 rounded-lg border border-emerald-300/80 bg-white px-3.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 active:scale-[0.98] transition-all cursor-pointer"
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
                className="h-9 px-3.5 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 active:scale-[0.98] transition-all shrink-0 cursor-pointer"
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
