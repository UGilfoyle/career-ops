'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileCheck2, Loader2, Wand2 } from 'lucide-react';
import { fillAtsTemplate } from '@/lib/resume/fill-template';
import type { ResumeContext } from '@/lib/resume/types';
import { AiScoreBadge } from '../PageSectionHeader';

export type StudioDocKind = 'resume' | 'cover';

type JobReviewLiteProps = {
  draft: ResumeContext;
  jobId: number;
  company?: string;
  title?: string;
  pipelineScore?: string | number | null;
  atsContentScore?: number | null;
  /** JD keyword coverage on tailored resume (primary). */
  jdAlignmentScore?: number | null;
  hasResumeHtml?: boolean;
  hasResumePdf?: boolean;
  hasCoverHtml?: boolean;
  hasCoverPdf?: boolean;
  docKind?: StudioDocKind;
  onClose?: () => void;
  onDocsUpdated?: (next: {
    has_resume_html?: boolean;
    has_resume_pdf?: boolean;
    has_cover_letter_html?: boolean;
    has_cover_letter_pdf?: boolean;
  }) => void;
};

function tailoredPreviewUrl(
  jobId: number,
  kind: StudioDocKind,
  hasHtml?: boolean,
  hasPdf?: boolean
): string | null {
  if (kind === 'cover') {
    if (hasHtml) return `/api/view/${jobId}?type=cl`;
    if (hasPdf) return `/api/view/${jobId}?type=cl&format=pdf`;
    return null;
  }
  if (hasHtml) return `/api/view/${jobId}`;
  if (hasPdf) return `/api/view/${jobId}?format=pdf`;
  return null;
}

function tailoredDownloadUrl(jobId: number, kind: StudioDocKind, hasPdf?: boolean): string | null {
  if (!hasPdf) return null;
  if (kind === 'cover') return `/api/view/${jobId}?type=cl&format=pdf&download=1`;
  return `/api/view/${jobId}?format=pdf&download=1`;
}

/** Pull visible name from tailored HTML (h1 / sender-name / signature). */
function extractDocumentName(html: string): string | null {
  const patterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /class=["'][^"']*sender-name[^"']*["'][^>]*>([\s\S]*?)</i,
    /class=["'][^"']*signature-name[^"']*["'][^>]*>([\s\S]*?)</i,
    /<title>([\s\S]*?)<\/title>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (!m?.[1]) continue;
    let text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    text = text.replace(/\s*[-—]\s*Resume\s*$/i, '').replace(/\s*[-—]\s*Cover Letter\s*$/i, '').trim();
    if (text.length >= 2) return text;
  }
  return null;
}

function applyProfileName(html: string, correctName: string): { html: string; changed: boolean; from: string | null } {
  const from = extractDocumentName(html);
  if (!from || from === correctName) {
    // Also scrub common leftover test suffixes even if h1 already matches.
    const scrubbed = html
      .replace(/\s*\(\s*TEST\s*\)/gi, '')
      .replace(/\s*\(\s*Test\b[^)]*\)?/gi, '');
    if (scrubbed !== html) {
      return { html: scrubbed, changed: true, from: from || '(Test)' };
    }
    return { html, changed: false, from };
  }
  // Replace all plain-text occurrences of the baked name (h1, title, signature).
  const next = html.split(from).join(correctName);
  return { html: next, changed: next !== html, from };
}

