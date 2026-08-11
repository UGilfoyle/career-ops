'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { canAccessPracticeBeta } from '@/lib/lifetime-access';
import ProPaywall, { type PendingPayment } from '../ProPaywall';
import PracticeComingSoon from './PracticeComingSoon';
import PracticePackView, { type PracticePackContent } from './PracticePackView';

type PipelineJob = {
  pipeline_id?: number | string;
  id?: number | string;
  company?: string;
  title?: string;
  role?: string;
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
  planDisplay: string;
  planSubtitle: string;
  pendingPayment?: PendingPayment | null;
  onUpgrade?: () => void;
};

export default function PracticePanel({
  pipeline = [],
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

  const sessionEmail = session?.user?.email ?? null;
  const clientBetaAllowed =
    sessionStatus === 'authenticated' && canAccessPracticeBeta(sessionEmail);

  const jobs = pipeline.slice(0, 80).map((j) => ({
    id: String(j.pipeline_id ?? j.id ?? ''),
    company: j.company || 'Company',
    title: j.title || j.role || 'Role',
  })).filter((j) => j.id);

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
      const body =
        mode === 'job'
          ? { jobId: Number(jobId) }
          : { jdText, company, role };

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
            : prev?.banner || '1 JD practice pack / week · Pro unlocks unlimited',
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1C1C1E]">Interview Practice</h2>
          <p className="mt-0.5 text-xs font-medium text-[#6B6B6B]">
            JD-linked coding, system design, and behavioral packs — no live runner.
          </p>
        </div>
        {quota && (
          <div className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-xs font-semibold text-[#475569]">
            {quota.banner}
            {!quota.pro && quota.resetAt && quota.remaining === 0 && (
              <span className="mt-0.5 block text-[10px] font-medium text-[#9CA3AF]">
                Resets {new Date(quota.resetAt).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>

      {showPaywall && (
        <ProPaywall
          feature="practice"
          planDisplay={planDisplay}
          planSubtitle={planSubtitle}
          pendingPayment={pendingPayment}
          onUpgrade={onUpgrade}
        />
      )}

      <div className="rounded-[1.5rem] border border-[#E5E5E0] bg-white p-5 shadow-sm">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('job')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
              mode === 'job' ? 'bg-[#1C1C1E] text-white' : 'bg-[#F4F4F0] text-[#6B6B6B]'
            }`}
          >
            Pipeline job
          </button>
          <button
            type="button"
            onClick={() => setMode('paste')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
              mode === 'paste' ? 'bg-[#1C1C1E] text-white' : 'bg-[#F4F4F0] text-[#6B6B6B]'
            }`}
          >
            Paste JD
          </button>
        </div>

        {mode === 'job' ? (
          <label className="block text-xs font-bold text-[#6B6B6B]">
            Select job
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#1C1C1E]"
            >
              <option value="">Choose…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.company} — {j.title}
                </option>
              ))}
            </select>
            {jobs.length === 0 && (
              <span className="mt-1 block text-[11px] font-medium text-[#9CA3AF]">
                No pipeline jobs yet — paste a JD instead, or run a scan.
              </span>
            )}
          </label>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-[#6B6B6B]">
                Company
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2.5 text-sm"
                  placeholder="Acme"
                />
              </label>
              <label className="block text-xs font-bold text-[#6B6B6B]">
                Role
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2.5 text-sm"
                  placeholder="Senior Backend Engineer"
                />
              </label>
            </div>
            <label className="block text-xs font-bold text-[#6B6B6B]">
              Job description
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                rows={8}
                className="mt-1.5 w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-3 py-2.5 text-sm"
                placeholder="Paste the full JD here…"
              />
            </label>
          </div>
        )}

        {error && !showPaywall && (
          <p className="mt-3 text-xs font-semibold text-rose-600">{error}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void generate()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generate practice pack
          </button>
          <button
            type="button"
            onClick={() => void refreshMeta()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E5E0] px-3 py-2.5 text-xs font-bold text-[#6B6B6B]"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {activePack && (
        <div className="rounded-[1.5rem] border border-[#E5E5E0] bg-white p-5 shadow-sm">
          <PracticePackView
            content={activePack.content}
            company={activePack.company}
            role={activePack.role}
          />
        </div>
      )}

      {packs.length > 0 && (
        <div className="rounded-[1.5rem] border border-[#E5E5E0] bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#1C1C1E]">Recent packs</h3>
          <ul className="mt-3 divide-y divide-[#E5E5E0]">
            {packs.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#1C1C1E]">
                    {(p.company || 'Company') + ' · ' + (p.role || 'Role')}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    {new Date(p.createdAt).toLocaleString()} · C{p.counts.coding} / SD
                    {p.counts.systemDesign} / B{p.counts.behavioral}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadPack(p.id)}
                  className="shrink-0 rounded-lg border border-[#E5E5E0] px-2.5 py-1 text-[11px] font-bold text-[#475569] hover:bg-[#FAFAF8]"
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
