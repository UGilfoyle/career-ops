'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  Trash2,
  Eye,
  Download,
  X,
  Sparkles,
} from 'lucide-react';

export type GeneratedDoc = {
  id: number | string;
  company?: string;
  title?: string;
  url?: string;
  mtime?: string;
  ats_content_score?: number | null;
  has_resume_pdf?: boolean;
  has_cover_letter_pdf?: boolean;
  has_resume_html?: boolean;
  has_cover_letter_html?: boolean;
};

type DocKind = 'resume' | 'cover';

type DocCard = GeneratedDoc & {
  kind: DocKind;
  cardKey: string;
};

type DocFilter = 'all' | 'resume' | 'cover';

type GeneratedDocsPanelProps = {
  docs: GeneratedDoc[];
  onDelete: (id: number, company: string, title: string) => void;
  onOpenPipeline: () => void;
  onOpenInStudio?: (doc: GeneratedDoc) => void;
};

function formatDocDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function expandToDocCards(docs: GeneratedDoc[]): DocCard[] {
  const cards: DocCard[] = [];
  for (const doc of docs) {
    const hasResume = doc.has_resume_pdf || doc.has_resume_html;
    const hasCover = doc.has_cover_letter_pdf || doc.has_cover_letter_html;
    if (hasResume) {
      cards.push({ ...doc, kind: 'resume', cardKey: `${doc.id}-resume` });
    }
    if (hasCover) {
      cards.push({ ...doc, kind: 'cover', cardKey: `${doc.id}-cover` });
    }
  }
  return cards;
}

