'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type PromptItem = {
  id?: string;
  title: string;
  prompt: string;
  outline: string;
  difficulty?: string;
  stackHints?: string[];
  starHint?: string;
};

export type PracticePackContent = {
  company?: string;
  role?: string;
  keywords?: string[];
  fit?: { tier: string; note: string };
  coding: PromptItem[];
  systemDesign: PromptItem[];
  behavioral: PromptItem[];
};

type TabId = 'coding' | 'systemDesign' | 'behavioral';

export default function PracticePackView({
  content,
  company,
  role,
}: {
  content: PracticePackContent;
  company?: string | null;
  role?: string | null;
}) {
  const [tab, setTab] = useState<TabId>('coding');
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => {
    if (tab === 'coding') return content.coding || [];
    if (tab === 'systemDesign') return content.systemDesign || [];
    return content.behavioral || [];
  }, [tab, content]);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'coding', label: 'Coding', count: content.coding?.length || 0 },
    { id: 'systemDesign', label: 'System Design', count: content.systemDesign?.length || 0 },
    { id: 'behavioral', label: 'Behavioral', count: content.behavioral?.length || 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] px-4 py-3">
        <p className="text-sm font-bold text-[#1C1C1E]">
          {(company || content.company || 'Company') + ' · ' + (role || content.role || 'Role')}
        </p>
        {content.fit?.note && (
          <p className="mt-1 text-xs text-[#6B6B6B]">{content.fit.note}</p>
        )}
        {!!content.keywords?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {content.keywords.slice(0, 12).map((k) => (
              <span
                key={k}
                className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#475569] ring-1 ring-[#E5E5E0]"
              >
                {k}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-[#E5E5E0] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setOpenId(null);
            }}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === t.id
                ? 'bg-[#1C1C1E] text-white'
                : 'bg-[#F4F4F0] text-[#6B6B6B] hover:bg-[#EBEBE6]'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {items.map((item, idx) => {
          const key = item.id || `${tab}-${idx}`;
          const open = openId === key;
          return (
            <li key={key} className="overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : key)}
                className="flex w-full items-start gap-2 px-4 py-3 text-left"
              >
                {open ? (
                  <ChevronDown size={16} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
                ) : (
                  <ChevronRight size={16} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#1C1C1E]">{item.title}</p>
                  {!open && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#6B6B6B]">{item.prompt}</p>
                  )}
                </div>
                {item.difficulty && (
                  <span className="shrink-0 rounded-full bg-[#F4F4F0] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6B6B6B]">
                    {item.difficulty}
                  </span>
                )}
              </button>
              {open && (
                <div className="space-y-3 border-t border-[#E5E5E0] px-4 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                      Prompt
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[#1C1C1E]">{item.prompt}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                      Outline / hints
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[#475569]">{item.outline}</p>
                  </div>
                  {item.starHint && (
                    <p className="text-xs italic text-[#6B6B6B]">STAR tip: {item.starHint}</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
