'use client';

import { useEffect, useState } from 'react';
import { Loader2, Target, Zap } from 'lucide-react';
import type { ResumeContext } from '@/lib/resume/types';

export type PipelineJobOption = {
  pipeline_id?: number | string;
  id?: number | string;
  company?: string;
  title?: string;
  score?: string | number | null;
  has_jd?: boolean;
};

type JdMatchPanelProps = {
  draft: ResumeContext;
  pipeline: PipelineJobOption[];
  selectedJobId: number | null;
  onSelectJob: (id: number | null) => void;
  onTailor?: (jobId: number) => void;
  onAtsUpdate?: (score: number | null, source: 'jd' | 'structure') => void;
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

export function JdMatchPanel({
  draft,
  pipeline,
  selectedJobId,
  onSelectJob,
  onTailor,
  onAtsUpdate,
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
  }, [selectedJobId, draft, onAtsUpdate]);

  const options = (pipeline || []).slice(0, 40);

  return (
    <div className="rounded-2xl border border-[#E5E5E0] bg-white p-4 space-y-3">
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
            return (
              <option key={id} value={id}>
                {j.company || 'Company'} — {j.title || 'Role'}
                {j.score != null ? ` ★${j.score}` : ''}
              </option>
            );
          })}
        </select>
      </label>

      {!selectedJobId ? (
        <p className="text-xs text-[#6B6B6B] font-medium">
          {options.length === 0
            ? 'No pipeline jobs yet — run Scan from the Job Pipeline, then come back to match a JD.'
            : 'Pick a sourced job to see honest keyword matches and a real ATS score against the JD.'}
        </p>
      ) : null}

      {state.error ? (
        <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {state.error}
        </p>
      ) : null}

      {selectedJobId && state.hasJd ? (
        <>
          <div className="flex items-center gap-3 rounded-xl bg-[#F5F5F0] border border-[#E5E5E0] px-3 py-2.5">
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
            <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1.5">
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
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1.5">
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

          {onTailor ? (
            <button
              type="button"
              onClick={() => onTailor(selectedJobId)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#27272a]"
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
