'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  ExternalLink,
  Trash2,
  Eye,
  Download,
  Mail,
} from 'lucide-react';

export type GeneratedDoc = {
  id: number | string;
  company?: string;
  title?: string;
  url?: string;
  mtime?: string;
  has_resume_pdf?: boolean;
  has_cover_letter_pdf?: boolean;
  has_resume_html?: boolean;
  has_cover_letter_html?: boolean;
};

type DocFilter = 'all' | 'resume' | 'cover';

type GeneratedDocsPanelProps = {
  docs: GeneratedDoc[];
  onDelete: (id: number, company: string, title: string) => void;
  onOpenPipeline: () => void;
};

function formatDocDate(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function docsThisWeek(docs: GeneratedDoc[]) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return docs.filter((d) => {
    if (!d.mtime) return false;
    const t = new Date(d.mtime).getTime();
    return !Number.isNaN(t) && t >= weekAgo;
  }).length;
}

export default function GeneratedDocsPanel({
  docs,
  onDelete,
  onOpenPipeline,
}: GeneratedDocsPanelProps) {
  const [filter, setFilter] = useState<DocFilter>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((doc) => {
      if (filter === 'resume' && !doc.has_resume_pdf && !doc.has_resume_html) return false;
      if (filter === 'cover' && !doc.has_cover_letter_pdf && !doc.has_cover_letter_html) return false;
      if (!q) return true;
      return (
        String(doc.company || '').toLowerCase().includes(q) ||
        String(doc.title || '').toLowerCase().includes(q)
      );
    });
  }, [docs, filter, query]);

  const weekCount = docsThisWeek(docs);

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
      className="space-y-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#1C1C1E]">Generated Documents</h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">Tailored outputs per application</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-[#E5E5E0] bg-[#F5F5F0] px-4 py-1.5 text-xs font-bold text-[#6B6B6B]">
          {docs.length} total
        </span>
      </div>

      {weekCount > 0 && (
        <div className="rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] px-5 py-4 text-sm text-[#6B6B6B]">
          <span className="font-bold text-[#1C1C1E]">{weekCount}</span> document
          {weekCount === 1 ? '' : 's'} generated this week
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
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
            className="w-full rounded-xl border border-[#E5E5E0] bg-white py-2.5 pl-10 pr-4 text-sm text-[#1C1C1E] outline-none placeholder:text-[#9CA3AF] focus:border-[#1C1C1E]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-[#E5E5E0] bg-[#FAFAF8] px-8 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F5F0]">
            <FileText size={28} className="text-[#9CA3AF]" />
          </div>
          <p className="text-base font-bold text-[#1C1C1E]">No documents yet</p>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            Run tailor on a high-scoring job from the pipeline to generate resumes and cover letters.
          </p>
          <button
            type="button"
            onClick={onOpenPipeline}
            className="mt-6 rounded-xl bg-[#1C1C1E] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#27272a]"
          >
            Open Job Pipeline →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => {
            const id = Number(doc.id);
            const company = doc.company || 'Unknown';
            const title = doc.title || 'Role';
            const hasResume = doc.has_resume_pdf || doc.has_resume_html;
            const hasCover = doc.has_cover_letter_pdf || doc.has_cover_letter_html;

            return (
              <article
                key={String(doc.id)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white transition-all hover:border-[#1C1C1E] hover:shadow-lg"
              >
                <div className="border-b border-[#F5F5F0] bg-gradient-to-r from-white to-[#FAFAF8] p-4">
                  <div className="mb-3 flex h-28 items-center justify-center rounded-xl border border-[#E5E5E0] bg-[#FAFAF8]">
                    <div className="text-center px-3">
                      <FileText size={24} className="mx-auto mb-2 text-[#9CA3AF]" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                        {hasResume && hasCover ? 'Resume + Cover' : hasResume ? 'Resume' : hasCover ? 'Cover Letter' : 'Document'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#1C1C1E]">{company}</p>
                      <p className="truncate text-xs text-[#6B6B6B]">{title}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-2 text-[#9CA3AF] transition-colors hover:bg-[#F5F5F0] hover:text-[#1C1C1E]"
                          title="Open job posting"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onDelete(id, company, title)}
                        className="rounded-lg p-2 text-[#9CA3AF] transition-colors hover:bg-rose-50 hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF]">
                    {formatDocDate(doc.mtime)}
                  </p>
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2 p-3">
                  <a
                    href={`/api/view/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E0] px-3 py-2.5 text-xs font-bold text-[#1C1C1E] transition-colors hover:border-[#1C1C1E] hover:bg-[#FAFAF8]"
                  >
                    <Eye size={14} />
                    Preview
                  </a>
                  {doc.has_resume_pdf ? (
                    <a
                      href={`/api/view/${doc.id}?format=pdf&download=1`}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#27272a]"
                    >
                      <Download size={14} />
                      PDF
                    </a>
                  ) : doc.has_cover_letter_pdf ? (
                    <a
                      href={`/api/view/${doc.id}?type=cl&format=pdf&download=1`}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-[#1C1C1E] px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#27272a]"
                    >
                      <Mail size={14} />
                      Cover PDF
                    </a>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5 rounded-xl bg-[#F5F5F0] px-3 py-2.5 text-xs font-bold text-[#9CA3AF]">
                      No PDF
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
