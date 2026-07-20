'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Field } from '../SectionAccordion';
import type { ExperienceEntry } from '@/lib/resume/types';

export function ExperienceSection({
  experience,
  onChange,
}: {
  experience: ExperienceEntry[];
  onChange: (next: ExperienceEntry[]) => void;
}) {
  const update = (index: number, patch: Partial<ExperienceEntry>) => {
    onChange(experience.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const updateBullet = (index: number, bulletIndex: number, value: string) => {
    const bullets = [...(experience[index].bullets || [])];
    bullets[bulletIndex] = value;
    update(index, { bullets });
  };

  const addBullet = (index: number) => {
    const bullets = [...(experience[index].bullets || []), ''];
    update(index, { bullets });
  };

  const removeBullet = (index: number, bulletIndex: number) => {
    const bullets = (experience[index].bullets || []).filter((_, i) => i !== bulletIndex);
    update(index, { bullets });
  };

  return (
    <div className="space-y-4">
      {experience.map((job, index) => (
        <div key={index} className="rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
              Role {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onChange(experience.filter((_, i) => i !== index))}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:text-rose-700"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Company" value={job.company || ''} onChange={(v) => update(index, { company: v })} />
            <Field label="Title" value={job.role || ''} onChange={(v) => update(index, { role: v })} />
            <Field label="Dates" value={job.period || ''} onChange={(v) => update(index, { period: v })} placeholder="Jan 2022 – Present" />
            <Field label="Location" value={job.location || ''} onChange={(v) => update(index, { location: v })} />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Bullets</span>
            {(job.bullets || []).map((b, bi) => (
              <div key={bi} className="flex gap-2">
                <input
                  value={b}
                  onChange={(e) => updateBullet(index, bi, e.target.value)}
                  placeholder="Impact-focused bullet with metrics…"
                  className="flex-1 rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#1C1C1E]"
                />
                <button
                  type="button"
                  onClick={() => removeBullet(index, bi)}
                  className="rounded-xl border border-[#E5E5E0] bg-white px-2 text-[#9CA3AF] hover:text-rose-600"
                  aria-label="Remove bullet"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addBullet(index)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1C1C1E] hover:underline"
            >
              <Plus size={14} /> Add bullet
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          onChange([
            ...experience,
            { company: '', role: '', period: '', location: '', bullets: [''] },
          ])
        }
        className="w-full rounded-xl border border-dashed border-[#E5E5E0] bg-white py-3 text-xs font-bold uppercase tracking-widest text-[#6B6B6B] hover:border-[#1C1C1E] hover:text-[#1C1C1E] transition-colors"
      >
        + Add experience
      </button>
    </div>
  );
}
