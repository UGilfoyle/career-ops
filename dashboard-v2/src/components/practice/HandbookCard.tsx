'use client';

import { useState } from 'react';
import { BookOpen, Check, Copy, Image } from 'lucide-react';
import {
  GEMINI_AI_DSA_HANDBOOK_PROMPT,
  GEMINI_HANDBOOK_VISUALS_FOLLOWUP,
  HANDBOOK_REPO_PROMPT_PATH,
  HANDBOOK_REPO_TRACKER_PATH,
  HANDBOOK_WEEKS,
} from '@/lib/practice/handbook-prompt';

export default function HandbookCard() {
  const [copied, setCopied] = useState<'main' | 'visuals' | null>(null);

  async function copy(kind: 'main' | 'visuals') {
    const text =
      kind === 'main'
        ? GEMINI_AI_DSA_HANDBOOK_PROMPT.trim()
        : GEMINI_HANDBOOK_VISUALS_FOLLOWUP.trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="min-w-0 rounded-2xl border border-[#E5E5E0] bg-white p-3 shadow-sm sm:rounded-[1.5rem] sm:p-5">
      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 shrink-0 text-[#1C1C1E]" size={16} />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#1C1C1E]">AI + DSA 4-week handbook</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[#6B6B6B]">
            Gemini Pro must draw mermaid charts + whiteboard images, then Hindi caption. JD{' '}
            <span className="font-semibold text-[#475569]">Generate pack</span> is the drill.
            Tracker: <code className="text-[11px]">{HANDBOOK_REPO_TRACKER_PATH}</code>
          </p>
        </div>
      </div>
      <ol className="mt-3 space-y-1.5 text-[11px] font-medium leading-snug text-[#475569]">
        {HANDBOOK_WEEKS.map((w) => (
          <li key={w.week}>
            <span className="font-bold text-[#1C1C1E]">W{w.week} {w.title}.</span> {w.focus}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => void copy('main')}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3 py-2.5 text-xs font-bold text-white sm:w-auto"
        >
          {copied === 'main' ? <Check size={14} /> : <Copy size={14} />}
          {copied === 'main' ? 'Copied' : 'Copy Gemini prompt'}
        </button>
        <button
          type="button"
          onClick={() => void copy('visuals')}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E0] px-3 py-2.5 text-xs font-bold text-[#1C1C1E] sm:w-auto"
        >
          {copied === 'visuals' ? <Check size={14} /> : <Image size={14} />}
          {copied === 'visuals' ? 'Copied' : 'Copy charts follow-up'}
        </button>
      </div>
      <p className="mt-2 text-[10px] font-medium text-[#9CA3AF]">
        Follow-up: same Gemini chat if the first draft was text-only. Source:{' '}
        <code>{HANDBOOK_REPO_PROMPT_PATH}</code>
      </p>
    </div>
  );
}
