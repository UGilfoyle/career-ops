'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Files, Sparkles } from 'lucide-react';
import { SectionAccordion } from './SectionAccordion';
import { StudioToolbar } from './StudioToolbar';
import { LivePreview } from './LivePreview';
import { TemplateGallery } from './TemplateGallery';
import { JdMatchPanel, type PipelineJobOption } from './JdMatchPanel';
import { JobReviewLite } from './JobReviewLite';
import { CoverLetterEditor } from './CoverLetterEditor';
import { PersonalInfoSection } from './sections/PersonalInfoSection';
import { SummarySection } from './sections/SummarySection';
import { CompetenciesSection } from './sections/CompetenciesSection';
import { ExperienceSection } from './sections/ExperienceSection';
import { EducationSection } from './sections/EducationSection';
import { useResumeStudioStore } from './useResumeStudioStore';
import { getTemplateMeta } from '@/lib/resume/ats-professional-template';
import { parseResumeForExport, validateResumeDraft } from '@/lib/resume/schema';
import { getCompetencies, type ResumeContext } from '@/lib/resume/types';
import { fillAtsTemplate } from '@/lib/resume/fill-template';
import { parseTailoredResumeHtml } from '@/lib/resume/parse-tailored-html';

type ResumeStudioProps = {
  initialProfile?: ResumeContext | null;
  onProfileSaved?: (ctx: ResumeContext) => void;
  onOpenGeneratedDocs?: () => void;
  pipeline?: PipelineJobOption[];
  onTailorJob?: (jobId: number) => void;
  initialJobId?: number | null;
  reviewJob?: {
    jobId: number;
    company?: string;
    title?: string;
    score?: string | number | null;
    ats_content_score?: number | null;
    jd_alignment_score?: number | null;
    has_resume_html?: boolean;
    has_resume_pdf?: boolean;
    has_cover_letter_html?: boolean;
    has_cover_letter_pdf?: boolean;
    docKind?: 'resume' | 'cover';
  } | null;
  onClearReviewJob?: () => void;
  /** After Save writes this job's resume HTML, PDF, and ATS scores. */
  onJobResumePublished?: (
    jobId: number,
    scores?: {
      jd_alignment_score?: number | null;
      ats_content_score?: number | null;
      has_resume_pdf?: boolean;
    }
  ) => void;
};

