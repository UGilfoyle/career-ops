'use client';

import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';

export function CompetenciesSection({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const next = input.trim();
    if (!next) return;
    if (tags.some((t) => t.toLowerCase() === next.toLowerCase())) {
      setInput('');
      return;
    }
    onChange([...tags, next]);
    setInput('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#6B6B6B] font-medium">
        Stored as <span className="font-mono text-[11px]">narrative.superpowers</span> — powers tailor scoring and the Technical Skills block.
      </p>
      <div className="flex flex-wrap gap-2 min-h-[42px] rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs font-bold text-[#0F172A]"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              className="text-[#9CA3AF] hover:text-[#0F172A]"
              aria-label={`Remove ${tag}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={tags.length ? '+ Add' : 'Type a skill, press Enter…'}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm font-medium text-[#0F172A] placeholder:text-[#9CA3AF]"
        />
      </div>
    </div>
  );
}
