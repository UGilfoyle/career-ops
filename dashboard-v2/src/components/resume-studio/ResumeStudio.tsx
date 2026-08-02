'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Files, Sparkles } from 'lucide-react';
import { SectionAccordion } from './SectionAccordion';
import { StudioToolbar } from './StudioToolbar';
import { LivePreview } from './LivePreview';
import { TemplateGallery } from './TemplateGallery';
import { JdMatchPanel, type PipelineJobOption } from './JdMatchPanel';
import { JobReviewLite } from './JobReviewLite';
import { PersonalInfoSection } from './sections/PersonalInfoSection';
import { SummarySection } from './sections/SummarySection';
import { CompetenciesSection } from './sections/CompetenciesSection';
import { ExperienceSection } from './sections/ExperienceSection';
import { EducationSection } from './sections/EducationSection';
import { useResumeStudioStore } from './useResumeStudioStore';
import { getTemplateMeta } from '@/lib/resume/ats-professional-template';
import { parseResumeForExport, validateResumeDraft } from '@/lib/resume/schema';
import { getCompetencies, type ResumeContext } from '@/lib/resume/types';

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
  } | null;
  onClearReviewJob?: () => void;
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
}: ResumeStudioProps) {
  const [zoom, setZoom] = useState(100);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(initialJobId ?? reviewJob?.jobId ?? null);
  const [liveAts, setLiveAts] = useState<{ score: number | null; source: 'jd' | 'structure' }>({
    score: null,
    source: 'structure',
  });

  useEffect(() => {
    const next = initialJobId ?? reviewJob?.jobId ?? null;
    if (next != null) setSelectedJobId(next);
  }, [initialJobId, reviewJob?.jobId]);

  const onAutosave = useCallback(
    async (draft: ResumeContext) => {
      await saveResumeContext(draft);
      onProfileSaved?.(draft);
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
  } = store;

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
      const res = await fetch('/api/resume/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_context: draft }),
      });
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/pdf')) {
        const blob = await res.blob();
        if (!blob.size) throw new Error('Empty PDF returned');
        const name = (draft.candidate?.full_name || 'resume').replace(/\s+/g, '_');
        downloadBlob(`${name}_master_resume.pdf`, blob);
        setBanner('PDF downloaded.');
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

  const onAtsUpdate = useCallback((score: number | null, source: 'jd' | 'structure') => {
    setLiveAts({ score, source });
  }, []);

  return (
    <div className="flex h-[calc(100vh-2rem)] min-h-[640px] flex-col overflow-hidden rounded-[1.5rem] border border-[#E5E5E0] bg-[#FAFAF8] shadow-sm">
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
        templateLabel={templateMeta.name}
        onOpenTemplates={() => setGalleryOpen(true)}
      />

      {banner ? (
        <div className="border-b border-[#E5E5E0] bg-[#F5F5F0] px-4 py-2 text-xs font-medium text-[#1C1C1E]">
          {banner}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-b border-[#E5E5E0] lg:border-b-0 lg:border-r">
          <div className="space-y-3 p-4">
            {isEmpty ? (
              <div className="rounded-2xl border border-dashed border-[#E5E5E0] bg-white p-8 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1C1C1E] text-white">
                  <Sparkles size={20} />
                </div>
                <h3 className="text-lg font-bold text-[#1C1C1E]">Start your master resume</h3>
                <p className="text-sm text-[#6B6B6B] max-w-md mx-auto">
                  Import a PDF/DOCX or fill the sections below. Then pick a pipeline job for JD match + ATS.
                </p>
              </div>
            ) : null}

            <JdMatchPanel
              draft={draft}
              pipeline={pipeline}
              selectedJobId={selectedJobId}
              onSelectJob={(id) => {
                setSelectedJobId(id);
              }}
              onTailor={onTailorJob}
              onAtsUpdate={onAtsUpdate}
            />

            {reviewJob ? (
              <JobReviewLite
                draft={draft}
                jobId={reviewJob.jobId}
                company={reviewJob.company}
                title={reviewJob.title}
                pipelineScore={reviewJob.score}
                atsContentScore={reviewJob.ats_content_score}
                onClose={onClearReviewJob}
              />
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

        <div className="min-h-[420px] lg:min-h-0">
          <LivePreview
            draft={draft}
            zoom={zoom}
            onZoomChange={setZoom}
            onOpenTemplates={() => setGalleryOpen(true)}
            externalAtsScore={liveAts.score}
            externalAtsSource={liveAts.source}
          />
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
