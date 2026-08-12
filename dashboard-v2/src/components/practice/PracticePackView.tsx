'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Play } from 'lucide-react';
import {
  PRACTICE_RUN_LANGUAGES,
  type PracticeRunLanguage,
  type PracticeRunResult,
} from '@/lib/practice/runner/types';

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

const STARTERS: Partial<Record<PracticeRunLanguage, string>> = {
  python: '# Write your solution\n\ndef solve():\n    pass\n\nif __name__ == "__main__":\n    solve()\n',
  typescript:
    '// Write your solution (runs on Deno)\nfunction solve(): void {\n  console.log("hello");\n}\n\nsolve();\n',
  javascript:
    '// Write your solution (runs on Deno)\nfunction solve() {\n  console.log("hello");\n}\n\nsolve();\n',
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("hello");\n  }\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n  ios::sync_with_stdio(false);\n  cin.tie(nullptr);\n  return 0;\n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}\n',
};

function CodingRunner({ promptKey }: { promptKey: string }) {
  const [language, setLanguage] = useState<PracticeRunLanguage>('python');
  const [codeByLang, setCodeByLang] = useState<Partial<Record<PracticeRunLanguage, string>>>({});
  const [stdin, setStdin] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PracticeRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const code = codeByLang[language] ?? STARTERS[language] ?? '';

  async function onRun() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/practice/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, stdin }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.result) {
        setResult(data.result as PracticeRunResult);
        if (!res.ok && data.message) setError(String(data.message));
      } else {
        setError(String(data.message || data.error || `Run failed (${res.status})`));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-2.5 sm:p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
          Language
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value as PracticeRunLanguage);
              setResult(null);
              setError(null);
            }}
            className="w-full rounded-xl border border-[#E5E5E0] bg-white px-3 py-2.5 text-base font-semibold text-[#1C1C1E] sm:text-sm"
          >
            {PRACTICE_RUN_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void onRun()}
          disabled={running || !code.trim()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:mt-5 sm:w-auto sm:min-w-[6.5rem]"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          {running ? 'Running…' : 'Run'}
        </button>
      </div>
      <textarea
        key={`${promptKey}-${language}`}
        value={code}
        onChange={(e) => setCodeByLang((prev) => ({ ...prev, [language]: e.target.value }))}
        rows={8}
        spellCheck={false}
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        className="max-h-[50vh] w-full min-w-0 resize-y overflow-x-auto rounded-xl border border-[#E5E5E0] bg-white px-3 py-2.5 font-mono text-[13px] leading-relaxed text-[#1C1C1E] [overflow-wrap:anywhere] sm:text-xs"
        placeholder="Write code here…"
      />
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
        stdin (optional)
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          rows={2}
          spellCheck={false}
          className="mt-1 w-full min-w-0 resize-y rounded-xl border border-[#E5E5E0] bg-white px-3 py-2.5 font-mono text-[13px] text-[#1C1C1E] sm:text-xs"
          placeholder="Input fed to your program"
        />
      </label>
      {error && (
        <p className="break-words text-xs font-medium text-red-600 [overflow-wrap:anywhere]">
          {error}
        </p>
      )}
      {result && (
        <div className="min-w-0 space-y-1.5">
          <p className="break-words text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] [overflow-wrap:anywhere]">
            Output · {result.provider}
            {result.compiler ? ` · ${result.compiler}` : ''}
            {result.timeSec != null ? ` · ${result.timeSec}s` : ''}
            {result.exitCode != null ? ` · exit ${result.exitCode}` : ''}
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[#E5E5E0] bg-[#1C1C1E] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#E5E5E0] [overflow-wrap:anywhere]">
            {[result.stdout, result.stderr].filter(Boolean).join('\n') || '(no output)'}
          </pre>
        </div>
      )}
      {(language === 'javascript' || language === 'typescript') && (
        <p className="text-[10px] leading-snug text-[#9CA3AF]">
          JS/TS runs on Deno (no Node on free SaaS).
        </p>
      )}
    </div>
  );
}

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

  const tabs: { id: TabId; label: string; short: string; count: number }[] = [
    { id: 'coding', label: 'Coding', short: 'Code', count: content.coding?.length || 0 },
    {
      id: 'systemDesign',
      label: 'System Design',
      short: 'Design',
      count: content.systemDesign?.length || 0,
    },
    {
      id: 'behavioral',
      label: 'Behavioral',
      short: 'Behav',
      count: content.behavioral?.length || 0,
    },
  ];

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-3 sm:px-4">
        <p className="break-words text-sm font-bold leading-snug text-[#1C1C1E] [overflow-wrap:anywhere]">
          {(company || content.company || 'Company') + ' · ' + (role || content.role || 'Role')}
        </p>
        {content.fit?.note && (
          <p className="mt-1 break-words text-xs leading-relaxed text-[#6B6B6B] [overflow-wrap:anywhere]">
            {content.fit.note}
          </p>
        )}
        {!!content.keywords?.length && (
          <div className="mt-2 flex max-w-full flex-wrap gap-1.5">
            {content.keywords.slice(0, 12).map((k) => (
              <span
                key={k}
                className="max-w-full break-all rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#475569] ring-1 ring-[#E5E5E0]"
              >
                {k}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setOpenId(null);
            }}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
              tab === t.id
                ? 'bg-[#1C1C1E] text-white'
                : 'bg-[#F4F4F0] text-[#6B6B6B] active:bg-[#EBEBE6]'
            }`}
          >
            <span className="sm:hidden">
              {t.short} ({t.count})
            </span>
            <span className="hidden sm:inline">
              {t.label} ({t.count})
            </span>
          </button>
        ))}
      </div>

      <ul className="min-w-0 space-y-2">
        {items.map((item, idx) => {
          const key = item.id || `${tab}-${idx}`;
          const open = openId === key;
          return (
            <li
              key={key}
              className="min-w-0 overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white"
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : key)}
                className="flex w-full min-w-0 items-start gap-2 px-3 py-3 text-left sm:px-4"
              >
                {open ? (
                  <ChevronDown size={16} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
                ) : (
                  <ChevronRight size={16} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="min-w-0 flex-1 break-words text-sm font-bold leading-snug text-[#1C1C1E] [overflow-wrap:anywhere]">
                      {item.title}
                    </p>
                    {item.difficulty && (
                      <span className="shrink-0 rounded-full bg-[#F4F4F0] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6B6B6B]">
                        {item.difficulty}
                      </span>
                    )}
                  </div>
                  {!open && (
                    <p className="mt-0.5 line-clamp-2 break-words text-xs text-[#6B6B6B] [overflow-wrap:anywhere]">
                      {item.prompt}
                    </p>
                  )}
                </div>
              </button>
              {open && (
                <div className="min-w-0 space-y-3 border-t border-[#E5E5E0] px-3 py-3 sm:px-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                      Prompt
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1C1C1E] [overflow-wrap:anywhere]">
                      {item.prompt}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                      Outline / hints
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#475569] [overflow-wrap:anywhere]">
                      {item.outline}
                    </p>
                  </div>
                  {item.starHint && (
                    <p className="break-words text-xs italic leading-relaxed text-[#6B6B6B] [overflow-wrap:anywhere]">
                      STAR tip: {item.starHint}
                    </p>
                  )}
                  {tab === 'coding' && <CodingRunner promptKey={key} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