function docsThisWeek(cards: DocCard[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const seen = new Set<string>();
  let count = 0;
  for (const card of cards) {
    const key = String(card.id);
    if (seen.has(key)) continue;
    if (!card.mtime) continue;
    const t = new Date(card.mtime).getTime();
    if (!Number.isNaN(t) && t >= weekAgo) {
      seen.add(key);
      count += 1;
    }
  }
  return count;
}

function previewUrl(doc: DocCard): string | null {
  const id = doc.id;
  if (doc.kind === 'cover') {
    if (doc.has_cover_letter_html) return `/api/view/${id}?type=cl`;
    if (doc.has_cover_letter_pdf) return `/api/view/${id}?type=cl&format=pdf`;
    return null;
  }
  if (doc.has_resume_html) return `/api/view/${id}`;
  if (doc.has_resume_pdf) return `/api/view/${id}?format=pdf`;
  return null;
}

function pdfDownloadUrl(doc: DocCard): string | null {
  if (doc.kind === 'cover' && (doc.has_cover_letter_pdf || doc.has_cover_letter_html)) {
    return `/api/view/${doc.id}?type=cl&format=pdf&download=1`;
  }
  if (doc.kind === 'resume' && (doc.has_resume_pdf || doc.has_resume_html)) {
    return `/api/view/${doc.id}?format=pdf&download=1`;
  }
  return null;
}

export default function GeneratedDocsPanel({
  docs,
  onDelete,
  onOpenPipeline,
  onOpenInStudio,
}: GeneratedDocsPanelProps) {
  const [filter, setFilter] = useState<DocFilter>('all');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<DocCard | null>(null);

  const allCards = useMemo(() => expandToDocCards(docs), [docs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCards.filter((card) => {
      if (filter === 'resume' && card.kind !== 'resume') return false;
      if (filter === 'cover' && card.kind !== 'cover') return false;
      if (!q) return true;
      return (
        String(card.company || '').toLowerCase().includes(q) ||
        String(card.title || '').toLowerCase().includes(q)
      );
    });
  }, [allCards, filter, query]);

  const weekCount = docsThisWeek(allCards);
  const previewSrc = preview ? previewUrl(preview) : null;

  const filterTabs: { id: DocFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'resume', label: 'Resumes' },
    { id: 'cover', label: 'Cover Letters' },
  ];

  return (
    <motion.div
      key="generated-docs"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 font-[family-name:var(--font-inter)]"
    >
      {weekCount > 0 && (
        <div className="rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] px-5 py-4 text-sm text-[#6B6B6B]">
          <span className="font-semibold text-[#1C1C1E]">{weekCount}</span> job
          {weekCount === 1 ? '' : 's'} with new documents this week
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
                filter === tab.id
                  ? 'bg-[#1C1C1E] text-white shadow-md'
                  : 'border border-[#E5E5E0] bg-white text-[#6B6B6B] hover:border-[#D4D4CE] hover:text-[#1C1C1E]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-xl border border-[#E5E5E0] bg-white py-2.5 pl-10 pr-4 text-sm font-normal text-[#1C1C1E] outline-none placeholder:text-[#9CA3AF] focus:border-[#1C1C1E]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-[#E5E5E0] bg-[#FAFAF8] px-8 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F5F0]">
            <FileText size={28} className="text-[#9CA3AF]" />
          </div>
          <p className="text-base font-semibold text-[#1C1C1E]">No documents yet</p>
          <p className="mt-2 text-sm font-normal text-[#6B6B6B]">
            Run tailor on a high-scoring job from the pipeline to generate resumes and cover letters.
          </p>
          <button
            type="button"
            onClick={onOpenPipeline}
            className="mt-6 rounded-xl bg-[#1C1C1E] px-6 py-3 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-[#27272a]"
          >
            Open Job Pipeline →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((card) => {
            const id = Number(card.id);
            const company = card.company || 'Unknown';
            const title = card.title || 'Role';
            const isResume = card.kind === 'resume';
            const pdfUrl = pdfDownloadUrl(card);
            const canPreview = !!previewUrl(card);
            const ats = card.ats_content_score;

            return (
              <article
                key={card.cardKey}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white transition-all hover:border-[#1C1C1E] hover:shadow-lg"
              >
                <div className="border-b border-[#F5F5F0] bg-gradient-to-b from-[#FAFAF8] to-white p-4">
                  <div className="mb-4 flex h-36 items-center justify-center overflow-hidden rounded-xl border border-[#E5E5E0] bg-[#F5F5F0]">
                    <div className="w-[72%] rounded-sm border border-[#E5E5E0] bg-white p-3 shadow-sm">
                      <div className="mb-2 h-2 w-1/2 rounded bg-[#1C1C1E]/80" />
                      <div className="mb-1.5 h-1 w-full rounded bg-[#E5E5E0]" />
                      <div className="mb-1.5 h-1 w-[92%] rounded bg-[#E5E5E0]" />
                      <div className="mb-1.5 h-1 w-[88%] rounded bg-[#E5E5E0]" />
                      <div className="mt-3 h-1 w-full rounded bg-[#F0F0EB]" />
                      <div className="mt-1 h-1 w-[95%] rounded bg-[#F0F0EB]" />
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold leading-snug text-[#1C1C1E]">{company}</p>
                      <p className="mt-0.5 truncate text-sm font-normal text-[#6B6B6B]">{title}</p>
                      <p className="mt-2 text-xs font-normal text-[#9CA3AF]">{formatDocDate(card.mtime)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          isResume
                            ? 'bg-[#EFF6FF] text-[#2563EB]'
                            : 'bg-[#F5F3FF] text-[#7C3AED]'
                        }`}
                      >
                        {isResume ? 'Resume' : 'Cover Letter'}
                      </span>
                      {isResume && typeof ats === 'number' && ats > 0 && (
                        <span className="text-xs font-semibold text-[#10B981]">ATS {ats}/100</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2 border-t border-[#F5F5F0] p-3">
                  <button
                    type="button"
                    disabled={!canPreview}
                    onClick={() => canPreview && setPreview(card)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      canPreview
                        ? 'border-[#E5E5E0] bg-white text-[#1C1C1E] hover:border-[#1C1C1E] hover:bg-[#FAFAF8]'
                        : 'cursor-not-allowed border-[#F0F0EB] bg-[#FAFAF8] text-[#C4C4C4]'
                    }`}
                  >
                    <Eye size={14} />
                    Preview
                  </button>
                  {onOpenInStudio ? (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenInStudio({
                          id: card.id,
                          company: card.company,
                          title: card.title,
                          ats_content_score: card.ats_content_score,
                          has_resume_html: card.has_resume_html,
                          has_resume_pdf: card.has_resume_pdf,
                          has_cover_letter_html: card.has_cover_letter_html,
                          has_cover_letter_pdf: card.has_cover_letter_pdf,
                          mtime: card.mtime,
                          url: card.url,
                        })
                      }
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E0] bg-white px-3 py-2.5 text-xs font-semibold text-[#1C1C1E] transition-colors hover:border-[#1C1C1E] hover:bg-[#FAFAF8]"
                      title="Compare master vs tailored in Resume Studio"
                    >
                      <Sparkles size={14} />
                      Studio
                    </button>
                  ) : null}
                  {pdfUrl ? (
                    <a
                      href={pdfUrl}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#1C1C1E] bg-white px-3 py-2.5 text-xs font-semibold text-[#1C1C1E] transition-colors hover:bg-[#1C1C1E] hover:text-white"
                    >
                      <Download size={14} />
                      PDF
                    </a>
                  ) : (
                    <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#F0F0EB] bg-[#FAFAF8] px-3 py-2.5 text-xs font-semibold text-[#C4C4C4]">
                      PDF
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(id, company, title)}
                    className="flex shrink-0 items-center justify-center rounded-xl border border-[#E5E5E0] p-2.5 text-[#9CA3AF] transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    title="Delete job and documents"
                    aria-label="Delete job and documents"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1C1C1E]/50 p-4 backdrop-blur-sm"
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-[min(92dvh,820px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white shadow-2xl mx-2 sm:mx-4"
            >
              <div className="flex items-center justify-between border-b border-[#E5E5E0] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-[#1C1C1E]">
                    {preview.company} — {preview.kind === 'resume' ? 'Resume' : 'Cover Letter'}
                  </p>
                  <p className="text-xs font-normal text-[#6B6B6B]">{preview.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="rounded-lg p-2 text-[#6B6B6B] hover:bg-[#F5F5F0] hover:text-[#1C1C1E]"
                  aria-label="Close preview"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 bg-[#FAFAF8] p-2">
                {previewSrc ? (
                  <iframe
                    title="Document preview"
                    src={previewSrc}
                    className="h-full w-full rounded-lg border border-[#E5E5E0] bg-white"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#6B6B6B]">
                    Preview unavailable — run tailor again to generate HTML.
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
