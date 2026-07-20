'use client';

import { ChevronDown } from 'lucide-react';

type SectionAccordionProps = {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
};

export function SectionAccordion({ id, title, open, onToggle, children, badge }: SectionAccordionProps) {
  return (
    <div className="border border-[#E5E5E0] rounded-2xl bg-white overflow-hidden" data-section={id}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#FAFAF8] transition-colors"
      >
        <span className="text-sm font-bold text-[#1C1C1E]">{title}</span>
        <span className="flex items-center gap-2">
          {badge ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{badge}</span>
          ) : null}
          <ChevronDown
            size={16}
            className={`text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {open ? <div className="px-4 pb-4 pt-1 border-t border-[#F5F5F0] space-y-3">{children}</div> : null}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2.5 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#1C1C1E] transition-colors"
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2.5 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#1C1C1E] transition-colors resize-y min-h-[96px]"
      />
    </label>
  );
}
