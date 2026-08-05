'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileCheck2, FileUp, Loader2, Target, Zap } from 'lucide-react';
import type { ResumeContext } from '@/lib/resume/types';
import { getCompetencies } from '@/lib/resume/types';

export type PipelineJobOption = {
  pipeline_id?: number | string;
  id?: number | string;
  company?: string;
  title?: string;
  score?: string | number | null;
  has_jd?: boolean;
  has_resume_html?: boolean;
  has_resume_pdf?: boolean;
};

type JdMatchPanelProps = {
  draft: ResumeContext;
  pipeline: PipelineJobOption[];
  selectedJobId: number | null;
  onSelectJob: (id: number | null) => void;
  onTailor?: (jobId: number) => void;
  onAtsUpdate?: (score: number | null, source: 'jd' | 'structure') => void;
  hasGeneratedResume?: boolean;
};

type MatchState = {
  loading: boolean;
  error: string | null;
  honest: string[];
  gaps: string[];
  coveragePct: number;
  atsScore: number | null;
  atsSource: 'jd' | 'structure';
  hasJd: boolean;
};

type JdMode = 'pipeline' | 'paste';

const MIN_JD_LEN = 40;

function draftMatchKey(draft: ResumeContext): string {
  return JSON.stringify({
    template: draft.studio?.template_id,
    name: draft.candidate?.full_name,
    headline: draft.narrative?.headline,
    exp: (draft.experience || []).map((e) => `${e.company}|${e.role}|${(e.bullets || []).length}`),
    edu: (draft.education || []).map((e) => `${e.school}|${e.degree}`),
    skills: getCompetencies(draft).slice(0, 40),
  });
}

