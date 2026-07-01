'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'career-ops-resume-studio-banner-dismissed';

type ComingSoonBannerProps = {
  onLearnMore?: () => void;
};

export default function ComingSoonBanner({ onLearnMore }: ComingSoonBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== '1');
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-8 rounded-2xl border border-[#E5E5E0] bg-gradient-to-r from-[#F5F5F0] via-white to-[#FAFAF8] p-4 sm:p-5 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1C1C1E] text-white">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-[#1C1C1E]">Resume Studio — in active development</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    Phase 2
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-[#6B6B6B]">
                  We&apos;re shipping a visual resume editor with live preview, template gallery, and per-job diff
                  review — the workflow you asked for. Your pipeline, tailor, and PDF export keep working today.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
              {onLearnMore && (
                <button
                  type="button"
                  onClick={onLearnMore}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-xs font-bold text-[#1C1C1E] transition-colors hover:bg-[#FAFAF8]"
                >
                  See roadmap
                  <ArrowRight size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-[#9CA3AF] transition-colors hover:bg-white hover:text-[#1C1C1E]"
                aria-label="Dismiss announcement"
              >
                <X size={14} />
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
