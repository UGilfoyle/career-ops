'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { canAccessPracticeBeta } from '@/lib/lifetime-access';
import ProPaywall, { type PendingPayment } from '../ProPaywall';
import PracticeComingSoon from './PracticeComingSoon';
import HandbookCard from './HandbookCard';
import PracticePackView, { type PracticePackContent } from './PracticePackView';
import { PracticeIdeView } from './PracticeIdeView';

type PipelineJob = {
  pipeline_id?: number | string;
  id?: number | string;
  company?: string;
  title?: string;
  role?: string;
  is_applied?: boolean;
  application_status?: string | null;
  app_id?: number | null;
};

type ApplicationRow = {
  id?: number | string;
  job_id?: number | string;
  company?: string;
  title?: string;
  role?: string;
  status?: string | null;
};

type QuotaState = {
  remaining: number;
  resetAt: string | null;
  pro: boolean;
  freeLimit: number;
  banner: string;
};

type PackSummary = {
  id: number;
  company: string | null;
  role: string | null;
  createdAt: string;
  counts: { coding: number; systemDesign: number; behavioral: number };
};

type Props = {
  pipeline?: PipelineJob[];
  applications?: ApplicationRow[];
  planDisplay: string;
  planSubtitle: string;
  pendingPayment?: PendingPayment | null;
  onUpgrade?: () => void;
};

const fieldClass =
  'mt-1.5 w-full min-w-0 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-3 text-base text-[#1C1C1E] sm:py-2.5 sm:text-sm';

function jobIsApplied(job: PipelineJob) {
  const status = String(job.application_status || '').toUpperCase();
  if (['APPLIED', 'RESPONDED', 'INTERVIEW', 'INTERVIEWING', 'OFFER', 'SENT'].includes(status)) {
    return true;
  }
  return Boolean(job.is_applied || job.app_id);
}

function packTotal(counts: { coding: number; systemDesign: number; behavioral: number }) {
  return (counts.coding || 0) + (counts.systemDesign || 0) + (counts.behavioral || 0);
}

