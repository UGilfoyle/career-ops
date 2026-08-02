'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileCheck2, Loader2, Target, Zap } from 'lucide-react';
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

export function JdMatchPanel({
  draft,
  pipeline,
  selectedJobId,
  onSelectJob,
  onTailor,
  onAtsUpdate,
  hasGeneratedResume = false,
}: JdMatchPanelProps) {
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

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selectedJobId) {
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
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const [matchRes, atsRes] = await Promise.all([
          fetch('/api/resume/jd-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: selectedJobId, resume_context: draft }),
          }),
          fetch('/api/resume/ats-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: selectedJobId, resume_context: draft }),
          }),
        ]);
        const matchJson = await matchRes.json().catch(() => ({}));
        const atsJson = await atsRes.json().catch(() => ({}));
        if (cancelled) return;

        if (!matchRes.ok) {
          setState({
            loading: false,
            error: matchJson.error || 'JD match unavailable',
            honest: [],
            gaps: [],
            coveragePct: 0,
            atsScore: atsJson.score ?? null,
            atsSource: atsJson.source || 'structure',
            hasJd: false,
          });
          onAtsUpdate?.(atsJson.score ?? null, atsJson.source || 'structure');
          return;
        }

        setState({
          loading: false,
          error: null,
          honest: matchJson.honest || [],
          gaps: matchJson.gaps || [],
          coveragePct: matchJson.coveragePct || 0,
          atsScore: atsJson.score ?? matchJson.coveragePct ?? null,
          atsSource: atsJson.source || 'jd',
          hasJd: true,
        });
        onAtsUpdate?.(atsJson.score ?? matchJson.coveragePct ?? null, atsJson.source || 'jd');
      } catch (e: unknown) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'Match failed',
        }));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedJobId, matchDraftKey, onAtsUpdate, draft]);

  const options = (pipeline || []).slice(0, 40);
  const selectedJob = options.find((j) => Number(j.pipeline_id ?? j.id) === selectedJobId);
  const jobHasDoc = hasGeneratedResume
    || Boolean(selectedJob?.has_resume_html || selectedJob?.has_resume_pdf);

  return (
    <div className="space-y-3 rounded-2xl border border-[#E5E5E0] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[#1C1C1E]" />
          <h4 className="text-sm font-bold text-[#1C1C1E]">JD Matcher</h4>
        </div>
        {state.loading ? <Loader2 size={14} className="animate-spin text-[#9CA3AF]" /> : null}
      </div>

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
      </label>

      {!selectedJobId ? (
        <p className="text-xs font-medium text-[#6B6B6B]">
          {options.length === 0
            ? 'No pipeline jobs yet — run Scan from the Job Pipeline, then come back to match a JD.'
            : 'Pick a sourced job to see honest keyword matches and a real ATS score against the JD.'}
        </p>
      ) : null}

      {jobHasDoc ? (
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

      {selectedJobId && state.hasJd ? (
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

          {onTailor && !jobHasDoc ? (
            <button
              type="button"
              onClick={() => onTailor(selectedJobId)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#27272a]"
            >
              <Zap size={14} />
              Tailor this job — deep
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
