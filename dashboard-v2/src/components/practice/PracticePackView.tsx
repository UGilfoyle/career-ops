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
    <div className="space-y-2 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
          Language
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value as PracticeRunLanguage);
              setResult(null);
              setError(null);
            }}
            className="ml-2 rounded-lg border border-[#E5E5E0] bg-white px-2 py-1 text-xs font-semibold text-[#1C1C1E]"
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
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? 'Running…' : 'Run'}
        </button>
      </div>
      <textarea
        key={`${promptKey}-${language}`}
        value={code}
        onChange={(e) => setCodeByLang((prev) => ({ ...prev, [language]: e.target.value }))}
        rows={10}
        spellCheck={false}
        className="w-full resize-y rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 font-mono text-xs leading-relaxed text-[#1C1C1E]"
        placeholder="Write code here…"
      />
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
        stdin (optional)
        <textarea
          value={stdin}
          onChange={(e) => setStdin(e.target.value)}
          rows={2}
          spellCheck={false}
          className="mt-1 w-full resize-y rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 font-mono text-xs text-[#1C1C1E]"
          placeholder="Input fed to your program"
        />
      </label>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      {result && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
            Output · {result.provider}
            {result.compiler ? ` · ${result.compiler}` : ''}
            {result.timeSec != null ? ` · ${result.timeSec}s` : ''}
            {result.exitCode != null ? ` · exit ${result.exitCode}` : ''}
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-[#E5E5E0] bg-[#1C1C1E] px-3 py-2 font-mono text-[11px] text-[#E5E5E0]">
            {[result.stdout, result.stderr].filter(Boolean).join('\n') || '(no output)'}
          </pre>
        </div>
      )}
      {(language === 'javascript' || language === 'typescript') && (
        <p className="text-[10px] text-[#9CA3AF]">
          JS/TS runs on Deno via OnlineCompiler (no Node.js runtime on free SaaS).
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