async function saveResumeContext(draft: ResumeContext) {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resume_context: {
        ...draft,
        studio: { template_id: draft.studio?.template_id || 'ats-professional' },
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Failed to save resume');
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResumeStudio({
  initialProfile,
  onProfileSaved,
  onOpenGeneratedDocs,
  pipeline = [],
  onTailorJob,
  initialJobId = null,
  reviewJob = null,
  onClearReviewJob,
  onJobResumePublished,
}: ResumeStudioProps) {
  const [zoom, setZoom] = useState(100);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [publishingJob, setPublishingJob] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(initialJobId ?? reviewJob?.jobId ?? null);
  const [leftTab, setLeftTab] = useState<'jd' | 'editor' | 'cover'>(
    reviewJob?.docKind === 'cover' ? 'cover' : 'editor'
  );
  const [coverPreviewHtml, setCoverPreviewHtml] = useState<string | null>(null);
  const [liveAts, setLiveAts] = useState<{ score: number | null; source: 'jd' | 'structure' }>({
    score: null,
    source: 'structure',
  });
  const [previewMode, setPreviewMode] = useState<'master' | 'tailored'>('master');
  const [activeJdText, setActiveJdText] = useState<string>('');
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const editingJobIdRef = useRef<number | null>(null);
  const masterSnapshotRef = useRef<ResumeContext | null>(null);

  const selectedPipelineJob = useMemo(
    () => pipeline.find((j) => Number(j.pipeline_id ?? j.id) === selectedJobId) ?? null,
    [pipeline, selectedJobId],
  );

  const hasTailoredForJob = Boolean(
    selectedPipelineJob?.has_resume_html
    || selectedPipelineJob?.has_resume_pdf
    || (reviewJob?.jobId && selectedJobId === reviewJob.jobId
      && (reviewJob.has_resume_html || reviewJob.has_resume_pdf)),
  );

  const jobHasResumeHtml = Boolean(
    selectedPipelineJob?.has_resume_html
    || (reviewJob?.jobId && selectedJobId === reviewJob.jobId && reviewJob.has_resume_html),
  );

  const tailoredPreviewUrl = useMemo(() => {
    const id = selectedJobId ?? reviewJob?.jobId ?? null;
    if (!id || !hasTailoredForJob) return null;
    return `/api/view/${id}`;
  }, [selectedJobId, reviewJob?.jobId, hasTailoredForJob]);

  useEffect(() => {
    if (editingJobId) {
      setPreviewMode('master');
      return;
    }
    if (hasTailoredForJob && leftTab !== 'editor') setPreviewMode('tailored');
  }, [selectedJobId, hasTailoredForJob, leftTab, editingJobId]);

  // Editing always shows the live master draft — never the frozen saved HTML
  useEffect(() => {
    if (leftTab === 'editor') setPreviewMode('master');
  }, [leftTab]);

  // Derive job context for toolbar breadcrumb
  const jobContext = useMemo(() => {
    if (!selectedJobId) return null;
    const match = pipeline.find(
      (j) => Number(j.pipeline_id ?? j.id) === selectedJobId,
    );
    if (!match && !reviewJob) return null;
    return {
      company: match?.company || reviewJob?.company || undefined,
      title: match?.title || reviewJob?.title || undefined,
    };
  }, [selectedJobId, pipeline, reviewJob]);

  useEffect(() => {
    const next = initialJobId ?? reviewJob?.jobId ?? null;
    if (next != null) setSelectedJobId(next);
  }, [initialJobId, reviewJob?.jobId]);

  useEffect(() => {
    if (reviewJob?.docKind === 'cover') {
      setLeftTab('cover');
    } else if (reviewJob?.docKind === 'resume') {
      setLeftTab('jd');
    }
  }, [reviewJob?.jobId, reviewJob?.docKind]);

  const onAutosave = useCallback(
    async (draftToSave: ResumeContext) => {
      const jobId = editingJobIdRef.current;
      if (jobId) {
        const html = fillAtsTemplate(draftToSave);
        const res = await fetch(`/api/job/${jobId}/docs`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_html: html, invalidate_pdfs: false }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to save this job resume');
        return;
      }
      await saveResumeContext(draftToSave);
      onProfileSaved?.(draftToSave);
    },
    [onProfileSaved]
  );

  const store = useResumeStudioStore({
    initial: initialProfile,
    onAutosave,
  });

  const {
    draft,
    openSection,
    setOpenSection,
    saveStatus,
    saveError,
    canUndo,
    canRedo,
    undo,
    redo,
    updateCandidate,
    updateNarrative,
    updateCompetencies,
    updateExperience,
    updateEducation,
    setTemplateId,
    replaceFromImport,
    applyMirroredProfile,
    loadSilent,
    snapshotDraft,
    setIgnoreProfileHydrate,
  } = store;

  useEffect(() => {
    if (!selectedJobId || !jobHasResumeHtml) {
      if (editingJobIdRef.current) {
        editingJobIdRef.current = null;
        setEditingJobId(null);
        setIgnoreProfileHydrate(false);
        if (masterSnapshotRef.current) {
          loadSilent(masterSnapshotRef.current);
          masterSnapshotRef.current = null;
        }
      }
      return;
    }
    if (editingJobIdRef.current === selectedJobId) return;
    if (!masterSnapshotRef.current) masterSnapshotRef.current = snapshotDraft();
    const base = masterSnapshotRef.current;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(`/api/job/${selectedJobId}/docs`);
        const json = await res.json().catch(() => ({}));
        if (cancel) return;
        const parsed = parseTailoredResumeHtml(String(json.resume_html || ''), base);
        if (!parsed) {
          masterSnapshotRef.current = null;
          setBanner('This job has a saved resume, but it could not be opened in the editor.');
          return;
        }
        setIgnoreProfileHydrate(true);
        editingJobIdRef.current = selectedJobId;
        setEditingJobId(selectedJobId);
        loadSilent(parsed);
        setPreviewMode('master');
        setLeftTab((tab) => (tab === 'cover' ? tab : 'editor'));
        setBanner('Editing the resume saved for this job. The preview is this same resume. Your base CV stays unchanged.');
      } catch {
        if (!cancel) setBanner('Could not load the saved resume for this job.');
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selectedJobId, jobHasResumeHtml, loadSilent, snapshotDraft, setIgnoreProfileHydrate]);

  const competencies = useMemo(() => getCompetencies(draft), [draft]);
  const templateMeta = getTemplateMeta(draft.studio?.template_id);
  const isEmpty =
    !draft.candidate?.full_name?.trim() &&
    !(draft.experience || []).length &&
    !(draft.education || []).length;

  const toggleSection = (id: string) => {
    setOpenSection((prev) => (prev === id ? '' : id));
  };

  const handleImport = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/resume/import', { method: 'POST', body: form });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Import failed');

    const extracted = json?.extracted || json;
    const incomingExp = Array.isArray(extracted.experience) ? extracted.experience : [];
    const incomingEdu = Array.isArray(extracted.education) ? extracted.education : [];
    const incomingCandidate =
      extracted.candidate && typeof extracted.candidate === 'object' ? extracted.candidate : {};

    const mergeByKey = <T,>(base: T[], incoming: T[], keyFn: (v: T) => string) => {
      const seen = new Set<string>();
      const out: T[] = [];
      const push = (v: T) => {
        const k = keyFn(v);
        if (!k || seen.has(k)) return;
        seen.add(k);
        out.push(v);
      };
      base.forEach(push);
      incoming.forEach(push);
      return out;
    };

    const prevExp = draft.experience || [];
    const prevEdu = draft.education || [];
    // Prefer merge when parse looks incomplete vs current draft (avoids wiping Rubico etc.)
    const useReplaceExp =
      incomingExp.length > 0 && (prevExp.length === 0 || incomingExp.length >= prevExp.length);
    const useReplaceEdu =
      incomingEdu.length > 0 && (prevEdu.length === 0 || incomingEdu.length >= prevEdu.length);

    const next: ResumeContext = {
      ...draft,
      candidate: {
        ...(draft.candidate || {}),
        ...Object.fromEntries(
          Object.entries(incomingCandidate).filter(
            ([, v]) => typeof v === 'string' && v.trim().length > 0
          )
        ),
      },
      experience: useReplaceExp
        ? incomingExp
        : incomingExp.length
          ? mergeByKey(
              prevExp,
              incomingExp,
              (e: any) => `${e.company || ''}::${e.role || ''}::${e.period || ''}`.toLowerCase()
            )
          : prevExp,
      education: useReplaceEdu
        ? incomingEdu
        : incomingEdu.length
          ? mergeByKey(
              prevEdu,
              incomingEdu,
              (e: any) => `${e.school || ''}::${e.degree || ''}::${e.period || ''}`.toLowerCase()
            )
          : prevEdu,
      studio: { template_id: draft.studio?.template_id || 'ats-professional', ...(draft.studio || {}) },
    };
    replaceFromImport(next);
    setBanner(
      `Import applied — ${(next.experience || []).length} roles, ${(next.education || []).length} education${
        next.candidate?.full_name ? ` · ${next.candidate.full_name}` : ''
      }.`
    );
    setTimeout(() => setBanner(null), 5000);
  };

  const handleExportJson = () => {
    try {
      const parsed = parseResumeForExport(draft);
      const name = (parsed.candidate.full_name || 'resume').replace(/\s+/g, '_');
      downloadBlob(
        `${name}_master_resume.json`,
        new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' })
      );
    } catch {
      const { errors } = validateResumeDraft(draft);
      setBanner(errors[0] || 'Fix required fields before exporting JSON.');
      setTimeout(() => setBanner(null), 5000);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    setBanner(null);
    try {
      const payload = JSON.stringify({ resume_context: draft, cache_only: true, jdText: activeJdText });
      let res = await fetch('/api/resume/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      if (res.status === 404) {
        res = await fetch('/api/resume/export-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_context: draft, jdText: activeJdText }),
        });
      }

      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/pdf')) {
        const blob = await res.blob();
        if (!blob.size) throw new Error('Empty PDF returned');
        const name = (draft.candidate?.full_name || 'resume').replace(/\s+/g, '_');
        const source = res.headers.get('X-CareerOps-PDF-Source');
        downloadBlob(`${name}_master_resume.pdf`, blob);
        setBanner(source === 'r2-cache' ? 'PDF loaded from cache (no re-render).' : 'PDF downloaded.');
        setTimeout(() => setBanner(null), 3000);
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (res.status === 202 || json?.pending) {
        throw new Error(
          json?.error
          || 'PDF generating via GitHub Actions — wait ~1 min and click PDF again.'
        );
      }
      // Never auto-download HTML when the user clicked PDF
      throw new Error(
        json?.error
        || (res.status === 501 || res.status === 503
          ? 'PDF export failed — server will try Chromium first, then GitHub Actions. Optional: add R2_* on Vercel (same as Actions) for caching.'
          : 'PDF export failed')
      );
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : 'Export failed');
      setTimeout(() => setBanner(null), 7000);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleSaveJobResume = async () => {
    const jobId = editingJobIdRef.current;
    if (!jobId || publishingJob) return;
    setPublishingJob(true);
    setBanner(null);
    try {
      const html = fillAtsTemplate(draft);
      const scoreRes = await fetch('/api/resume/ats-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_context: draft,
          jobId,
          preferTailored: false,
        }),
      });
      const scoreJson = await scoreRes.json().catch(() => ({}));
      const freshScore = scoreRes.ok && Number.isFinite(Number(scoreJson.score))
        ? Math.round(Number(scoreJson.score))
        : (liveAts.source === 'jd' && liveAts.score != null ? Math.round(liveAts.score) : null);
      const scoreSource = scoreRes.ok ? String(scoreJson.source || '') : liveAts.source;

      const saved = await fetch(`/api/job/${jobId}/docs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_html: html,
          invalidate_pdfs: false,
          ...(freshScore != null && scoreSource === 'jd' ? { jd_alignment_score: freshScore } : {}),
        }),
      });
      const savedJson = await saved.json().catch(() => ({}));
      if (!saved.ok) throw new Error(savedJson?.error || 'Failed to overwrite this job resume');

      const publishedScores = freshScore != null && scoreSource === 'jd'
        ? { jd_alignment_score: freshScore }
        : undefined;
      if (reviewJob && reviewJob.jobId === jobId) {
        Object.assign(reviewJob, {
          has_resume_html: true,
          ...(publishedScores || {}),
        });
      }
      onJobResumePublished?.(jobId, publishedScores);

      const pdfRes = await fetch('/api/resume/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_context: draft }),
      });

      const contentType = pdfRes.headers.get('content-type') || '';
      if (!(pdfRes.ok && contentType.includes('application/pdf'))) {
        const json = await pdfRes.json().catch(() => ({}));
        throw new Error(
          json?.error
          || 'Resume overwritten. PDF is still generating — click Save again in a minute.'
        );
      }

      const pdfBlob = await pdfRes.blob();
      if (!pdfBlob.size) throw new Error('Resume overwritten, but the PDF was empty.');

      const stored = await fetch(`/api/job/${jobId}/resume-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: pdfBlob,
      });
      const storedJson = await stored.json().catch(() => ({}));
      if (!stored.ok) throw new Error(storedJson?.error || 'Resume saved, but the PDF could not be stored.');

      if (reviewJob && reviewJob.jobId === jobId) {
        Object.assign(reviewJob, { has_resume_pdf: true });
      }
      onJobResumePublished?.(jobId, { ...publishedScores, has_resume_pdf: true });
      setBanner(
        freshScore != null
          ? `Saved. ATS score updated to ${freshScore}. PDF is ready in Generated Docs.`
          : 'Saved over this job’s generated resume. PDF is ready in Generated Docs.'
      );
      setTimeout(() => setBanner(null), 5000);
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : 'Save failed');
      setTimeout(() => setBanner(null), 7000);
    } finally {
      setPublishingJob(false);
    }
  };

  const onAtsUpdate = useCallback((score: number | null, source: 'jd' | 'structure') => {
    setLiveAts({ score, source });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-[#E5E5E0] bg-[#FAFAF8] shadow-sm">
      <StudioToolbar
        saveStatus={saveStatus}
        saveError={saveError}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onImportFile={handleImport}
        onExportJson={handleExportJson}
        onExportPdf={handleExportPdf}
        exportingPdf={exportingPdf}
        onSaveJob={editingJobId ? handleSaveJobResume : undefined}
        savingJob={publishingJob}
        templateLabel={templateMeta.name}
        onOpenTemplates={() => setGalleryOpen(true)}
        jobContext={jobContext}
        atsScore={liveAts.score}
        atsSource={liveAts.source}
      />

      {banner ? (
        <div className="border-b border-[#E5E5E0] bg-[#F5F5F0] px-4 py-2 text-xs font-medium text-[#1C1C1E]">
          {banner}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-b border-[#E5E5E0] lg:border-b-0 lg:border-r">
          <div className="space-y-3 p-4">
            {/* ── Left Pane Sub-Navigation ── */}
            <div className="flex flex-wrap rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => setLeftTab('jd')}
                className={`min-w-0 flex-1 rounded-lg py-2 px-2 text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  leftTab === 'jd'
                    ? 'bg-[#1C1C1E] text-white shadow-sm'
                    : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
                }`}
              >
                <Sparkles size={13} />
                <span className="truncate">JD Match</span>
              </button>
              {reviewJob && (reviewJob.has_cover_letter_html || reviewJob.has_cover_letter_pdf || reviewJob.docKind === 'cover') ? (
                <button
                  type="button"
                  onClick={() => setLeftTab('cover')}
                  className={`min-w-0 flex-1 rounded-lg py-2 px-2 text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    leftTab === 'cover'
                      ? 'bg-[#1C1C1E] text-white shadow-sm'
                      : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
                  }`}
                >
                  <Files size={13} />
                  <span className="truncate">Cover Letter</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setLeftTab('editor')}
                className={`min-w-0 flex-1 rounded-lg py-2 px-2 text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  leftTab === 'editor'
                    ? 'bg-[#1C1C1E] text-white shadow-sm'
                    : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
                }`}
              >
                <Files size={13} />
                <span className="truncate">Edit Resume</span>
              </button>
            </div>

            {leftTab === 'cover' && reviewJob ? (
              <CoverLetterEditor
                jobId={reviewJob.jobId}
                profileName={draft.candidate?.full_name || ''}
                company={reviewJob.company}
                onPreviewHtml={setCoverPreviewHtml}
                onSaved={() => {
                  setBanner('Cover letter saved');
                  setTimeout(() => setBanner(null), 3000);
                  Object.assign(reviewJob, {
                    has_cover_letter_html: true,
                    has_cover_letter_pdf: false,
                  });
                }}
              />
            ) : null}

            {leftTab === 'jd' ? (
              <>
                <JdMatchPanel
                  draft={draft}
                  pipeline={pipeline}
                  selectedJobId={selectedJobId}
                  onSelectJob={(id) => {
                    setSelectedJobId(id);
                  }}
                  onTailor={onTailorJob}
                  onAtsUpdate={onAtsUpdate}
                  onApplyMirroredProfile={(aligned) => {
                    applyMirroredProfile(aligned);
                    setPreviewMode('master');
                    setLeftTab('editor');
                    setOpenSection('experience');
                    setBanner(`JD keywords woven into the editable draft — preview is live Master (not the frozen saved PDF).`);
                  }}
                  onShowLiveDraft={() => {
                    setPreviewMode('master');
                    setLeftTab('editor');
                    setOpenSection('experience');
                  }}
                  hasGeneratedResume={hasTailoredForJob}
                  onJdTextChange={(text) => setActiveJdText(text)}
                />

                {reviewJob ? (
                  <JobReviewLite
                    draft={draft}
                    jobId={reviewJob.jobId}
                    company={reviewJob.company}
                    title={reviewJob.title}
                    pipelineScore={reviewJob.score}
                    atsContentScore={reviewJob.ats_content_score}
                    jdAlignmentScore={reviewJob.jd_alignment_score}
                    hasResumeHtml={reviewJob.has_resume_html}
                    hasResumePdf={reviewJob.has_resume_pdf}
                    hasCoverHtml={reviewJob.has_cover_letter_html}
                    hasCoverPdf={reviewJob.has_cover_letter_pdf}
                    docKind={reviewJob.docKind === 'cover' ? 'cover' : 'resume'}
                    onClose={onClearReviewJob}
                    onDocsUpdated={(next) => {
                      if (!reviewJob) return;
                      Object.assign(reviewJob, {
                        has_resume_html: next.has_resume_html ?? reviewJob.has_resume_html,
                        has_resume_pdf: next.has_resume_pdf ?? reviewJob.has_resume_pdf,
                        has_cover_letter_html:
                          next.has_cover_letter_html ?? reviewJob.has_cover_letter_html,
                        has_cover_letter_pdf:
                          next.has_cover_letter_pdf ?? reviewJob.has_cover_letter_pdf,
                      });
                    }}
                  />
                ) : null}
              </>
            ) : null}

            {leftTab === 'editor' ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-2.5 text-xs text-[#6B6B6B]">
                  {editingJobId
                    ? 'This editor is the resume for the open job. Save overwrites that generated resume and refreshes its PDF. Your base CV stays separate.'
                    : 'This editor is your base CV. Paste a JD on the JD tab to score it. Open a job that already has a tailored resume to edit that file here.'}
                </div>
                {isEmpty ? (
                  <div className="rounded-2xl border border-dashed border-[#E5E5E0] bg-white p-8 text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1C1C1E] text-white">
                      <Sparkles size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-[#1C1C1E]">Start your master resume</h3>
                    <p className="text-sm text-[#6B6B6B] max-w-md mx-auto">
                      Import a PDF/DOCX or fill the sections below. Paste any job description to match keywords and tailor a resume.
                    </p>
                  </div>
                ) : null}

                <SectionAccordion
                  id="personal"
                  title="Personal Info"
                  open={openSection === 'personal'}
                  onToggle={() => toggleSection('personal')}
                >
                  <PersonalInfoSection candidate={draft.candidate || {}} onChange={updateCandidate} />
                </SectionAccordion>

                <SectionAccordion
                  id="summary"
                  title="Professional Summary"
                  open={openSection === 'summary'}
                  onToggle={() => toggleSection('summary')}
                >
                  <SummarySection
                    headline={draft.narrative?.headline || ''}
                    exitStory={draft.narrative?.exit_story || ''}
                    onChange={updateNarrative}
                  />
                </SectionAccordion>

                <SectionAccordion
                  id="competencies"
                  title="Core Competencies"
                  open={openSection === 'competencies'}
                  onToggle={() => toggleSection('competencies')}
                  badge={`${competencies.length}`}
                >
                  <CompetenciesSection tags={competencies} onChange={updateCompetencies} />
                </SectionAccordion>

                <SectionAccordion
                  id="experience"
                  title="Experience"
                  open={openSection === 'experience'}
                  onToggle={() => toggleSection('experience')}
                  badge={`${(draft.experience || []).length}`}
                >
                  <ExperienceSection experience={draft.experience || []} onChange={updateExperience} />
                </SectionAccordion>

                <SectionAccordion
                  id="education"
                  title="Education"
                  open={openSection === 'education'}
                  onToggle={() => toggleSection('education')}
                  badge={`${(draft.education || []).length}`}
                >
                  <EducationSection education={draft.education || []} onChange={updateEducation} />
                </SectionAccordion>
              </div>
            ) : null}

            {onOpenGeneratedDocs ? (
              <button
                type="button"
                onClick={onOpenGeneratedDocs}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E5E5E0] bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#6B6B6B] hover:text-[#1C1C1E] hover:border-[#1C1C1E]/30 transition-colors"
              >
                <Files size={14} />
                Open Generated Docs
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-[320px] lg:min-h-0">
          {leftTab === 'cover' && reviewJob &&
          (coverPreviewHtml || reviewJob.has_cover_letter_html || reviewJob.has_cover_letter_pdf) ? (
            <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white lg:min-h-0">
              <div className="flex items-center justify-between border-b border-[#E5E5E0] bg-[#FAFAF8] px-4 py-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                    Live Preview · Cover letter
                  </div>
                  <p className="text-xs font-medium text-[#6B6B6B]">
                    {reviewJob.company || 'Company'} — edits update live; click Save to persist
                  </p>
                </div>
                <a
                  href={`/api/view/${reviewJob.jobId}?type=cl`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1C1C1E] hover:border-[#1C1C1E]"
                >
                  Open
                </a>
              </div>
              {coverPreviewHtml ? (
                <iframe
                  title="Cover letter live preview"
                  srcDoc={coverPreviewHtml}
                  className="w-full flex-1 border-0 bg-white"
                  sandbox=""
                />
              ) : (
                <iframe
                  title="Cover letter live preview"
                  src={
                    reviewJob.has_cover_letter_html
                      ? `/api/view/${reviewJob.jobId}?type=cl`
                      : `/api/view/${reviewJob.jobId}?type=cl&format=pdf`
                  }
                  className="w-full flex-1 border-0 bg-white"
                />
              )}
            </div>
          ) : (
            <LivePreview
              draft={draft}
              zoom={zoom}
              onZoomChange={setZoom}
              onOpenTemplates={() => setGalleryOpen(true)}
              externalAtsScore={liveAts.score}
              externalAtsSource={liveAts.source}
              previewMode={editingJobId ? 'master' : previewMode}
              onPreviewModeChange={setPreviewMode}
              tailoredPreviewUrl={editingJobId ? null : tailoredPreviewUrl}
              showTailoredToggle={!editingJobId && hasTailoredForJob}
              activeJdText={editingJobId ? '' : activeJdText}
            />
          )}
        </div>
      </div>

      <TemplateGallery
        open={galleryOpen}
        selectedId={draft.studio?.template_id || 'ats-professional'}
        onClose={() => setGalleryOpen(false)}
        onSelect={(id) => {
          setTemplateId(id);
          setBanner(`Template switched to ${getTemplateMeta(id).name}`);
          setTimeout(() => setBanner(null), 3000);
        }}
      />
    </div>
  );
}
