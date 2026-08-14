'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Copy, ExternalLink, Loader2, Mail, X } from 'lucide-react';

export type OutreachTarget = {
  jobId?: number;
  company: string;
  role: string;
  url?: string;
};

type DraftResponse = {
  company: string;
  role: string;
  region?: string;
  domain: string | null;
  emails: string[];
  people: string[];
  notes: string[];
  sources: Array<{ id: string; ok: boolean; skipped?: boolean; summary: string; url?: string }>;
  searchLinks: Array<{ label: string; url: string }>;
  githubAuth?: boolean;
  draft: { subject: string; body: string; hook_used: string };
  llm: boolean;
  error?: string;
  message?: string;
};

type Props = {
  target: OutreachTarget | null;
  onClose: () => void;
};

export function OutreachDraftModal({ target, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DraftResponse | null>(null);
  const [copied, setCopied] = useState<'subject' | 'body' | 'all' | null>(null);

  useEffect(() => {
    if (!target) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch('/api/outreach/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: target.jobId,
        company: target.company,
        role: target.role,
        url: target.url,
      }),
    })
      .then(async (res) => {
        const json = (await res.json()) as DraftResponse;
        if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
        return json;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Research failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const copy = async (kind: 'subject' | 'body' | 'all', text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E5E5E0] bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Research & draft</p>
                <h3 className="mt-1 text-lg font-bold text-[#1C1C1E]">
                  {target.company} — {target.role}
                </h3>
                <p className="mt-1 text-xs text-[#6B6B6B]">
                  Public sources only. No LinkedIn login, no Hunter. Copy and send yourself.
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#9CA3AF] hover:bg-[#F5F5F0]">
                <X size={18} />
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-3 py-10 text-sm text-[#6B6B6B]">
                <Loader2 className="animate-spin" size={18} />
                Reading job page, Wikipedia, Wikidata, GitHub, news, DNS…
              </div>
            )}
            {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

            {data && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                  {data.region && (
                    <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-violet-800">
                      {data.region}
                    </span>
                  )}
                  {data.githubAuth && (
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
                      github token
                    </span>
                  )}
                  {data.sources.map((s) => (
                    <span
                      key={`${s.id}-${s.url || s.summary.slice(0, 12)}`}
                      title={s.summary}
                      className={`rounded-md border px-2 py-1 ${
                        s.ok
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : s.skipped
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-[#E5E5E0] bg-[#FAFAF8] text-[#9CA3AF]'
                      }`}
                    >
                      {s.id}{s.skipped ? ' skip' : ''}
                    </span>
                  ))}
                  {data.domain && (
                    <span className="rounded-md border border-[#E5E5E0] px-2 py-1 text-[#6B6B6B]">@{data.domain}</span>
                  )}
                  {!data.llm && (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                      template draft
                    </span>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Subject</label>
                    <button
                      type="button"
                      onClick={() => copy('subject', data.draft.subject)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6B6B6B]"
                    >
                      {copied === 'subject' ? <CheckCircle2 size={12} /> : <Copy size={12} />} Copy
                    </button>
                  </div>
                  <p className="rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2 text-sm font-semibold text-[#1C1C1E]">
                    {data.draft.subject}
                  </p>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Email</label>
                    <button
                      type="button"
                      onClick={() => copy('body', `Subject: ${data.draft.subject}\n\n${data.draft.body}`)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[#6B6B6B]"
                    >
                      {copied === 'body' ? <CheckCircle2 size={12} /> : <Copy size={12} />} Copy all
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-3 font-sans text-sm leading-relaxed text-[#1C1C1E]">
                    {data.draft.body}
                  </pre>
                </div>

                {data.emails.length > 0 && (
                  <p className="text-xs text-[#6B6B6B]">
                    Public emails on pages: {data.emails.join(', ')}
                  </p>
                )}
                {data.people.length > 0 && (
                  <p className="text-xs text-[#6B6B6B]">People / GitHub: {data.people.join('; ')}</p>
                )}

                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">You click (not scraped)</p>
                  <div className="flex flex-wrap gap-2">
                    {data.searchLinks.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E5E5E0] px-2.5 py-1.5 text-[11px] font-bold text-[#1C1C1E] hover:bg-[#FAFAF8]"
                      >
                        {l.label} <ExternalLink size={11} />
                      </a>
                    ))}
                  </div>
                </div>

                <details className="rounded-xl border border-[#E5E5E0] px-3 py-2 text-xs text-[#6B6B6B]">
                  <summary className="cursor-pointer font-bold text-[#1C1C1E]">Source notes</summary>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {data.notes.map((n) => (
                      <li key={n.slice(0, 40)}>{n}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-white"
              >
                <Mail size={14} /> Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