export function JobReviewLite({
  draft,
  jobId,
  company,
  title,
  pipelineScore,
  atsContentScore,
  jdAlignmentScore,
  hasResumeHtml,
  hasResumePdf,
  hasCoverHtml,
  hasCoverPdf,
  docKind = 'resume',
  onClose,
  onDocsUpdated,
}: JobReviewLiteProps) {
  const isCover = docKind === 'cover';
  const [previewNonce, setPreviewNonce] = useState(0);
  const [fixingName, setFixingName] = useState(false);
  const [fixMsg, setFixMsg] = useState<string | null>(null);
  const [localHasCoverHtml, setLocalHasCoverHtml] = useState(Boolean(hasCoverHtml));
  const [localHasCoverPdf, setLocalHasCoverPdf] = useState(Boolean(hasCoverPdf));
  const [localHasResumeHtml, setLocalHasResumeHtml] = useState(Boolean(hasResumeHtml));
  const [localHasResumePdf, setLocalHasResumePdf] = useState(Boolean(hasResumePdf));

  useEffect(() => {
    setLocalHasCoverHtml(Boolean(hasCoverHtml));
    setLocalHasCoverPdf(Boolean(hasCoverPdf));
    setLocalHasResumeHtml(Boolean(hasResumeHtml));
    setLocalHasResumePdf(Boolean(hasResumePdf));
  }, [hasCoverHtml, hasCoverPdf, hasResumeHtml, hasResumePdf, jobId]);

  const masterHtml = useMemo(() => fillAtsTemplate(draft), [draft]);
  const hasHtml = isCover ? localHasCoverHtml : localHasResumeHtml;
  const hasPdf = isCover ? localHasCoverPdf : localHasResumePdf;
  const tailoredUrl = tailoredPreviewUrl(jobId, docKind, hasHtml, hasPdf);
  const pdfUrl = tailoredDownloadUrl(jobId, docKind, hasPdf);
  const hasSavedDoc = Boolean(hasHtml || hasPdf);
  const profileName = String(draft.candidate?.full_name || '').trim();

  const previewSrc = tailoredUrl
    ? `${tailoredUrl}${tailoredUrl.includes('?') ? '&' : '?'}v=${previewNonce}`
    : null;

  const fixNameFromProfile = useCallback(async () => {
    if (!profileName) {
      setFixMsg('Set your full name in Edit Master Resume → Personal Info first.');
      return;
    }
    setFixingName(true);
    setFixMsg(null);
    try {
      const res = await fetch(`/api/job/${jobId}/docs`, { credentials: 'same-origin' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Load failed (${res.status})`);

      const field = isCover ? 'cover_letter_html' : 'resume_html';
      const currentHtml = String(json?.[field] || '');
      if (!currentHtml) {
        setFixMsg(`No saved ${isCover ? 'cover letter' : 'resume'} HTML for this job.`);
        return;
      }

      const { html, changed, from } = applyProfileName(currentHtml, profileName);
      if (!changed) {
        setFixMsg(`Name already matches profile (${profileName}).`);
        return;
      }

      const patch = await fetch(`/api/job/${jobId}/docs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          [field]: html,
          invalidate_pdfs: true,
        }),
      });
      const patchJson = await patch.json().catch(() => ({}));
      if (!patch.ok) throw new Error(patchJson?.error || `Save failed (${patch.status})`);

      if (isCover) {
        setLocalHasCoverHtml(true);
        setLocalHasCoverPdf(false);
        onDocsUpdated?.({
          has_cover_letter_html: true,
          has_cover_letter_pdf: false,
        });
      } else {
        setLocalHasResumeHtml(true);
        setLocalHasResumePdf(false);
        onDocsUpdated?.({
          has_resume_html: true,
          has_resume_pdf: false,
        });
      }
      setPreviewNonce((n) => n + 1);
      setFixMsg(
        `Updated “${from || 'old name'}” → “${profileName}”. PDF cleared — run tailor --deep to regenerate PDF.`
      );
    } catch (e: unknown) {
      setFixMsg(e instanceof Error ? e.message : 'Failed to fix name');
    } finally {
      setFixingName(false);
    }
  }, [profileName, jobId, isCover, onDocsUpdated]);

  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E0] bg-[#FAFAF8] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
            Per-job review · {isCover ? 'Cover letter' : 'Resume'}
          </div>
          <h4 className="truncate text-sm font-bold text-[#1C1C1E]">
            {company || 'Company'} — {title || 'Role'}
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AiScoreBadge score={pipelineScore} />
          {jdAlignmentScore != null ? (
            <span
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold ${
                jdAlignmentScore >= 94
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : jdAlignmentScore >= 75
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-red-200 bg-red-50 text-red-800'
              }`}
              title="JD keywords present in tailored resume (target 94%+)"
            >
              JD ATS {jdAlignmentScore}%
            </span>
          ) : atsContentScore != null ? (
            <span
              className="rounded-full border border-[#E5E5E0] bg-white px-2.5 py-1 font-mono text-[10px] font-bold text-[#6B6B6B]"
              title="Writing polish only — not JD keyword coverage"
            >
              Polish {atsContentScore}/100
            </span>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] hover:text-[#1C1C1E]"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      {hasSavedDoc ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-900">
            <FileCheck2 size={14} />
            {isCover
              ? 'Saved cover letter — loaded from storage'
              : 'Saved tailored resume — loaded from storage (no re-tailor needed)'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={fixingName || !hasHtml}
              onClick={() => void fixNameFromProfile()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-900 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Replace baked name in this document with Personal Info full name"
            >
              {fixingName ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Fix name
            </button>
            {pdfUrl ? (
              <a
                href={pdfUrl}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-900 hover:bg-emerald-100"
              >
                <Download size={12} />
                PDF
              </a>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          No saved {isCover ? 'cover letter' : 'document'} yet — run tailor once for this job.
        </div>
      )}

      {fixMsg ? (
        <div className="border-b border-[#E5E5E0] bg-[#FAFAF8] px-4 py-2 text-xs font-medium text-[#1C1C1E]">
          {fixMsg}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-[#E5E5E0] md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="flex min-h-[240px] flex-col sm:min-h-[280px]">
          <div className="border-b border-[#F5F5F0] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
            {isCover
              ? `Master resume name source (${draft.studio?.template_id || 'ats-professional'})`
              : `Master (${draft.studio?.template_id || 'ats-professional'})`}
          </div>
          <iframe title="Master preview" srcDoc={masterHtml} className="w-full flex-1 border-0 bg-white" sandbox="" />
        </div>
        <div className="flex min-h-[240px] flex-col sm:min-h-[280px]">
          <div className="border-b border-[#F5F5F0] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
            {isCover ? 'Cover letter (saved)' : 'Tailored output (saved)'}
          </div>
          {previewSrc ? (
            <iframe
              title={isCover ? 'Tailored cover letter' : 'Tailored resume'}
              src={previewSrc}
              className="w-full flex-1 border-0 bg-white"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-[#6B6B6B]">
              {isCover
                ? 'Cover letter not found in storage. Run tailor once from Terminal or JD Matcher.'
                : 'Document not found in storage. Run tailor once from Terminal or JD Matcher.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
