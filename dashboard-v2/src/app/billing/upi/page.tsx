'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Copy, Check, Smartphone, ArrowLeft, Clock, RefreshCw } from 'lucide-react';

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
  vpa?: string;
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
  const [copied, setCopied] = useState<'link' | 'vpa' | null>(null);
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

  async function copyText(text: string, kind: 'link' | 'vpa') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
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
    <div className="min-h-screen bg-[#FAFAF8] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B6B6B] mb-6 hover:text-[#1C1C1E]">
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="bg-white border border-[#E5E5E0] rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 pt-8 pb-4 text-center border-b border-[#E5E5E0] bg-[#FAFAF8]/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-1">Career-Ops Pro · UPI</p>
            <h1 className="text-3xl font-bold text-[#1C1C1E]">{data?.display || '₹99'}</h1>
            <p className="text-xs text-[#6B6B6B] mt-1">per month · zero payment gateway fees</p>
            {data?.zeroFees && (
              <p className="text-[11px] text-emerald-700 mt-2 font-medium">Direct UPI — no Razorpay/Stripe cut</p>
            )}
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
            {data?.qrUrl && (
              <div className="flex justify-center">
                <img src={data.qrUrl} alt="UPI QR code" width={220} height={220} className="rounded-xl border border-[#E5E5E0]" />
              </div>
            )}

            {data?.upiUri && (
              <a
                href={data.upiUri}
                className="flex items-center justify-center gap-2 w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm py-3.5 rounded-xl transition"
              >
                <Smartphone size={18} />
                Pay with any UPI app
              </a>
            )}

            <div className="text-center space-y-1">
              <p className="text-xs text-[#6B6B6B]">Pay to</p>
              <p className="font-mono text-sm font-semibold text-[#1C1C1E]">{data?.vpa}</p>
              {data?.transactionRef && (
                <p className="text-[10px] text-[#9CA3AF]">Ref: {data.transactionRef} (include in UPI note if possible)</p>
              )}
            </div>

            <div className="flex gap-2">
              {data?.upiUri && (
                <button
                  type="button"
                  onClick={() => void copyText(data.upiUri!, 'link')}
                  className="flex-1 flex items-center justify-center gap-2 border border-[#E5E5E0] rounded-xl py-2.5 text-xs font-semibold text-[#1C1C1E] hover:bg-[#FAFAF8]"
                >
                  {copied === 'link' ? <Check size={14} /> : <Copy size={14} />}
                  Copy UPI link
                </button>
              )}
              {data?.vpa && (
                <button
                  type="button"
                  onClick={() => void copyText(data.vpa!, 'vpa')}
                  className="flex-1 flex items-center justify-center gap-2 border border-[#E5E5E0] rounded-xl py-2.5 text-xs font-semibold text-[#1C1C1E] hover:bg-[#FAFAF8]"
                >
                  {copied === 'vpa' ? <Check size={14} /> : <Copy size={14} />}
                  Copy UPI ID
                </button>
              )}
            </div>

            <form onSubmit={submitUtr} className="pt-4 border-t border-[#E5E5E0] space-y-3">
              {data?.claim?.status === 'rejected' && (
                <p className="text-xs text-red-600 leading-relaxed">
                  {data.claim.message}
                </p>
              )}
              <p className="text-sm font-semibold text-[#1C1C1E]">Already paid?</p>
              <p className="text-xs text-[#6B6B6B] leading-relaxed">
                Paste the 12-digit UPI transaction ID from PhonePe, GPay, or your bank SMS. We verify manually and activate Pro (usually within a few hours).
              </p>
              <input
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="UPI transaction ID / UTR"
                className="w-full border border-[#E5E5E0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1C1C1E]"
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
        </div>

        <p className="text-[11px] text-center text-[#9CA3AF] mt-4 max-w-sm mx-auto">
          This link never expires (unlike third-party UPI page generators). Same as scanning a static QR on your shop.
        </p>
      </div>
    </div>
  );
}
