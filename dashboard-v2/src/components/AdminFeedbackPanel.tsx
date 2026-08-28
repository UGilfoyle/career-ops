'use client';

import { useCallback, useEffect, useState } from 'react';
import { Heart, Loader2, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';

type FeedbackItem = {
  id: number;
  userEmail: string;
  score: number;
  scoreLabel: string;
  comment: string | null;
  context: string | null;
  updatedAt: string | null;
};

type FeedbackPayload = {
  summary: {
    total: number;
    avgScore: number;
    promoters: number;
    detractors: number;
    satisfiedPct: number;
    distribution: Record<string, number>;
  };
  feedback: FeedbackItem[];
};

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminFeedbackPanel() {
  const [data, setData] = useState<FeedbackPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'happy' | 'unhappy'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs =
        filter === 'happy'
          ? '?minScore=4'
          : filter === 'unhappy'
            ? '?maxScore=2'
            : '';
      const res = await fetch(`/api/admin/feedback${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load feedback');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const dist = summary?.distribution || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1C1C1E] flex items-center gap-2">
            <Heart size={22} />
            User Feedback
          </h2>
          <p className="text-sm text-[#6B6B6B] mt-1">
            Stored in Postgres table <code className="text-xs bg-[#F5F5F0] px-1 rounded">product_feedback</code>
            {' '}— one row per user, updatable from Settings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider border border-[#E5E5E0] px-3 py-2 rounded-xl hover:border-[#1C1C1E]"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Responses', value: String(summary.total) },
            { label: 'Avg rating', value: summary.total ? `${summary.avgScore}/5` : '—' },
            { label: 'Happy (4–5)', value: String(summary.promoters), icon: ThumbsUp },
            { label: 'Unhappy (1–2)', value: String(summary.detractors), icon: ThumbsDown },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white border border-[#E5E5E0] rounded-2xl px-5 py-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                {Icon ? <Icon size={12} /> : null}
                {label}
              </div>
              <div className="text-2xl font-bold text-[#1C1C1E]">{value}</div>
            </div>
          ))}
        </div>
      )}

      {summary && summary.total > 0 && (
        <div className="bg-white border border-[#E5E5E0] rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
            Score distribution
          </p>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const count = dist[String(n)] || 0;
              const pct = summary.total ? Math.round((count / summary.total) * 100) : 0;
              return (
                <div key={n} className="flex items-center gap-3 text-xs">
                  <span className="w-8 font-bold text-[#6B6B6B]">{n}★</span>
                  <div className="flex-1 h-2 bg-[#F5F5F0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1C1C1E] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-[#9CA3AF]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['all', 'happy', 'unhappy'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${
              filter === f
                ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]'
                : 'bg-white text-[#6B6B6B] border-[#E5E5E0] hover:border-[#1C1C1E]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white border border-[#E5E5E0] rounded-2xl overflow-hidden">
        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-[#1C1C1E]" size={24} />
          </div>
        ) : !data?.feedback?.length ? (
          <p className="text-center text-sm text-[#9CA3AF] py-16">No feedback yet.</p>
        ) : (
          <div className="divide-y divide-[#E5E5E0]">
            {data.feedback.map((f) => (
              <div key={f.id} className="p-5 space-y-2">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <span className="font-semibold text-[#1C1C1E] truncate">{f.userEmail}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      f.score >= 4
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : f.score <= 2
                          ? 'bg-red-50 text-red-800 border-red-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {f.score}/5 · {f.scoreLabel}
                  </span>
                </div>
                {f.comment && (
                  <p className="text-sm text-[#6B6B6B] leading-relaxed whitespace-pre-wrap">{f.comment}</p>
                )}
                <p className="text-[11px] text-[#9CA3AF]">
                  {formatWhen(f.updatedAt)}
                  {f.context ? ` · via ${f.context}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
