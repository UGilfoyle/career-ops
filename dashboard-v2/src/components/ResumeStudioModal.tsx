'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';

type ResumeStudioModalProps = {
  open: boolean;
  onClose: () => void;
  onSeeRoadmap?: () => void;
};

export default function ResumeStudioModal({ open, onClose, onSeeRoadmap }: ResumeStudioModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm sm:p-6"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-studio-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#E5E5E0] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#E5E5E0] bg-gradient-to-r from-[#F5F5F0] via-white to-[#FAFAF8] p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1C1C1E] text-white">
                    <Sparkles size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 id="resume-studio-modal-title" className="text-lg font-bold text-[#1C1C1E]">
                        Resume Studio
                      </h2>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                        Phase 2
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#6B6B6B]">In active development</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-[#9CA3AF] transition-colors hover:bg-white hover:text-[#1C1C1E]"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm leading-relaxed text-[#6B6B6B]">
                We&apos;re shipping a visual resume editor with live preview, template gallery, and per-job diff
                review — the workflow you asked for. Your pipeline, tailor, and PDF export keep working today.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[#1C1C1E]">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1C1C1E]" />
                  Live preview editor
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1C1C1E]" />
                  ATS template gallery
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1C1C1E]" />
                  Master vs tailored diff review
                </li>
              </ul>
            </div>

            <div className="flex gap-3 border-t border-[#E5E5E0] p-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-[#E5E5E0] px-4 py-3 text-sm font-bold text-[#6B6B6B] transition-colors hover:bg-[#FAFAF8]"
              >
                Got it
              </button>
              {onSeeRoadmap && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSeeRoadmap();
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1C1C1E] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#27272a]"
                >
                  See roadmap
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
