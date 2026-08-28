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
  if (doc.kind === 'cover' && doc.has_cover_letter_pdf) {
    return `/api/view/${doc.id}?type=cl&format=pdf&download=1`;
  }
  if (doc.kind === 'resume' && doc.has_resume_pdf) {
    return `/api/view/${doc.id}?format=pdf&download=1`;
  }
  return null;
}

export default function GeneratedDocsPanel({
  docs,
  onDelete,
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                className="overflow-hidden border border-zinc-200 shadow-xs"
                styles={{
                  body: { padding: 16 },
                }}
              >
                {/* Visual Realistic Document Mock */}
                <div className="mb-3.5 flex h-32 items-center justify-center overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-100/60 p-2">
                  <div className="w-[85%] h-full rounded-sm border border-zinc-200 bg-white p-2.5 shadow-xs flex flex-col justify-between overflow-hidden select-none">
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
                            <span className="bg-zinc-100 px-0.8 py-0.2 rounded text-[5px] font-mono text-zinc-700">Next.js</span>
                            <span className="bg-zinc-100 px-0.8 py-0.2 rounded text-[5px] font-mono text-zinc-700">TypeScript</span>
                            <span className="bg-zinc-100 px-0.8 py-0.2 rounded text-[5px] font-mono text-zinc-700">PostgreSQL</span>
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
                </div>

                {/* Company & Role Details */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-zinc-900">{company}</div>
                    <div className="truncate text-xs text-zinc-500">{title}</div>
                    <div className="mt-1 text-[11px] text-zinc-400">{formatDocDate(card.mtime)}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Tag color={isResume ? 'blue' : 'purple'} className="font-semibold text-[10px]">
                      {isResume ? 'Resume' : 'Cover Letter'}
                    </Tag>
                    {isResume && typeof jdAts === 'number' && jdAts > 0 ? (
                      <Tag
                        color={jdAts >= 90 ? 'success' : jdAts >= 70 ? 'warning' : 'error'}
                        className="font-bold text-[10px]"
                      >
                        JD ATS {jdAts}%
                      </Tag>
                    ) : isResume && typeof polish === 'number' && polish > 0 ? (
                      <Tag color="default" className="text-[10px]">
                        Polish {polish}/100
                      </Tag>
                    ) : null}
                  </div>
                </div>

                {/* Action Buttons Toolbar */}
                <div className="mt-4 flex items-center gap-1.5 border-t border-zinc-100 pt-3">
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    disabled={!canPreview}
                    onClick={() => canPreview && setPreview(card)}
                    className="flex-1"
                  >
                    Preview
                  </Button>

                  {onOpenInStudio && (
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
                      className="flex-1"
                    >
                      Studio
                    </Button>
                  )}

                  {pdfUrl ? (
                    <Button
                      size="small"
                      type="primary"
                      icon={
                        pdfBusyKey === card.cardKey ? (
                          <LoadingOutlined />
                        ) : (
                          <DownloadOutlined />
                        )
                      }
                      disabled={pdfBusyKey === card.cardKey}
                      onClick={() => void downloadPdf(card)}
                      className="flex-1"
                    >
                      {pdfBusyKey === card.cardKey ? 'Wait…' : 'PDF'}
                    </Button>
                  ) : (
                    <Button size="small" disabled className="flex-1">
                      PDF
                    </Button>
                  )}

                  {isResume && onCopyStealthLink && (
                    <Tooltip title="Copy stealth tracking URL">
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
                      />
                    </Tooltip>
                  )}

                  <Popconfirm
                    title="Delete document"
                    description={`Delete generated documents for ${company}?`}
                    okText="Delete"
                    okType="danger"
                    cancelText="Cancel"
                    onConfirm={() => onDelete(id, company, title)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
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
        footer={null}
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
    </div>
  );
}
