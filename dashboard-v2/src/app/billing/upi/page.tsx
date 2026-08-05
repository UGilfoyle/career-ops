'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  Smartphone,
  ArrowLeft,
  Clock,
  RefreshCw,
  ShieldCheck,
  Infinity as InfinityIcon,
  BadgePercent,
  ScanLine,
  EyeOff,
} from 'lucide-react';
import { UpiAppsRow, UpiMark, UpiTagline } from '@/components/billing/UpiMark';

type UpiClaim = {
  id: number;
  status: string;
  utr?: string;
  submittedAt?: string | null;
  message?: string;
};

type UpiPayload = {
  hasPro: boolean;
  claim?: UpiClaim | null;
  awaitingReview?: boolean;
  /** Masked handle only — the real VPA lives inside the QR / deep link. */
  vpaMasked?: string;
  payeeName?: string;
  amountInr?: number;
  display?: string;
  note?: string;
  upiUri?: string;
  qrUrl?: string;
  transactionRef?: string;
  zeroFees?: boolean;
};

export default function UpiCheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UpiPayload | null>(null);
  const [error, setError] = useState('');
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState('');
  const [checking, setChecking] = useState(false);

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/billing/upi');
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Could not load UPI checkout');
    setData(json);
    return json as UpiPayload;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const json = await loadStatus();
        if (json.hasPro) {
          setTimeout(() => router.push('/?tab=resume-studio'), 1500);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [router, loadStatus]);

  const awaitingReview = data?.awaitingReview || data?.claim?.status === 'pending';

  async function refreshStatus() {
    setChecking(true);
    setError('');
    try {
      const json = await loadStatus();
      if (json.hasPro) {
        router.push('/?tab=resume-studio');
        return;
      }
      setSubmitted(json.claim?.message || 'Still under verification.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not refresh status');
    } finally {
      setChecking(false);
    }
  }

  async function submitUtr(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.transactionRef) return;
    setSubmitting(true);
    setSubmitted('');
    setError('');
    try {
      const res = await fetch('/api/billing/upi/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr, transactionRef: data.transactionRef }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submit failed');
      setSubmitted(json.message || 'Submitted for verification');
      setUtr('');
      // Re-read server state so the page flips to the pending view instead of
      // offering another payment.
      await loadStatus().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit UTR');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1C1C1E]" size={32} />
      </div>
    );
  }

  if (data?.hasPro) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-[#1C1C1E] font-semibold">Pro is already active.</p>
          <Link href="/?tab=resume-studio" className="text-sm underline mt-2 inline-block">Open Resume Studio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-8 px-4">
      <div className="max-w-md mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B6B6B] mb-5 hover:text-[#1C1C1E]"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="bg-white border border-[#E5E5E0] rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] overflow-hidden">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-7 bg-[#0B1B34] text-white overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.14] pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 85% 0%, #F26522 0%, transparent 45%), radial-gradient(circle at 10% 100%, #0F9D58 0%, transparent 45%)',
              }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
                  Career-Ops Pro
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-4xl font-bold tracking-tight">{data?.display || '₹99'}</span>
                  <span className="text-xs font-medium text-white/60">/ month</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 pt-1">
                <span className="bg-white rounded-lg px-2 py-1 inline-flex items-center">
                  <UpiMark size={18} />
                </span>
                <UpiTagline tone="light" />
              </div>
            </div>
            <div className="relative flex items-center gap-1.5 mt-4 text-[11px] font-medium text-white/70">
              <ShieldCheck size={13} />
              Bank-to-bank UPI transfer · no card details stored
            </div>
          </div>

          <div className="p-6 space-y-5">
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            {submitted && !awaitingReview && (
              <p className="text-sm text-emerald-700 text-center font-medium">{submitted}</p>
            )}

            {awaitingReview ? (
              <div className="space-y-5">
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                  <Clock size={18} className="text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Payment under verification</p>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      {data?.claim?.message ||
                        'We already have your payment details. Pro unlocks as soon as we confirm it — no need to pay again.'}
                    </p>
                    {data?.claim?.utr && (
                      <p className="text-[11px] font-mono text-amber-900/70 mt-2">UTR {data.claim.utr}</p>
                    )}
                    {data?.claim?.submittedAt && (
                      <p className="text-[11px] text-amber-900/70">
                        Submitted {new Date(data.claim.submittedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshStatus()}
                  disabled={checking}
                  className="w-full flex items-center justify-center gap-2 border border-[#E5E5E0] rounded-xl py-3 text-sm font-semibold text-[#1C1C1E] hover:bg-[#FAFAF8] disabled:opacity-60"
                >
                  {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Check verification status
                </button>
                <Link
                  href="/"
                  className="block text-center text-xs font-semibold text-[#6B6B6B] hover:text-[#1C1C1E]"
                >
                  Back to dashboard
                </Link>
              </div>
            ) : (
              <>
                {/* QR — the only place the real UPI ID travels */}
                {data?.qrUrl && (
                  <div className="flex flex-col items-center">
                    <div className="relative p-3 bg-white rounded-2xl border border-[#E5E5E0]">
                      <span className="absolute top-1.5 left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#F26522] rounded-tl-md" />
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#0F9D58] rounded-tr-md" />
                      <span className="absolute bottom-1.5 left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#0F9D58] rounded-bl-md" />
                      <span className="absolute bottom-1.5 right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#F26522] rounded-br-md" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={data.qrUrl}
                        alt="UPI QR code"
                        width={220}
                        height={220}
                        className="block rounded-lg"
                      />
                    </div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[#1C1C1E] mt-3">
                      <ScanLine size={14} /> Scan to pay {data?.display || '₹99'}
                    </p>
                    <div className="mt-2.5">
                      <UpiAppsRow />
                    </div>
                  </div>
                )}

                {data?.upiUri && (
                  <a
                    href={data.upiUri}
                    className="flex items-center justify-center gap-2 w-full bg-[#0B1B34] hover:bg-black text-white font-semibold text-sm py-3.5 rounded-xl transition"
                  >
                    <Smartphone size={17} />
                    Open UPI app on this phone
                  </a>
                )}

                {/* Payee — handle stays masked on screen */}
                <div className="bg-[#FAFAF8] border border-[#E5E5E0] rounded-2xl px-4 py-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      Paying to
                    </span>
                    <span className="text-sm font-semibold text-[#1C1C1E]">{data?.payeeName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      UPI ID
                    </span>
                    <span className="font-mono text-sm font-semibold text-[#1C1C1E] tracking-tight">
                      {data?.vpaMasked}
                    </span>
                  </div>
                  <p className="flex items-start gap-1.5 text-[11px] text-[#6B6B6B] leading-relaxed pt-1 border-t border-[#E5E5E0]">
                    <EyeOff size={12} className="mt-0.5 shrink-0" />
                    Hidden for security. The full UPI ID appears inside your payment app after you
                    scan the QR.
                  </p>
                  {data?.transactionRef && (
                    <p className="text-[10px] text-[#9CA3AF]">
                      Reference {data.transactionRef} — auto-attached to your payment
                    </p>
                  )}
                </div>

                <form onSubmit={submitUtr} className="pt-4 border-t border-[#E5E5E0] space-y-3">
                  {data?.claim?.status === 'rejected' && (
                    <p className="text-xs text-red-600 leading-relaxed">{data.claim.message}</p>
                  )}
                  <p className="text-sm font-semibold text-[#1C1C1E]">Already paid?</p>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">
                    Paste the 12-digit UPI transaction ID from PhonePe, GPay, or your bank SMS. We
                    verify manually and activate Pro (usually within a few hours).
                  </p>
                  <input
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    placeholder="UPI transaction ID / UTR"
                    className="w-full border border-[#E5E5E0] rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-[#1C1C1E]"
                    maxLength={22}
                  />
                  <button
                    type="submit"
                    disabled={submitting || !utr.trim()}
                    className="w-full bg-[#1C1C1E] text-white font-semibold text-sm py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                    Submit payment for verification
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-3 border-t border-[#E5E5E0] bg-[#FAFAF8]/60 divide-x divide-[#E5E5E0]">
            {[
              { icon: BadgePercent, label: 'Zero gateway fees' },
              { icon: InfinityIcon, label: 'QR never expires' },
              { icon: ShieldCheck, label: 'Manually verified' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 px-2 py-3 text-center">
                <Icon size={14} className="text-[#6B6B6B]" />
                <span className="text-[10px] font-semibold text-[#6B6B6B] leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-center text-[#9CA3AF] mt-4 max-w-sm mx-auto leading-relaxed">
          Direct bank-to-bank UPI — same as scanning a shop QR. No Razorpay or Stripe cut, and the
          code never expires.
        </p>
      </div>
    </div>
  );
}
