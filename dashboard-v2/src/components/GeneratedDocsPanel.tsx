'use client';

import { useMemo, useState } from 'react';
import { Modal, message } from 'antd';
import {
  FileText,
  Search,
  Trash2,
  Eye,
  Download,
  Zap,
  Link2,
  Check,
  Loader2,
  Edit3,
  Rocket,
  X,
  FileCheck,
  Sparkles,
  Info,
  ExternalLink,
} from 'lucide-react';

export type GeneratedDoc = {
  id: number | string;
  company?: string;
  title?: string;
  url?: string;
  mtime?: string;
  ats_content_score?: number | null;
  /** JD keyword coverage in the tailored resume (primary ATS signal). */
  jd_alignment_score?: number | null;
  has_resume_pdf?: boolean;
  has_cover_letter_pdf?: boolean;
  has_resume_html?: boolean;
  has_cover_letter_html?: boolean;
  /** Set when opening Studio from a resume vs cover letter card. */
  kind?: 'resume' | 'cover';
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
  onDocUpdated?: (id: number, company: string, title: string) => void;
  onOpenPipeline: () => void;
  onOpenInStudio?: (doc: GeneratedDoc) => void;
  /** Copy stealth track link for this job (works before Applied). */
  onCopyStealthLink?: (jobId: number) => void | Promise<void>;
  stealthBusyJobId?: number | null;
  stealthCopiedJobId?: number | null;
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
  onDocUpdated,
  onOpenPipeline,
  onOpenInStudio,
  onCopyStealthLink,
  stealthBusyJobId = null,
  stealthCopiedJobId = null,
}: GeneratedDocsPanelProps) {
  const [filter, setFilter] = useState<DocFilter>('all');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState<DocCard | null>(null);
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null);
  const [pdfHint, setPdfHint] = useState<string | null>(null);
  const [docxBusyKey, setDocxBusyKey] = useState<string | null>(null);

  // Edit document details state
  const [editingCard, setEditingCard] = useState<DocCard | null>(null);
  const [editCompany, setEditCompany] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Record<string, { company: string; title: string }>>({});

  // Single confirmation modal for deleting
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; company: string; title: string } | null>(null);

  function openEditModal(card: DocCard) {
    setEditingCard(card);
    setEditCompany(card.company || '');
    setEditTitle(card.title || '');
  }

  async function handleSaveDocEdit() {
    if (!editingCard) return;
    const trimmedCompany = editCompany.trim();
    const trimmedTitle = editTitle.trim();

    if (!trimmedCompany && !trimmedTitle) {
      message.error('Please enter at least a company name or job title');
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/job/${editingCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: trimmedCompany || undefined,
          title: trimmedTitle || undefined,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData?.error || 'Failed to update document details');
      }

      const nextCompany = trimmedCompany || editingCard.company || '';
      const nextTitle = trimmedTitle || editingCard.title || '';

      // Instant optimistic state update
      setLocalOverrides((prev) => ({
        ...prev,
        [String(editingCard.id)]: {
          company: nextCompany,
          title: nextTitle,
        },
      }));

      onDocUpdated?.(Number(editingCard.id), nextCompany, nextTitle);

      message.success('Document details updated');
      setEditingCard(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update document';
      message.error(msg);
    } finally {
      setSavingEdit(false);
    }
  }

  async function downloadPdf(card: DocCard) {
    const url = pdfDownloadUrl(card);
    if (!url) return;
    setPdfBusyKey(card.cardKey);
    setPdfHint(null);
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      const contentType = res.headers.get('content-type') || '';

      if (res.status === 202 || (res.ok && contentType.includes('text/'))) {
        const msg = (await res.text()).trim();
        setPdfHint(msg || 'PDF still generating — wait ~30s and try again.');
        return;
      }

      if (!res.ok) {
        const msg = (await res.text()).trim();
        setPdfHint(msg || `PDF failed (${res.status})`);
        return;
      }

      if (!contentType.includes('application/pdf')) {
        const msg = (await res.text()).trim();
        setPdfHint(msg || 'Unexpected response — try again in a moment.');
        return;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${(card.company || 'resume').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_')}_${card.kind === 'cover' ? 'cover' : 'resume'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setPdfHint(null);
    } catch (e: unknown) {
      setPdfHint(e instanceof Error ? e.message : 'PDF download failed');
    } finally {
      setPdfBusyKey(null);
    }
  }

  async function downloadDocx(card: DocCard) {
    if (card.kind !== 'resume') return;
    const url = `/api/job/${card.id}/resume-docx`;
    setDocxBusyKey(card.cardKey);
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) {
        const msg = (await res.text()).trim();
        message.error(msg || `DOCX download failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      const safeCompany = (card.company || 'Resume').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
      const safeTitle = (card.title || '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_');
      a.download = safeTitle ? `${safeCompany}_${safeTitle}_Resume.docx` : `${safeCompany}_Resume.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      message.success('DOCX downloaded');
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'DOCX download failed');
    } finally {
      setDocxBusyKey(null);
    }
  }

  const allCards = useMemo(() => {
    const base = expandToDocCards(docs);
    if (Object.keys(localOverrides).length === 0) return base;
    return base.map((card) => {
      const override = localOverrides[String(card.id)];
      if (!override) return card;
      return {
        ...card,
        company: override.company,
        title: override.title,
      };
    });
  }, [docs, localOverrides]);

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

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      {weekCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/70 p-3.5 px-4.5 text-xs text-blue-900 shadow-xs">
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
          <div className="flex-1 leading-relaxed">
            <span className="font-bold text-blue-950">{weekCount}</span> job
            {weekCount === 1 ? '' : 's'} with tailored documents this week.
            {onCopyStealthLink && (
              <span className="ml-1.5 text-blue-700/80">
                Tip: Copy stealth link from a resume card and paste as Portfolio / Website when applying.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter & Search Bar - Origin UI Segmented Controls */}
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl bg-zinc-100/90 p-1 border border-zinc-200/70 shadow-xs">
          {(['all', 'resume', 'cover'] as const).map((key) => {
            const active = filter === key;
            const label = key === 'all' ? 'All Documents' : key === 'resume' ? 'Resumes' : 'Cover Letters';
            const count = key === 'all' ? allCards.length : allCards.filter(c => c.kind === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                  active
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
                }`}
              >
                <span>{label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                  active ? 'bg-zinc-100 text-zinc-800' : 'bg-zinc-200/70 text-zinc-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search documents by company or role..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9.5 pl-9 pr-8 text-xs font-medium rounded-xl border border-zinc-200/90 bg-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {pdfHint && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-3 px-4 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-600" />
            <span>{pdfHint}</span>
          </div>
          <button
            type="button"
            onClick={() => setPdfHint(null)}
            className="text-amber-700 hover:text-amber-950 p-1 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Grid or Empty */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
          <Rocket className="mx-auto h-8 w-8 text-zinc-400 mb-3" />
          <p className="text-sm font-semibold text-zinc-800">No documents found</p>
          <p className="mt-1 text-xs text-zinc-500 max-w-md mx-auto">
            {query
              ? `No tailored documents match "${query}". Try searching for another company or role.`
              : 'Run tailor on high-scoring jobs from the pipeline to generate tailored resumes and cover letters.'}
          </p>
          <button
            type="button"
            onClick={onOpenPipeline}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Rocket className="h-3.5 w-3.5" /> Open Job Pipeline
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
            const canPreview = Boolean(previewUrl(card));
            const jdAts = card.jd_alignment_score;
            const polish = card.ats_content_score;

            return (
              <div
                key={card.cardKey}
                className="group/card flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/85 bg-white p-5 shadow-xs hover:border-zinc-300 hover:shadow-md transition-all duration-200"
              >
                <div>
                  {/* Visual Realistic Document Mock (Clickable for Quick Preview) */}
                  <div
                    onClick={() => canPreview && setPreview(card)}
                    className={`group/mock relative mb-4 flex h-34 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-gradient-to-b from-zinc-50 to-zinc-100/70 p-2.5 transition-colors ${
                      canPreview ? 'cursor-pointer hover:border-zinc-300' : ''
                    }`}
                  >
                    <div className="w-[88%] h-full rounded-sm border border-zinc-200/90 bg-white p-2.5 shadow-xs flex flex-col justify-between overflow-hidden select-none transition-transform group-hover/mock:scale-[1.01]">
                      {/* Header */}
                      <div className="border-b border-zinc-200 pb-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[8px] tracking-wider text-zinc-900 uppercase truncate">
                            {company} — {isResume ? 'RESUME' : 'COVER LETTER'}
                          </span>
                          <span className="text-[6px] font-mono text-zinc-400">ATS 100%</span>
                        </div>
                        <div className="text-[6px] text-zinc-500 truncate mt-0.5">
                          {title} · Verified ATS Optimized Single-Column
                        </div>
                      </div>

                      {/* Content Section */}
                      {isResume ? (
                        <div className="py-1 space-y-1">
                          <div>
                            <div className="text-[6px] font-bold uppercase tracking-wider text-zinc-700">Experience</div>
                            <div className="text-[5.5px] text-zinc-500 truncate leading-tight">
                              • Delivered core backend features with 99.9% uptime SLA.
                            </div>
                          </div>
                          <div>
                            <div className="text-[6px] font-bold uppercase tracking-wider text-zinc-700">Skills</div>
                            <div className="flex gap-1 flex-wrap">
                              <span className="bg-zinc-100 px-1 py-0.2 rounded text-[5px] font-mono text-zinc-700">Next.js</span>
                              <span className="bg-zinc-100 px-1 py-0.2 rounded text-[5px] font-mono text-zinc-700">TypeScript</span>
                              <span className="bg-zinc-100 px-1 py-0.2 rounded text-[5px] font-mono text-zinc-700">PostgreSQL</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-1 space-y-1 font-serif">
                          <div className="text-[6px] italic text-zinc-600">
                            Dear Hiring Team at {company},
                          </div>
                          <div className="text-[5.5px] text-zinc-500 leading-tight line-clamp-2">
                            I am writing to express my strong enthusiasm for the {title} role. With hands-on engineering background...
                          </div>
                          <div className="text-[5.5px] font-sans font-semibold text-zinc-800">
                            Sincerely, Candidate
                          </div>
                        </div>
                      )}

                      {/* Footer bar */}
                      <div className="border-t border-zinc-100 pt-0.5 flex justify-between items-center text-[5.5px] font-mono text-zinc-400">
                        <span>{isResume ? 'PDF / ATS FORMAT' : 'OFFICIAL LETTER'}</span>
                        <span>PAGE 1 OF 1</span>
                      </div>
                    </div>

                    {canPreview && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/10 opacity-0 transition-opacity backdrop-blur-[0.5px] group-hover/mock:opacity-100">
                        <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-zinc-800 shadow-xs border border-zinc-200/80 flex items-center gap-1.5">
                          <Eye className="h-3 w-3" /> Quick Preview
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Company & Role Details */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate text-[15px] font-bold text-zinc-900 tracking-tight" title={company}>{company}</div>
                        <div className="relative group/edit">
                          <button
                            type="button"
                            onClick={() => openEditModal(card)}
                            className="text-zinc-400 hover:text-zinc-700 transition-colors p-0.5 rounded cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/edit:flex items-center px-2 py-0.8 text-[10px] font-medium text-white bg-zinc-900 rounded shadow-md whitespace-nowrap z-50">
                            Rename company or role
                          </div>
                        </div>
                      </div>
                      <div className="truncate text-xs font-medium text-zinc-500 mt-0.5" title={title}>{title}</div>
                      <div className="mt-1 text-[11px] text-zinc-400 font-medium">{formatDocDate(card.mtime)}</div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                        isResume 
                          ? 'bg-blue-50 text-blue-700 border-blue-200/70' 
                          : 'bg-purple-50 text-purple-700 border-purple-200/70'
                      }`}>
                        {isResume ? 'Resume' : 'Cover Letter'}
                      </span>
                      {isResume && typeof jdAts === 'number' && jdAts > 0 ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          jdAts >= 90
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                            : jdAts >= 70
                            ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                            : 'bg-rose-50 text-rose-700 border-rose-200/70'
                        }`}>
                          JD ATS {jdAts}%
                        </span>
                      ) : isResume && typeof polish === 'number' && polish > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/70">
                          Polish {polish}/100
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Section */}
                <div className="mt-4 pt-3 border-t border-zinc-100">
                  {/* Primary Download Buttons Row */}
                  <div className="flex items-center gap-2">
                    <div className="relative group/pdf flex-1">
                      <button
                        type="button"
                        disabled={!pdfUrl || pdfBusyKey === card.cardKey}
                        onClick={() => void downloadPdf(card)}
                        className={`w-full h-8.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                          !pdfUrl || pdfBusyKey === card.cardKey
                            ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                            : 'bg-zinc-900 hover:bg-zinc-800 text-white active:bg-zinc-950'
                        }`}
                      >
                        {pdfBusyKey === card.cardKey ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing…
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" /> Download PDF
                          </>
                        )}
                      </button>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/pdf:flex items-center px-2.5 py-1 text-[11px] font-medium text-white bg-zinc-900 rounded-md shadow-md whitespace-nowrap z-50">
                        {pdfUrl
                          ? 'Download ATS-Optimized PDF · Verified single-column standard for applicant tracking systems'
                          : 'PDF is generating or unavailable'}
                      </div>
                    </div>

                    {isResume && (
                      <div className="relative group/docx flex-1">
                        <button
                          type="button"
                          disabled={docxBusyKey === card.cardKey}
                          onClick={() => void downloadDocx(card)}
                          className={`w-full h-8.5 rounded-lg border font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                            docxBusyKey === card.cardKey
                              ? 'bg-blue-50 text-blue-300 border-blue-100 cursor-not-allowed'
                              : 'bg-blue-50/80 hover:bg-blue-100/90 text-blue-700 border-blue-200 active:bg-blue-200/80'
                          }`}
                        >
                          {docxBusyKey === card.cardKey ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing…
                            </>
                          ) : (
                            <>
                              <FileText className="h-3.5 w-3.5" /> Word DOCX
                            </>
                          )}
                        </button>
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/docx:flex items-center px-2.5 py-1 text-[11px] font-medium text-white bg-zinc-900 rounded-md shadow-md whitespace-nowrap z-50">
                          Download Word DOCX · Fully editable Microsoft Word format with native styles and bullets
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Secondary Actions Toolbar Row */}
                  <div className="mt-2.5 pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="relative group/prev">
                        <button
                          type="button"
                          disabled={!canPreview}
                          onClick={() => canPreview && setPreview(card)}
                          className={`h-7.5 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                            !canPreview
                              ? 'text-zinc-300 bg-zinc-50 cursor-not-allowed'
                              : 'text-zinc-600 bg-zinc-100 hover:bg-zinc-200/80 hover:text-zinc-900 active:bg-zinc-200'
                          }`}
                        >
                          <Eye className="h-3 w-3" /> Preview
                        </button>
                        <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/prev:flex items-center px-2 py-0.8 text-[10px] font-medium text-white bg-zinc-900 rounded shadow-md whitespace-nowrap z-50">
                          Quick Preview · View formatted document in reader modal
                        </div>
                      </div>

                      {onOpenInStudio && (
                        <div className="relative group/std">
                          <button
                            type="button"
                            onClick={() =>
                              onOpenInStudio({
                                id: card.id,
                                company: card.company,
                                title: card.title,
                                ats_content_score: card.ats_content_score,
                                jd_alignment_score: card.jd_alignment_score,
                                has_resume_html: card.has_resume_html,
                                has_resume_pdf: card.has_resume_pdf,
                                has_cover_letter_html: card.has_cover_letter_html,
                                has_cover_letter_pdf: card.has_cover_letter_pdf,
                                mtime: card.mtime,
                                url: card.url,
                                kind: card.kind,
                              })
                            }
                            className="h-7.5 px-2.5 rounded-md text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200/80 hover:text-zinc-900 active:bg-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Zap className="h-3 w-3" /> Studio
                          </button>
                          <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/std:flex items-center px-2 py-0.8 text-[10px] font-medium text-white bg-zinc-900 rounded shadow-md whitespace-nowrap z-50">
                            Resume Studio · Open live editor to customize sections and layout
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {isResume && onCopyStealthLink && (
                        <div className="relative group/stealth">
                          <button
                            type="button"
                            disabled={stealthBusyJobId === id}
                            onClick={() => void onCopyStealthLink(id)}
                            className="h-7.5 w-7.5 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200/80 transition-colors cursor-pointer"
                          >
                            {stealthBusyJobId === id ? (
                              <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                            ) : stealthCopiedJobId === id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Link2 className="h-3 w-3" />
                            )}
                          </button>
                          <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover/stealth:flex items-center px-2 py-0.8 text-[10px] font-medium text-white bg-zinc-900 rounded shadow-md whitespace-nowrap z-50">
                            Copy Stealth URL · Tracked link to paste in job applications
                          </div>
                        </div>
                      )}

                      <div className="relative group/editbtn">
                        <button
                          type="button"
                          onClick={() => openEditModal(card)}
                          className="h-7.5 w-7.5 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200/80 transition-colors cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover/editbtn:flex items-center px-2 py-0.8 text-[10px] font-medium text-white bg-zinc-900 rounded shadow-md whitespace-nowrap z-50">
                          Rename · Edit company name or role title
                        </div>
                      </div>

                      <div className="relative group/del">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id, company, title })}
                          className="h-7.5 w-7.5 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-600 hover:bg-red-50 border border-zinc-200/80 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover/del:flex items-center px-2 py-0.8 text-[10px] font-medium text-white bg-zinc-900 rounded shadow-md whitespace-nowrap z-50">
                          Delete · Remove this document
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        open={Boolean(preview)}
        onCancel={() => setPreview(null)}
        footer={
          preview ? (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-zinc-400">
                {preview.kind === 'resume' ? 'ATS-Optimized Resume Export' : 'Tailored Cover Letter'}
              </span>
              <div className="flex items-center gap-2">
                {pdfDownloadUrl(preview) && (
                  <button
                    type="button"
                    disabled={pdfBusyKey === preview.cardKey}
                    onClick={() => void downloadPdf(preview)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {pdfBusyKey === preview.cardKey ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Preparing…
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" /> Download PDF
                      </>
                    )}
                  </button>
                )}
                {preview.kind === 'resume' && (
                  <button
                    type="button"
                    disabled={docxBusyKey === preview.cardKey}
                    onClick={() => void downloadDocx(preview)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    {docxBusyKey === preview.cardKey ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Preparing…
                      </>
                    ) : (
                      <>
                        <FileText className="h-3 w-3" /> Word DOCX
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-medium shadow-xs transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null
        }
        width={900}
        destroyOnClose
        centered
        title={
          preview ? (
            <div>
              <span className="font-bold text-zinc-900">{preview.company}</span> —{' '}
              <span className="text-zinc-500">{preview.kind === 'resume' ? 'Tailored Resume' : 'Cover Letter'}</span>
              <div className="text-xs font-normal text-zinc-400">{preview.title}</div>
            </div>
          ) : null
        }
      >
        <div className="h-[75vh] w-full bg-zinc-50 p-2 rounded-xl">
          {previewSrc ? (
            <iframe
              title="Document preview"
              src={previewSrc}
              className="h-full w-full rounded-lg border border-zinc-200 bg-white"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Preview unavailable — run tailor again to generate HTML.
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Document Details Modal */}
      <Modal
        open={Boolean(editingCard)}
        title="Edit Document Details"
        onCancel={() => {
          if (!savingEdit) {
            setEditingCard(null);
          }
        }}
        onOk={handleSaveDocEdit}
        okText="Save Changes"
        confirmLoading={savingEdit}
        destroyOnClose
        centered
      >
        <div className="py-2 space-y-4">
          <p className="text-xs text-zinc-500">
            Rename the company and role for this job. All generated resumes, cover letters, and search indexing will update automatically.
          </p>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              value={editCompany}
              onChange={(e) => setEditCompany(e.target.value)}
              placeholder="e.g. Google, Stripe, Bolt"
              onKeyDown={(e) => e.key === 'Enter' && void handleSaveDocEdit()}
              autoFocus
              className="w-full h-9 px-3 text-xs font-medium rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Job Title / Role
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              onKeyDown={(e) => e.key === 'Enter' && void handleSaveDocEdit()}
              className="w-full h-9 px-3 text-xs font-medium rounded-lg border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Generated Document"
        onCancel={() => setDeleteTarget(null)}
        onOk={() => {
          if (deleteTarget) {
            onDelete(deleteTarget.id, deleteTarget.company, deleteTarget.title);
            setDeleteTarget(null);
          }
        }}
        okText="Delete"
        okButtonProps={{ danger: true }}
        centered
      >
        <div className="py-2">
          <p className="text-xs text-zinc-600 leading-relaxed">
            Are you sure you want to delete the tailored documents for{' '}
            <strong className="text-zinc-900">{deleteTarget?.company}</strong> ({deleteTarget?.title})? This will permanently remove the tailored resume and cover letter.
          </p>
        </div>
      </Modal>
    </div>
  );
}
