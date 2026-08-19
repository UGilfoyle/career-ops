'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  FileText,
  Github,
  RefreshCw,
  Scissors,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { AnalyticsSummary, DailyActivityRow, UserAnalyticsRow } from '@/lib/analytics/queries';

export type ProductAnalyticsPayload = {
  generated_at: string;
  summary: AnalyticsSummary;
  users: UserAnalyticsRow[];
  daily: DailyActivityRow[];
  notes?: Record<string, string>;
};

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function formatShortDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminProductAnalyticsPanel({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: ProductAnalyticsPayload | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState('');
  const summary = data?.summary;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.users || []).filter((u) => {
      if (!q) return true;
      return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || String(u.id).includes(q);
    });
  }, [data?.users, query]);

  const dailyMax = Math.max(...(data?.daily || []).map((d) => d.jobs_added + d.tailored_jobs), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1C1C1E] flex items-center gap-2">
            <BarChart3 size={22} />
            Product Analytics
          </h2>
          <p className="text-sm font-medium text-[#6B6B6B]">
            Accurate funnel: jobs sourced → tailored (DB deliverables) → GitHub runs → applications.
          </p>
          {data?.generated_at ? (
            <p className="mt-1 text-[10px] font-mono text-[#9CA3AF]">
              Generated {new Date(data.generated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E5E5E0] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#1C1C1E] hover:bg-[#FAFAF8] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        {[
          { label: 'Active (7d)', value: summary?.active_users_7d, icon: <Activity size={16} /> },
          { label: 'Total jobs', value: summary?.total_jobs, icon: <TrendingUp size={16} /> },
          { label: 'Tailored jobs', value: summary?.tailored_jobs, icon: <Scissors size={16} /> },
          { label: 'PDF on R2', value: summary?.resume_pdf_r2, icon: <FileText size={16} /> },
          { label: 'GH tailor runs', value: summary?.tailor_runs, icon: <Github size={16} /> },
          { label: 'Applications', value: summary?.total_applications, icon: <Users size={16} /> },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-[#E5E5E0] bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-[#9CA3AF]">{card.icon}</div>
            <div className="text-2xl font-bold text-[#1C1C1E]">{card.value ?? '—'}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">GitHub runs</div>
          <div className="mt-2 text-3xl font-bold text-[#1C1C1E]">{summary?.github_runs_total ?? '—'}</div>
          <div className="mt-2 text-xs text-[#6B6B6B]">
            {summary?.github_runs_success ?? 0} success · {summary?.github_runs_failure ?? 0} failed
          </div>
        </div>
        <div className="rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">Tailor success</div>
          <div className="mt-2 text-3xl font-bold text-[#1C1C1E]">
            {summary?.tailor_runs_success ?? 0}/{summary?.tailor_runs ?? 0}
          </div>
          <div className="mt-2 text-xs text-[#6B6B6B]">GH Actions completed successfully</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Deliverable rate</div>
          <div className="mt-2 text-3xl font-bold text-emerald-900">{pct(summary?.tailor_output_rate)}</div>
          <div className="mt-2 text-xs text-emerald-800">Tailored jobs ÷ tailor runs (platform)</div>
        </div>
      </div>

      {data?.daily && data.daily.length > 0 ? (
        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-6">
          <h3 className="mb-4 text-lg font-bold text-[#1C1C1E]">Last 14 days</h3>
          <div className="flex items-end gap-1.5 h-40">
            {data.daily.map((d) => {
              const total = d.jobs_added + d.tailored_jobs;
              const h = Math.max((total / dailyMax) * 100, 4);
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-[#1C1C1E]">{total || ''}</span>
                  <div className="flex w-full flex-col justify-end" style={{ height: '7rem' }}>
                    <div
                      className="w-full rounded-t bg-violet-500"
                      style={{ height: `${h}%` }}
                      title={`${d.date}: +${d.jobs_added} jobs, ${d.tailored_jobs} tailored, ${d.github_runs} GH runs`}
                    />
                  </div>
                  <span className="text-[8px] text-[#9CA3AF] font-mono">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="relative w-full max-w-sm">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter users…"
          className="w-full rounded-xl border border-[#E5E5E0] bg-white py-2.5 px-4 text-sm outline-none focus:border-[#1C1C1E]"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="border-b border-[#F5F5F0] bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Jobs</th>
                <th className="px-4 py-3">Tailored</th>
                <th className="px-4 py-3">HTML</th>
                <th className="px-4 py-3">R2 PDF</th>
                <th className="px-4 py-3">Apps</th>
                <th className="px-4 py-3">GH runs</th>
                <th className="px-4 py-3">Tailor runs</th>
                <th className="px-4 py-3">Last tailored</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[#9CA3AF]">
                    Loading analytics…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[#9CA3AF]">
                    No users match.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-[#F5F5F0] last:border-0 hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1C1C1E]">{u.name || '—'}</div>
                      <div className="text-xs text-[#6B6B6B]">{u.email}</div>
                      <div className="text-[10px] text-[#9CA3AF]">#{u.id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{u.jobs_count}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-violet-700">{u.tailored_jobs}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.resume_html_count}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.resume_pdf_r2_count}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.applications_count}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {u.github_runs_success}/{u.github_runs_total}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {u.tailor_runs_success}/{u.tailor_runs}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6B6B6B]">{formatShortDate(u.last_tailored_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