export default function PracticePanel({
  pipeline = [],
  applications = [],
  planDisplay,
  planSubtitle,
  pendingPayment,
  onUpgrade,
}: Props) {
  const { data: session, status: sessionStatus } = useSession();
  const [mode, setMode] = useState<'job' | 'paste'>('job');
  const [jobId, setJobId] = useState<string>('');
  const [jdText, setJdText] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [activePack, setActivePack] = useState<{
    id: number;
    company: string | null;
    role: string | null;
    content: PracticePackContent;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const [jobFilter, setJobFilter] = useState<'applied' | 'all'>('applied');
  const [sandboxOpen, setSandboxOpen] = useState(true);

  const sessionEmail = session?.user?.email ?? null;
  const clientBetaAllowed =
    sessionStatus === 'authenticated' && canAccessPracticeBeta(sessionEmail);

  const appliedJobIds = useMemo(() => {
    const ids = new Set<string>();
    for (const app of applications) {
      if (app.job_id != null) ids.add(String(app.job_id));
    }
    for (const j of pipeline) {
      if (jobIsApplied(j)) ids.add(String(j.pipeline_id ?? j.id ?? ''));
    }
    ids.delete('');
    return ids;
  }, [applications, pipeline]);

  const jobs = useMemo(() => {
    const mapped = pipeline
      .map((j) => ({
        id: String(j.pipeline_id ?? j.id ?? ''),
        company: j.company || 'Company',
        title: j.title || j.role || 'Role',
        applied: jobIsApplied(j) || appliedJobIds.has(String(j.pipeline_id ?? j.id ?? '')),
      }))
      .filter((j) => j.id);

    // Also surface applications that might not be in the truncated pipeline view
    for (const app of applications) {
      const id = String(app.job_id ?? '');
      if (!id || mapped.some((m) => m.id === id)) continue;
      mapped.push({
        id,
        company: app.company || 'Company',
        title: app.title || app.role || 'Role',
        applied: true,
      });
    }

    const applied = mapped.filter((j) => j.applied);
    const rest = mapped.filter((j) => !j.applied);
    // Applied first in the full list
    const ordered = [...applied, ...rest];
    if (jobFilter === 'applied') return applied.length ? applied : ordered.slice(0, 0);
    return ordered.slice(0, 80);
  }, [pipeline, applications, appliedJobIds, jobFilter]);

  const activeQuestionCount = activePack
    ? packTotal({
        coding: activePack.content?.coding?.length || 0,
        systemDesign: activePack.content?.systemDesign?.length || 0,
        behavioral: activePack.content?.behavioral?.length || 0,
      })
    : 0;

  const refreshMeta = useCallback(async () => {
    const [qRes, pRes] = await Promise.all([
      fetch('/api/practice/quota'),
      fetch('/api/practice/packs'),
    ]);
    if (qRes.status === 403) {
      const q = await qRes.json().catch(() => ({} as { error?: string }));
      if (q.error === 'coming_soon') {
        setComingSoon(true);
        return;
      }
    }
    if (qRes.ok) {
      setComingSoon(false);
      const q = await qRes.json();
      setQuota({
        remaining: q.remaining,
        resetAt: q.resetAt,
        pro: Boolean(q.pro),
        freeLimit: q.freeLimit ?? 1,
        banner: q.banner || '',
      });
      setShowPaywall(false);
    }
    if (pRes.status === 403) {
      const p = await pRes.json().catch(() => ({} as { error?: string }));
      if (p.error === 'coming_soon') {
        setComingSoon(true);
        return;
      }
    }
    if (pRes.ok) {
      const p = await pRes.json();
      setPacks(Array.isArray(p.packs) ? p.packs : []);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (sessionStatus === 'authenticated' && !canAccessPracticeBeta(sessionEmail)) {
      setComingSoon(true);
      setBootLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await refreshMeta();
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMeta, sessionStatus, sessionEmail]);

  async function loadPack(id: number) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/practice/packs/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load pack');
      setActivePack({
        id: data.pack.id,
        company: data.pack.company,
        role: data.pack.role,
        content: data.pack.content,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pack');
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    setLoading(true);
    setError('');
    setShowPaywall(false);
    try {
      const body = mode === 'job' ? { jobId: Number(jobId) } : { jdText, company, role };

      if (mode === 'job' && !jobId) {
        throw new Error('Pick a pipeline job first');
      }
      if (mode === 'paste' && jdText.trim().length < 40) {
        throw new Error('Paste a fuller JD (40+ characters)');
      }

      const res = await fetch('/api/practice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 403 && data.error === 'coming_soon') {
        setComingSoon(true);
        return;
      }
      if (res.status === 402 || data.error === 'quota_exceeded') {
        setShowPaywall(true);
        setError(data.message || 'Free quota used — upgrade for unlimited packs.');
        return;
      }
      if (!res.ok) throw new Error(data.message || data.error || 'Generate failed');

      setActivePack({
        id: data.pack.id,
        company: data.pack.company,
        role: data.pack.role,
        content: data.pack.content,
      });
      if (data.quota) {
        setQuota((prev) => ({
          remaining: data.quota.remaining,
          resetAt: data.quota.resetAt,
          pro: Boolean(data.quota.pro),
          freeLimit: data.quota.freeLimit ?? prev?.freeLimit ?? 1,
          banner: data.quota.pro
            ? 'Pro · unlimited Interview Practice packs'
            : prev?.banner || '1 JD practice pack / week · Pro: unlimited',
        }));
      }
      await refreshMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setLoading(false);
    }
  }

  if (sessionStatus === 'loading' || bootLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
        <Loader2 className="animate-spin" size={16} /> Loading Interview Practice…
      </div>
    );
  }

  if (comingSoon || (sessionStatus === 'authenticated' && !clientBetaAllowed)) {
    return <PracticeComingSoon />;
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-6">
      {/* ── Screen 3: Full Interview Practice IDE ── */}
      <PracticeIdeView
        company={activePack?.company || company || (jobs[0]?.company) || 'Stripe'}
        role={activePack?.role || role || (jobs[0]?.title) || 'Senior Backend Engineer'}
        codingPrompts={activePack?.content?.coding}
        systemDesignPrompts={activePack?.content?.systemDesign}
        behavioralPrompts={activePack?.content?.behavioral}
        questionCount={activeQuestionCount || undefined}
      />

      {showPaywall && (
        <ProPaywall
          feature="practice"
          planDisplay={planDisplay}
          planSubtitle={planSubtitle}
          pendingPayment={pendingPayment}
          onUpgrade={onUpgrade}
        />
      )}

      {/* ── Generate Custom Pack for Any Job ── */}
      <div className="min-w-0 rounded-2xl border border-[#E5E5E0] bg-white p-4 shadow-sm sm:rounded-[1.5rem] sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-[#F5F5F0] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#1C1C1E]">Generate Tailored Interview Pack</h3>
            <p className="text-xs text-[#6B6B6B]">
              20 questions from your stack + experience, tuned to an applied role or pasted JD
            </p>
          </div>
          {quota && (
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
              {quota.banner || 'Pro · Ready'}
            </span>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('job')}
            className={`min-h-10 rounded-xl px-2 py-2 text-xs font-bold sm:px-3 transition-colors ${
              mode === 'job' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'bg-[#F4F4F0] text-[#6B6B6B] hover:text-[#1C1C1E]'
            }`}
          >
            Pipeline Job
          </button>
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={`min-h-10 rounded-xl px-2 py-2 text-xs font-bold sm:px-3 transition-colors ${
              mode === 'paste' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'bg-[#F4F4F0] text-[#6B6B6B] hover:text-[#1C1C1E]'
            }`}
          >
            Paste Custom JD
          </button>
        </div>

        {mode === 'job' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setJobFilter('applied')}
                className={`min-h-9 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  jobFilter === 'applied'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#F4F4F0] text-[#6B6B6B] hover:text-[#1C1C1E]'
                }`}
              >
                Applied jobs
              </button>
              <button
                type="button"
                onClick={() => setJobFilter('all')}
                className={`min-h-9 rounded-xl px-2 py-1.5 text-[11px] font-bold transition-colors ${
                  jobFilter === 'all'
                    ? 'bg-[#1C1C1E] text-white'
                    : 'bg-[#F4F4F0] text-[#6B6B6B] hover:text-[#1C1C1E]'
                }`}
              >
                All pipeline
              </button>
            </div>
            <label className="block text-xs font-bold text-[#6B6B6B]">
              Select target job
              <select
                value={jobId}
                onChange={(e) => {
                  const jId = e.target.value;
                  setJobId(jId);
                  const selected = jobs.find((j) => j.id === jId);
                  if (selected) {
                    setCompany(selected.company);
                    setRole(selected.title);
                  }
                }}
                className={fieldClass}
              >
                <option value="">
                  {jobFilter === 'applied' ? 'Choose an applied job…' : 'Choose from pipeline…'}
                </option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.applied ? '✓ ' : ''}
                    {j.company} — {j.title}
                  </option>
                ))}
              </select>
              {jobFilter === 'applied' && jobs.length === 0 && (
                <span className="mt-1 block text-[11px] font-medium leading-snug text-[#9CA3AF]">
                  No applied jobs yet — switch to All pipeline, or paste a JD. Mark Applied in Pipeline first for best practice packs.
                </span>
              )}
              {jobFilter === 'all' && jobs.length === 0 && (
                <span className="mt-1 block text-[11px] font-medium leading-snug text-[#9CA3AF]">
                  No pipeline jobs yet — paste a JD instead, or run a scan.
                </span>
              )}
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#6B6B6B]">
                Company
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Stripe, Google, Digicert"
                />
              </label>
              <label className="block text-xs font-bold text-[#6B6B6B]">
                Role
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Senior Backend Engineer"
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-[#6B6B6B]">
              Job Description
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={5}
                className={fieldClass}
                placeholder="Paste the full job description here…"
              />
            </label>
          </div>
        )}

        {error && !showPaywall && (
          <p className="mt-3 break-words text-xs font-semibold text-rose-600 [overflow-wrap:anywhere]">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => void generate()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#27272a] active:scale-95 transition-all disabled:opacity-60 sm:w-auto"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-300" />}
            Generate 20-Question Pack
          </button>
          <button
            type="button"
            onClick={() => void refreshMeta()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E0] bg-white px-3.5 py-2.5 text-xs font-bold text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors sm:w-auto"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* AI + DSA 4-week handbook — strictly restricted to super admin */}
      {sessionEmail?.trim().toLowerCase() === 'akash.k96.official@gmail.com' && (
        <HandbookCard />
      )}

      {packs.length > 0 && (
        <div className="min-w-0 rounded-2xl border border-[#E5E5E0] bg-white p-3 shadow-sm sm:rounded-[1.5rem] sm:p-5">
          <h3 className="text-sm font-bold text-[#1C1C1E]">Recent packs</h3>
          <ul className="mt-3 divide-y divide-[#E5E5E0]">
            {packs.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-[#1C1C1E] [overflow-wrap:anywhere]">
                    {(p.company || 'Company') + ' · ' + (p.role || 'Role')}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    {new Date(p.createdAt).toLocaleString()} · {packTotal(p.counts)} Q · C
                    {p.counts.coding} / SD{p.counts.systemDesign} / B{p.counts.behavioral}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadPack(p.id)}
                  className="min-h-10 w-full shrink-0 rounded-xl border border-[#E5E5E0] px-3 py-2 text-xs font-bold text-[#475569] active:bg-[#FAFAF8] sm:w-auto sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[11px]"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
