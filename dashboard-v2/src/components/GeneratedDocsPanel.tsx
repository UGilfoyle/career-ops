'use client';

import { useMemo, useState } from 'react';
import {
  Segmented,
  Input,
  Card,
  Tag,
  Button,
  Popconfirm,
  Modal,
  Empty,
  Tooltip,
  Alert,
  Spin,
  message,
} from 'antd';
import {
  FileTextOutlined,
  SearchOutlined,
  DeleteOutlined,
  EyeOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  LoadingOutlined,
  EditOutlined,
  FileWordOutlined,
} from '@ant-design/icons';

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
        <Alert
          type="info"
          showIcon
          message={
            <div className="text-xs">
              <span className="font-semibold">{weekCount}</span> job
              {weekCount === 1 ? '' : 's'} with tailored documents this week.
              {onCopyStealthLink && (
                <span className="ml-1 text-zinc-500">
                  Tip: Copy stealth link from a resume card and paste as Portfolio / Website when applying.
                </span>
              )}
            </div>
          }
        />
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          options={[
            { label: 'All Documents', value: 'all' },
            { label: 'Resumes', value: 'resume' },
            { label: 'Cover Letters', value: 'cover' },
          ]}
          value={filter}
          onChange={(val) => setFilter(val as DocFilter)}
        />
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Search documents by company or role..."
            prefix={<SearchOutlined className="text-zinc-400" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
          />
        </div>
      </div>

      {pdfHint && (
        <Alert
          type="warning"
          message={pdfHint}
          closable
          onClose={() => setPdfHint(null)}
          showIcon
        />
      )}

      {/* Grid or Empty */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
          <Empty
            description={
              <div>
                <p className="text-sm font-semibold text-zinc-800">No documents found</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Run tailor on high-scoring jobs from the pipeline to generate tailored resumes and cover letters.
                </p>
              </div>
            }
          >
            <Button type="primary" icon={<RocketOutlined />} onClick={onOpenPipeline}>
              Open Job Pipeline
            </Button>
          </Empty>
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
              <Card
                key={card.cardKey}
                hoverable
                className="overflow-hidden border border-zinc-200/90 shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl bg-white"
                styles={{
                  body: { padding: 20 },
                }}
              >
                {/* Visual Realistic Document Mock (Clickable for Quick Preview) */}
                <div
                  onClick={() => canPreview && setPreview(card)}
                  className={`group relative mb-4 flex h-34 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-gradient-to-b from-zinc-50 to-zinc-100/70 p-2.5 transition-colors ${canPreview ? 'cursor-pointer hover:border-zinc-300' : ''}`}
                  title={canPreview ? 'Click to preview document' : undefined}
                >
                  <div className="w-[88%] h-full rounded-sm border border-zinc-200/90 bg-white p-2.5 shadow-xs flex flex-col justify-between overflow-hidden select-none transition-transform group-hover:scale-[1.01]">
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
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/10 opacity-0 transition-opacity backdrop-blur-[0.5px] group-hover:opacity-100">
                      <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-zinc-800 shadow-xs border border-zinc-200/80 flex items-center gap-1">
                        <EyeOutlined /> Quick Preview
                      </span>
                    </div>
                  )}
                </div>

                {/* Company & Role Details */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate text-[15px] font-bold text-zinc-900 tracking-tight" title={company}>{company}</div>
                      <Tooltip title="Rename company or role">
                        <button
                          type="button"
                          onClick={() => openEditModal(card)}
                          className="text-zinc-400 hover:text-zinc-700 transition-colors p-0.5 rounded cursor-pointer"
                        >
                          <EditOutlined className="text-xs" />
                        </button>
                      </Tooltip>
                    </div>
                    <div className="truncate text-xs font-medium text-zinc-500 mt-0.5" title={title}>{title}</div>
                    <div className="mt-1 text-[11px] text-zinc-400 font-medium">{formatDocDate(card.mtime)}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Tag color={isResume ? 'blue' : 'purple'} className="m-0 font-semibold text-[10px] rounded-md px-1.5 py-0.5">
                      {isResume ? 'Resume' : 'Cover Letter'}
                    </Tag>
                    {isResume && typeof jdAts === 'number' && jdAts > 0 ? (
                      <Tag
                        color={jdAts >= 90 ? 'success' : jdAts >= 70 ? 'warning' : 'error'}
                        className="m-0 font-bold text-[10px] rounded-md px-1.5 py-0.5"
                      >
                        JD ATS {jdAts}%
                      </Tag>
                    ) : isResume && typeof polish === 'number' && polish > 0 ? (
                      <Tag color="default" className="m-0 text-[10px] rounded-md px-1.5 py-0.5">
                        Polish {polish}/100
                      </Tag>
                    ) : null}
                  </div>
                </div>

                {/* Primary Download Buttons Row */}
                <div className="mt-4 flex items-center gap-2">
                  <Tooltip
                    title={
                      pdfUrl
                        ? "Download ATS-Optimized PDF · Verified single-column standard for applicant tracking systems"
                        : "PDF is generating or unavailable"
                    }
                    placement="top"
                  >
                    <span className="flex-1">
                      <Button
                        type="primary"
                        icon={
                          pdfBusyKey === card.cardKey ? (
                            <LoadingOutlined />
                          ) : (
                            <DownloadOutlined />
                          )
                        }
                        disabled={!pdfUrl || pdfBusyKey === card.cardKey}
                        onClick={() => void downloadPdf(card)}
                        className="w-full h-8.5 rounded-lg border-0 bg-zinc-900 font-semibold text-xs text-white shadow-xs hover:!bg-zinc-800 transition-all flex items-center justify-center gap-1.5"
                      >
                        {pdfBusyKey === card.cardKey ? 'Preparing…' : 'Download PDF'}
                      </Button>
                    </span>
                  </Tooltip>

                  {isResume && (
                    <Tooltip
                      title="Download Word DOCX · Fully editable Microsoft Word format with native styles and bullets"
                      placement="top"
                    >
                      <span className="flex-1">
                        <Button
                          icon={
                            docxBusyKey === card.cardKey ? (
                              <LoadingOutlined />
                            ) : (
                              <FileWordOutlined />
                            )
                          }
                          disabled={docxBusyKey === card.cardKey}
                          onClick={() => void downloadDocx(card)}
                          className="w-full h-8.5 rounded-lg border border-blue-200 bg-blue-50/80 font-semibold text-xs text-blue-700 shadow-xs hover:!bg-blue-100 hover:!border-blue-300 transition-all flex items-center justify-center gap-1.5"
                        >
                          {docxBusyKey === card.cardKey ? 'Preparing…' : 'Word DOCX'}
                        </Button>
                      </span>
                    </Tooltip>
                  )}
                </div>

                {/* Secondary Actions Toolbar Row */}
                <div className="mt-2.5 pt-2.5 flex items-center justify-between border-t border-zinc-100">
                  <div className="flex items-center gap-1.5">
                    <Tooltip title="Quick Preview · View formatted document in reader modal" placement="bottom">
                      <span>
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          disabled={!canPreview}
                          onClick={() => canPreview && setPreview(card)}
                          className="h-7.5 px-2.5 rounded-md text-xs font-medium text-zinc-600 bg-zinc-100/80 hover:!bg-zinc-200/90 border-0 flex items-center gap-1"
                        >
                          Preview
                        </Button>
                      </span>
                    </Tooltip>

                    {onOpenInStudio && (
                      <Tooltip title="Resume Studio · Open live editor to customize sections and layout" placement="bottom">
                        <Button
                          size="small"
                          icon={<ThunderboltOutlined />}
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
                          className="h-7.5 px-2.5 rounded-md text-xs font-medium text-zinc-600 bg-zinc-100/80 hover:!bg-zinc-200/90 border-0 flex items-center gap-1"
                        >
                          Studio
                        </Button>
                      </Tooltip>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isResume && onCopyStealthLink && (
                      <Tooltip title="Copy Stealth URL · Tracked link to paste as Portfolio / Website in applications" placement="bottom">
                        <Button
                          size="small"
                          icon={
                            stealthBusyJobId === id ? (
                              <LoadingOutlined />
                            ) : stealthCopiedJobId === id ? (
                              <CheckCircleOutlined className="text-emerald-600" />
                            ) : (
                              <LinkOutlined />
                            )
                          }
                          disabled={stealthBusyJobId === id}
                          onClick={() => void onCopyStealthLink(id)}
                          className="h-7.5 w-7.5 p-0 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 border border-zinc-200/80"
                        />
                      </Tooltip>
                    )}

                    <Tooltip title="Rename · Edit company name or role title" placement="bottom">
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => openEditModal(card)}
                        className="h-7.5 w-7.5 p-0 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 border border-zinc-200/80"
                      />
                    </Tooltip>

                    <Popconfirm
                      title="Delete document"
                      description={`Delete generated documents for ${company}?`}
                      okText="Delete"
                      okType="danger"
                      cancelText="Cancel"
                      onConfirm={() => onDelete(id, company, title)}
                    >
                      <Tooltip title="Delete · Remove this document" placement="bottom">
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          className="h-7.5 w-7.5 p-0 rounded-md flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 border border-zinc-200/80"
                        />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>
              </Card>
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
                  <Button
                    size="middle"
                    type="primary"
                    icon={pdfBusyKey === preview.cardKey ? <LoadingOutlined /> : <DownloadOutlined />}
                    disabled={pdfBusyKey === preview.cardKey}
                    onClick={() => void downloadPdf(preview)}
                  >
                    {pdfBusyKey === preview.cardKey ? 'Wait…' : 'PDF'}
                  </Button>
                )}
                {preview.kind === 'resume' && (
                  <Button
                    size="middle"
                    type="primary"
                    icon={docxBusyKey === preview.cardKey ? <LoadingOutlined /> : <DownloadOutlined />}
                    disabled={docxBusyKey === preview.cardKey}
                    onClick={() => void downloadDocx(preview)}
                  >
                    {docxBusyKey === preview.cardKey ? 'Wait…' : 'DOCX'}
                  </Button>
                )}
                <Button size="middle" onClick={() => setPreview(null)}>
                  Close
                </Button>
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
            <Input
              value={editCompany}
              onChange={(e) => setEditCompany(e.target.value)}
              placeholder="e.g. Google, Stripe, Bolt"
              onPressEnter={handleSaveDocEdit}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Job Title / Role
            </label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              onPressEnter={handleSaveDocEdit}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
