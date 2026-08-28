'use client';

import { useCallback, useEffect, useState } from 'react';
import { Crown, IndianRupee, Loader2, RefreshCw, Users } from 'lucide-react';

type SubscriptionRow = {
  userId: string;
  userEmail: string | null;
  userName: string | null;
  status: string;
  plan: string;
  provider: string | null;
  countryCode: string | null;
  currency: string | null;
  amountMinor: number | null;
  currentPeriodEnd: string | null;
  externalRef: string | null;
  updatedAt: string | null;
};

type RecentUpi = {
  id: number;
  userEmail: string;
  amountInr: number;
  utr: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type SubscriptionsPayload = {
  summary: {
    activePro: number;
    pendingUpi: number;
    approvedUpi: number;
    totalInrCollected: number;
    totalInrDisplay: string;
    inrThisMonth: number;
    inrThisMonthDisplay: string;
    approvedThisMonth: number;
  };
  subscriptions: SubscriptionRow[];
  recentUpiApproved: RecentUpi[];
};

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function providerLabel(provider: string | null) {
  if (!provider) return '—';
  if (provider === 'upi_direct') return 'UPI';
  if (provider === 'stripe') return 'Stripe';
  return provider;
}

export default function AdminSubscriptionsPanel() {
  const [data, setData] = useState<SubscriptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/subscriptions');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load subscriptions');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1C1C1E] flex items-center gap-2">
            <Crown size={22} />
            Pro Subscriptions
          </h2>
          <p className="text-sm text-[#6B6B6B] mt-1">
            Active Pro users and UPI revenue. Stripe only appears if you enable{' '}
            <code className="text-xs bg-[#F5F5F0] px-1 rounded">BILLING_STRIPE_ENABLED=1</code>.
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Pro', value: String(summary.activePro), icon: Users },
            { label: 'UPI pending', value: String(summary.pendingUpi), icon: IndianRupee },
            { label: 'Collected (all time)', value: summary.totalInrDisplay, icon: IndianRupee },
            { label: 'This month', value: summary.inrThisMonthDisplay, icon: IndianRupee },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="bg-white border border-[#E5E5E0] rounded-2xl px-5 py-4"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                <Icon size={12} />
                {label}
              </div>
              <div className="text-2xl font-bold text-[#1C1C1E]">{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-[#E5E5E0] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E0]">
          <h3 className="text-sm font-bold text-[#1C1C1E]">Active subscribers</h3>
        </div>
        {loading && !data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-[#1C1C1E]" size={24} />
          </div>
        ) : !data?.subscriptions?.length ? (
          <p className="text-center text-sm text-[#9CA3AF] py-16">No active Pro subscriptions yet.</p>
        ) : (
          <div className="divide-y divide-[#E5E5E0]">
            {data.subscriptions.map((s) => (
              <div
                key={s.userId}
                className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-2 justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[#1C1C1E] truncate">
                    {s.userEmail || `user #${s.userId}`}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    {providerLabel(s.provider)}
                    {s.currentPeriodEnd ? ` · until ${formatWhen(s.currentPeriodEnd)}` : ''}
                    {s.externalRef && s.provider === 'upi_direct' ? ` · UTR ${s.externalRef}` : ''}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200 shrink-0">
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {data?.recentUpiApproved && data.recentUpiApproved.length > 0 && (
        <div className="bg-white border border-[#E5E5E0] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E5E0]">
            <h3 className="text-sm font-bold text-[#1C1C1E]">Recent UPI approvals</h3>
          </div>
          <div className="divide-y divide-[#E5E5E0]">
            {data.recentUpiApproved.map((r) => (
              <div key={r.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-[#1C1C1E] truncate">{r.userEmail}</span>
                <span className="text-[#6B6B6B]">
                  <span className="font-bold text-[#1C1C1E]">₹{r.amountInr}</span>
                  {' · '}
                  <span className="font-mono text-xs">{r.utr}</span>
                  {' · '}
                  {formatWhen(r.reviewedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
