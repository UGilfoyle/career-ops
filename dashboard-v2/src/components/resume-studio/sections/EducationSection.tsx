'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Field } from '../SectionAccordion';
import type { EducationEntry } from '@/lib/resume/types';

export function EducationSection({
  education,
  onChange,
}: {
  education: EducationEntry[];
  onChange: (next: EducationEntry[]) => void;
}) {
  const update = (index: number, patch: Partial<EducationEntry>) => {
    onChange(education.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  return (
    <div className="space-y-4">
      {education.map((edu, index) => (
        <div key={index} className="rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
              Education {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onChange(education.filter((_, i) => i !== index))}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-rose-600"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Degree" value={edu.degree || ''} onChange={(v) => update(index, { degree: v })} />
            <Field label="School" value={edu.school || ''} onChange={(v) => update(index, { school: v })} />
            <Field label="Years" value={edu.period || ''} onChange={(v) => update(index, { period: v })} placeholder="2014 – 2018" />
            <Field label="Location" value={edu.location || ''} onChange={(v) => update(index, { location: v })} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...education, { degree: '', school: '', period: '', location: '' }])}
        className="w-full rounded-xl border border-dashed border-[#E5E5E0] bg-white py-3 text-xs font-bold uppercase tracking-widest text-[#6B6B6B] hover:border-[#1C1C1E] hover:text-[#1C1C1E] transition-colors inline-flex items-center justify-center gap-1.5"
      >
        <Plus size={14} /> Add education
      </button>
    </div>
  );
}
