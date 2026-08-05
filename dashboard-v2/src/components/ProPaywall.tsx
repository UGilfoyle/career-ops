'use client';

import { useState } from 'react';
import { Lock, Sparkles, Bot, Loader2 } from 'lucide-react';

type ProPaywallProps = {
  feature: 'resume-studio' | 'copilot';
  planDisplay: string;
  planSubtitle: string;
  copilotRemaining?: number;
  onUpgrade?: () => void;
};

export default function ProPaywall({
  feature,
  planDisplay,
  planSubtitle,
  copilotRemaining,
  onUpgrade,
}: ProPaywallProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const title =
    feature === 'resume-studio'
      ? 'Resume Studio is Pro'
      : 'Copilot limit reached';

  const desc =
    feature === 'resume-studio'
      ? 'Edit your master resume, live ATS preview, PDF export, and JD match — included with Pro.'
      : `Free plan: 10 Copilot messages every 2 hours${copilotRemaining != null ? ` (${copilotRemaining} left)` : ''}. Upgrade for unlimited coaching synced to your profile.`;

  async function startCheckout() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Checkout failed');
      if (data.provider === 'upi' && data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-6 py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#1C1C1E] text-white flex items-center justify-center mb-5 shadow-sm">
        {feature === 'resume-studio' ? <Sparkles size={26} /> : <Bot size={26} />}
      </div>
      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-2">
        <Lock size={12} /> Pro
      </div>
      <h2 className="text-xl font-bold text-[#1C1C1E] tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-[#6B6B6B] max-w-md leading-relaxed mb-6">{desc}</p>
      <div className="bg-white border border-[#E5E5E0] rounded-2xl px-8 py-5 mb-6 shadow-sm">
        <div className="text-3xl font-bold text-[#1C1C1E] tracking-tight">{planDisplay}</div>
        <div className="text-xs text-[#6B6B6B] mt-1">{planSubtitle}</div>
      </div>
      {error && <p className="text-sm text-red-600 mb-3 max-w-sm">{error}</p>}
      <button
        type="button"
        onClick={() => {
          onUpgrade?.();
          void startCheckout();
        }}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-[#1C1C1E] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-black transition disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        Unlock Pro — pay via UPI
      </button>
      <p className="text-[11px] text-[#9CA3AF] mt-4 max-w-xs">
        Pay ₹99 / $0.79 → submit UTR → we verify → Pro access email lands in your inbox.
      </p>
    </div>
  );
}
