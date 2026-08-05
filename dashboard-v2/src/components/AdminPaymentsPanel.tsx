'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, IndianRupee, Loader2, RefreshCw, X } from 'lucide-react';

type UpiClaim = {
  id: number;
  userId: string;
  userEmail: string;
  amountInr: number;
  upiVpa: string;
  transactionRef: string | null;
  utr: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
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

export default function AdminPaymentsPanel() {
  const [claims, setClaims] = useState<UpiClaim[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/billing/upi/claims?status=${filter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load payments');
      setClaims(data.claims || []);
      setPendingCount(data.pendingCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(claimId: number, action: 'approve' | 'reject') {
    setBusyId(claimId);
    setError('');
    try {
      const res = await fetch('/api/billing/upi/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1C1C1E] flex items-center gap-2">
            <IndianRupee size={22} />
            UPI Payments
            {pendingCount > 0 && (
              <span className="text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </h2>
          <p className="text-sm text-[#6B6B6B] mt-1">
            User pays → submits UTR → you check bank SMS → Approve / Reject. Approve emails Pro access link.
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

      <div className="flex gap-2">
        {(['pending', 'all', 'approved', 'rejected'] as const).map((f) => (
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
        {loading && claims.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-[#1C1C1E]" size={24} />
          </div>
        ) : claims.length === 0 ? (
          <p className="text-center text-sm text-[#9CA3AF] py-16">No {filter === 'all' ? '' : filter} payment requests.</p>
        ) : (
          <div className="divide-y divide-[#E5E5E0]">
            {claims.map((c) => (
              <div key={c.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#1C1C1E] truncate">{c.userEmail}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        c.status === 'pending'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : c.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#1C1C1E]">
                    <span className="font-bold">₹{c.amountInr}</span>
                    <span className="text-[#6B6B6B]"> · UTR </span>
                    <span className="font-mono text-xs">{c.utr}</span>
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Ref {c.transactionRef || '—'} · {formatWhen(c.createdAt)}
                    {c.reviewedBy ? ` · by ${c.reviewedBy}` : ''}
                  </p>
                </div>

                {c.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void review(c.id, 'approve')}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-50"
                    >
                      {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void review(c.id, 'reject')}
                      className="inline-flex items-center gap-1.5 border border-[#E5E5E0] text-[#6B6B6B] hover:border-red-300 hover:text-red-700 text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-50"
                    >
                      <X size={14} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