async function runMatchApis(
  draft: ResumeContext,
  payload: { jobId?: number; jdText?: string },
): Promise<{ matchJson: Record<string, unknown>; atsJson: Record<string, unknown>; matchOk: boolean }> {
  const body = { resume_context: draft, ...payload };
  const [matchRes, atsRes] = await Promise.all([
    fetch('/api/resume/jd-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    fetch('/api/resume/ats-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  ]);
  const matchJson = (await matchRes.json().catch(() => ({}))) as Record<string, unknown>;
  const atsJson = (await atsRes.json().catch(() => ({}))) as Record<string, unknown>;
  return { matchJson, atsJson, matchOk: matchRes.ok };
}

export function JdMatchPanel({
  draft,
  pipeline,
  selectedJobId,
  onSelectJob,
  onTailor,
  onAtsUpdate,
  hasGeneratedResume = false,
}: JdMatchPanelProps) {
  const [mode, setMode] = useState<JdMode>('paste');
  const [pastedJd, setPastedJd] = useState('');
  const [pasteJobId, setPasteJobId] = useState<number | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<MatchState>({
    loading: false,
    error: null,
    honest: [],
    gaps: [],
    coveragePct: 0,
    atsScore: null,
    atsSource: 'structure',
    hasJd: false,
  });

  const matchDraftKey = useMemo(() => draftMatchKey(draft), [draft]);
  const pastedReady = pastedJd.trim().length >= MIN_JD_LEN;

  const applyMatchResult = useCallback(
    (
      matchJson: Record<string, unknown>,
      atsJson: Record<string, unknown>,
      matchOk: boolean,
    ) => {
      if (!matchOk) {
        setState({
          loading: false,
          error: String(matchJson.error || 'JD match unavailable'),
          honest: [],
          gaps: [],
          coveragePct: 0,
          atsScore: typeof atsJson.score === 'number' ? atsJson.score : null,
          atsSource: (atsJson.source as 'jd' | 'structure') || 'structure',
          hasJd: false,
        });
        onAtsUpdate?.(
          typeof atsJson.score === 'number' ? atsJson.score : null,
          (atsJson.source as 'jd' | 'structure') || 'structure',
        );
        return;
      }

      const coveragePct = Number(matchJson.coveragePct) || 0;
      const atsScore =
        typeof atsJson.score === 'number'
          ? atsJson.score
          : coveragePct || null;

      setState({
        loading: false,
        error: null,
        honest: Array.isArray(matchJson.honest) ? (matchJson.honest as string[]) : [],
        gaps: Array.isArray(matchJson.gaps) ? (matchJson.gaps as string[]) : [],
        coveragePct,
        atsScore,
        atsSource: (atsJson.source as 'jd' | 'structure') || 'jd',
        hasJd: true,
      });
      onAtsUpdate?.(atsScore, (atsJson.source as 'jd' | 'structure') || 'jd');
    },
    [onAtsUpdate],
  );

  useEffect(() => {
    let cancelled = false;

    const runPipeline = async () => {
      if (mode !== 'pipeline' || !selectedJobId) {
        if (mode === 'pipeline') {
          setState((s) => ({
            ...s,
            honest: [],
            gaps: [],
            coveragePct: 0,
            atsScore: null,
            atsSource: 'structure',
            hasJd: false,
            error: null,
          }));
          onAtsUpdate?.(null, 'structure');
        }
        return;
      }

      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { matchJson, atsJson, matchOk } = await runMatchApis(draft, { jobId: selectedJobId });
        if (cancelled) return;
        applyMatchResult(matchJson, atsJson, matchOk);
      } catch (e: unknown) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'Match failed',
        }));
      }
    };

    void runPipeline();
    return () => {
      cancelled = true;
    };
  }, [mode, selectedJobId, matchDraftKey, draft, applyMatchResult, onAtsUpdate]);

  useEffect(() => {
    if (mode !== 'paste') return undefined;

    if (!pastedReady) {
      setState((s) => ({
        ...s,
        honest: [],
        gaps: [],
        coveragePct: 0,
        atsScore: null,
        atsSource: 'structure',
        hasJd: false,
        error: null,
        loading: false,
      }));
      onAtsUpdate?.(null, 'structure');
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { matchJson, atsJson, matchOk } = await runMatchApis(draft, {
          jdText: pastedJd.trim(),
        });
        if (cancelled) return;
        applyMatchResult(matchJson, atsJson, matchOk);
      } catch (e: unknown) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'Match failed',
        }));
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mode, pastedJd, pastedReady, matchDraftKey, draft, applyMatchResult, onAtsUpdate]);

  const options = (pipeline || []).slice(0, 40);
  const selectedJob = options.find((j) => Number(j.pipeline_id ?? j.id) === selectedJobId);
  const activeJobId = mode === 'pipeline' ? selectedJobId : pasteJobId;
  const jobHasDoc =
    hasGeneratedResume
    || Boolean(selectedJob?.has_resume_html || selectedJob?.has_resume_pdf);

  const handleJdUpload = async (file: File) => {
    setUploading(true);
    setState((s) => ({ ...s, error: null }));
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/resume/jd-ingest', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      if (json.jobId) setPasteJobId(Number(json.jobId));
      const text = String(json.jdText || '').trim();
      if (text) setPastedJd(text);
    } catch (e: unknown) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : 'Upload failed',
      }));
    } finally {
      setUploading(false);
    }
  };

  const handleTailorPastedJd = async () => {
    if (!onTailor || !pastedReady) return;
    setIngesting(true);
    setState((s) => ({ ...s, error: null }));
    try {
      let jobId = pasteJobId;
      if (!jobId) {
        const res = await fetch('/api/resume/jd-ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jdText: pastedJd.trim() }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Could not save JD');
        jobId = Number(json.jobId);
        setPasteJobId(jobId);
      }
      if (!Number.isFinite(jobId)) throw new Error('Invalid job id');
      onTailor(jobId);
    } catch (e: unknown) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : 'Tailor failed to start',
      }));
    } finally {
      setIngesting(false);
    }
  };

  const showResults =
    state.hasJd
    && ((mode === 'pipeline' && selectedJobId) || (mode === 'paste' && pastedReady));

  return (
    <div className="space-y-3 rounded-2xl border border-[#E5E5E0] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[#1C1C1E]" />
          <h4 className="text-sm font-bold text-[#1C1C1E]">JD Matcher</h4>
        </div>
        {state.loading || ingesting || uploading ? (
          <Loader2 size={14} className="animate-spin text-[#9CA3AF]" />
        ) : null}
      </div>

      <div className="flex rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-0.5">
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            mode === 'paste' ? 'bg-[#1C1C1E] text-white' : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
          }`}
        >
          Paste JD
        </button>
        <button
          type="button"
          onClick={() => setMode('pipeline')}
          className={`flex-1 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            mode === 'pipeline' ? 'bg-[#1C1C1E] text-white' : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
          }`}
        >
          Pipeline job
        </button>
      </div>

      {mode === 'paste' ? (
        <div className="space-y-2">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
              Job description
            </span>
            <textarea
              value={pastedJd}
              onChange={(e) => {
                setPasteJobId(null);
                setPastedJd(e.target.value);
              }}
              rows={7}
              placeholder="Paste the full job description here — responsibilities, requirements, qualifications…"
              className="w-full resize-y rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#1C1C1E]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleJdUpload(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5E0] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1C1C1E] hover:bg-[#F5F5F0] disabled:opacity-50"
            >
              <FileUp size={12} />
              Upload .txt / .pdf / .docx
            </button>
            <span className="text-[10px] font-medium text-[#9CA3AF]">
              {pastedReady ? `${pastedJd.trim().length} chars · match ready` : `Min ${MIN_JD_LEN} chars`}
            </span>
          </div>
        </div>
      ) : (
        <label className="block space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
            Pipeline job
          </span>
          <select
            value={selectedJobId ?? ''}
            onChange={(e) => onSelectJob(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2.5 text-sm font-medium text-[#1C1C1E] outline-none focus:border-[#1C1C1E]"
          >
            <option value="">Select a job…</option>
            {options.map((j) => {
              const id = Number(j.pipeline_id ?? j.id);
              if (!Number.isFinite(id)) return null;
              const saved = j.has_resume_html || j.has_resume_pdf ? ' ✓' : '';
              return (
                <option key={id} value={id}>
                  {j.company || 'Company'} — {j.title || 'Role'}
                  {j.score != null ? ` ★${j.score}` : ''}
                  {saved}
                </option>
              );
            })}
          </select>
          {!selectedJobId ? (
            <p className="text-xs font-medium text-[#6B6B6B]">
              {options.length === 0
                ? 'No pipeline jobs yet — paste a JD above, or run Scan from Job Pipeline.'
                : 'Pick a sourced job to match against your master profile.'}
            </p>
          ) : null}
        </label>
      )}

      {mode === 'pipeline' && jobHasDoc && selectedJobId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-900">
            <FileCheck2 size={14} />
            Tailored resume already saved for this job
          </div>
          <a
            href={`/api/view/${selectedJobId}?format=pdf&download=1`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-900"
          >
            <Download size={12} />
            PDF
          </a>
        </div>
      ) : null}

      {state.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {state.error}
        </p>
      ) : null}

      {showResults ? (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-[#E5E5E0] bg-[#F5F5F0] px-3 py-2.5">
            <div className="rounded-full bg-[#1C1C1E] px-3 py-1 font-mono text-sm text-white">
              ATS {state.atsScore ?? '—'}/100
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">
              {state.atsSource === 'jd' ? 'JD keyword coverage' : 'Profile completeness'}
              {' · '}
              {state.coveragePct}% honest match
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              Proven in profile
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state.honest.length ? (
                state.honest.slice(0, 16).map((k) => (
                  <span
                    key={k}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                  >
                    {k}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#9CA3AF]">No honest matches extracted</span>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700">
              JD gaps (do not claim)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state.gaps.length ? (
                state.gaps.slice(0, 12).map((k) => (
                  <span
                    key={k}
                    className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"
                  >
                    {k}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[#9CA3AF]">No gaps detected</span>
              )}
            </div>
          </div>

          {onTailor && (mode === 'paste' || !jobHasDoc) ? (
            <button
              type="button"
              onClick={mode === 'paste' ? () => void handleTailorPastedJd() : () => onTailor(activeJobId!)}
              disabled={ingesting || (mode === 'pipeline' && !selectedJobId)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#27272a] disabled:opacity-50"
            >
              <Zap size={14} />
              {mode === 'paste' ? 'Tailor resume for this JD' : 'Tailor this job — deep'}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
