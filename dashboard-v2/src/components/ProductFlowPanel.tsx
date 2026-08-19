'use client';

import { useState } from 'react';
import { ChevronRight, Terminal, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { PUBLIC_GETTING_STARTED, type PublicFlowStep } from '@/lib/onboarding-flow';

type Props = {
  variant?: 'landing' | 'signup' | 'compact';
  showSignupCta?: boolean;
};

export function ProductFlowPanel({ variant = 'landing', showSignupCta = true }: Props) {
  const [activeId, setActiveId] = useState(PUBLIC_GETTING_STARTED[0]?.id ?? 'signup');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const active = PUBLIC_GETTING_STARTED.find((s) => s.id === activeId) ?? PUBLIC_GETTING_STARTED[0];

  const copyCommand = (cmd: string) => {
    void navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        {PUBLIC_GETTING_STARTED.map((step) => (
          <FlowRow key={step.id} step={step} minimal />
        ))}
      </div>
    );
  }

  const isSignup = variant === 'signup';

  return (
    <div
      className={
        isSignup
          ? 'mb-8 rounded-[1.75rem] border border-[#E5E5E0] bg-white overflow-hidden shadow-sm'
          : 'w-full max-w-4xl mx-auto'
      }
    >
      {!isSignup && (
        <div className="text-center mb-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF] mb-2">Interactive walkthrough</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1C1C1E] tracking-tight">How Career-Ops works</h2>
          <p className="text-[#6B6B6B] mt-3 max-w-xl mx-auto text-sm font-medium">
            Same flow after signup. Preview it here before creating an account.
          </p>
        </div>
      )}

      {isSignup && (
        <div className="px-6 py-4 bg-[#F5F5F0] border-b border-[#E5E5E0]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-1">After you sign up</p>
          <h2 className="text-sm font-bold text-[#1C1C1E]">Your first 5 minutes on the dashboard</h2>
        </div>
      )}

      <div className={isSignup ? 'p-5' : 'grid grid-cols-1 lg:grid-cols-5 gap-6'}>
        <div className={isSignup ? 'space-y-2 mb-4' : 'lg:col-span-2 space-y-2'}>
          {PUBLIC_GETTING_STARTED.map((step) => {
            const selected = step.id === activeId;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveId(step.id)}
                className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${
                  selected
                    ? 'bg-[#1C1C1E] border-[#1C1C1E] text-white shadow-md'
                    : 'bg-white border-[#E5E5E0] hover:border-[#d4d4d8] text-[#1C1C1E]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      selected ? 'bg-white/15 text-white' : 'bg-[#F5F5F0] text-[#6B6B6B]'
                    }`}
                  >
                    {step.step}
                  </span>
                  <div className="min-w-0">
                    <div className={`text-sm font-bold ${selected ? 'text-white' : 'text-[#1C1C1E]'}`}>{step.title}</div>
                    <div className={`text-xs truncate ${selected ? 'text-white/70' : 'text-[#9CA3AF]'}`}>{step.summary}</div>
                  </div>
                  <ChevronRight size={14} className={`shrink-0 ml-auto ${selected ? 'text-white/50' : 'text-[#C4C4BE]'}`} />
                </div>
              </button>
            );
          })}
        </div>

        <div className={isSignup ? '' : 'lg:col-span-3'}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-[1.5rem] border border-[#E5E5E0] bg-[#FAFAF8] p-6 md:p-8 min-h-[200px]"
            >
              <FlowDetail step={active} copiedCmd={copiedCmd} onCopy={copyCommand} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {showSignupCta && !isSignup && (
        <div className="text-center mt-10">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#1C1C1E] text-white font-bold rounded-2xl hover:bg-[#27272a] transition-all shadow-lg"
          >
            Start free (tour included)
            <ChevronRight size={18} />
          </Link>
        </div>
      )}
    </div>
  );
}

function FlowRow({ step, minimal }: { step: PublicFlowStep; minimal?: boolean }) {
  return (
    <div className={`flex gap-3 ${minimal ? 'py-1' : ''}`}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5F5F0] text-[10px] font-bold text-[#6B6B6B]">
        {step.step}
      </span>
      <div>
        <div className="text-xs font-bold text-[#1C1C1E]">{step.title}</div>
        {!minimal && <div className="text-[11px] text-[#9CA3AF]">{step.summary}</div>}
      </div>
    </div>
  );
}

function FlowDetail({
  step,
  copiedCmd,
  onCopy,
}: {
  step: PublicFlowStep;
  copiedCmd: string | null;
  onCopy: (cmd: string) => void;
}) {
  return (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">Step {step.step}</p>
      <h3 className="text-xl font-bold text-[#1C1C1E] mb-3">{step.title}</h3>
      <p className="text-sm text-[#6B6B6B] leading-relaxed font-medium">{step.detail}</p>
      {step.command ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <code className="flex items-center gap-2 rounded-xl bg-white border border-[#E5E5E0] px-3 py-2 text-xs font-mono font-bold text-[#1C1C1E]">
            <Terminal size={14} className="text-[#9CA3AF]" />
            {step.command}
          </code>
          <button
            type="button"
            onClick={() => onCopy(step.command!)}
            className="inline-flex items-center gap-1 rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] hover:text-[#1C1C1E]"
          >
            {copiedCmd === step.command ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            {copiedCmd === step.command ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : null}
    </>
  );
}
