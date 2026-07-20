'use client';

import { Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEMPLATE_CATALOG, type TemplateMeta } from '@/lib/resume/ats-professional-template';

type TemplateGalleryProps = {
  open: boolean;
  selectedId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
};

export function TemplateGallery({ open, selectedId, onClose, onSelect }: TemplateGalleryProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1C1C1E]/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="w-full max-w-3xl max-h-[min(640px,90vh)] overflow-hidden rounded-[1.75rem] border border-[#E5E5E0] bg-[#FAFAF8] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E5E5E0] px-6 py-5">
              <div>
                <h3 className="text-xl font-bold text-[#1C1C1E]">Choose a template</h3>
                <p className="text-xs text-[#6B6B6B] font-medium mt-1">
                  ATS Classic recommended for job applications — all variants stay single-column for parsers.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 rounded-full border border-[#E5E5E0] bg-white flex items-center justify-center text-[#6B6B6B] hover:text-[#1C1C1E]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TEMPLATE_CATALOG.map((t) => (
                  <TemplateCard
                    key={t.id}
                    meta={t}
                    selected={selectedId === t.id}
                    onSelect={() => onSelect(t.id)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E5E5E0] px-6 py-4 bg-white">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#E5E5E0] bg-white px-4 py-2.5 text-xs font-bold text-[#1C1C1E] hover:bg-[#FAFAF8]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#27272a]"
              >
                Apply template
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function TemplateCard({
  meta,
  selected,
  onSelect,
}: {
  meta: TemplateMeta;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-2xl border p-4 transition-all ${
        selected
          ? 'border-[#1C1C1E] ring-2 ring-[#1C1C1E]/15 bg-white shadow-sm'
          : 'border-[#E5E5E0] bg-white hover:border-[#1C1C1E]/40'
      }`}
    >
      <div className="aspect-[210/120] rounded-xl bg-[#F5F5F0] border border-[#E5E5E0] mb-3 overflow-hidden relative p-3">
        <div className="h-full flex flex-col gap-1.5">
          <div className={`h-2.5 w-1/2 rounded-sm bg-[#1C1C1E] ${meta.id === 'ats-technical' ? 'font-mono' : ''} ${meta.id.includes('minimal') ? 'mx-auto' : ''}`} />
          <div className="h-1 w-3/4 rounded-sm bg-[#d4d4d8] mx-auto" />
          <div className="mt-1 h-px w-full bg-[#1C1C1E]/80" />
          <div className="h-1.5 w-1/3 rounded-sm bg-[#9CA3AF] mt-1" />
          <div className="space-y-1 mt-1 flex-1">
            <div className="h-1 w-full rounded-sm bg-[#E5E5E0]" />
            <div className="h-1 w-[92%] rounded-sm bg-[#E5E5E0]" />
            <div className="h-1 w-[85%] rounded-sm bg-[#E5E5E0]" />
          </div>
        </div>
        {selected ? (
          <span className="absolute top-2 right-2 h-6 w-6 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center">
            <Check size={14} />
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-bold text-[#1C1C1E]">{meta.name}</span>
        {meta.badge ? (
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {meta.badge}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-[#6B6B6B] leading-relaxed">{meta.description}</p>
    </button>
  );
}
