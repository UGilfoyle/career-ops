'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Check,
  IndianRupee,
  Loader2,
  Smartphone,
  X,
  ArrowRight,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { UpiMark } from '@/components/billing/UpiMark';

type Step = 'pay' | 'utr' | 'admin' | 'done';

/**
 * Local-only visual simulation of UPI SaaS billing flow.
 * No real payment / DB — for demo in browser.
 * Tip: ?step=admin or ?step=done for deep links.
 */
export default function BillingSimulateClient() {
  const sp = useSearchParams();
  // Demo payee only — the real VPA lives in UPI_VPA env, never in source.
  const upiUri =
    'upi://pay?pa=demo%40upi&pn=Career-Ops%20Demo&am=99.00&cu=INR&tn=Simulation%20only&tr=COSIM1234';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`;

  const [step, setStep] = useState<Step>('pay');
  const [utr, setUtr] = useState('123456789012');
  const [busy, setBusy] = useState(false);
  const [claimStatus, setClaimStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    const q = sp.get('step') as Step | null;
    if (q === 'pay' || q === 'utr' || q === 'admin' || q === 'done') {
      setStep(q);
      if (q === 'admin') setClaimStatus('pending');
      if (q === 'done') setClaimStatus('approved');
    }
  }, [sp]);

  const claim = useMemo(
    () => ({
      email: 'demo.user@example.com',
      amount: 99,
      utr,
      ref: 'COSIM1234',
      createdAt: new Date().toLocaleString('en-IN'),
    }),
    [utr],
  );

  function simulatePaid() {
    setStep('utr');
  }

  function submitUtr(e: React.FormEvent) {
    e.preventDefault();
    setStep('admin');
    setClaimStatus('pending');
  }

  async function adminAction(action: 'approve' | 'reject') {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setClaimStatus(action === 'approve' ? 'approved' : 'rejected');
    setBusy(false);
    if (action === 'approve') setStep('done');
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 inline-block px-3 py-1 rounded-full">
            Local simulation · no real money
          </p>
          <h1 className="text-2xl font-bold text-[#1C1C1E]">Career-Ops Pro · UPI billing demo</h1>
          <p className="text-sm text-[#6B6B6B] max-w-xl mx-auto">
            Pay → UTR submit → Admin dashboard approve → Access email. Same flow as production, mocked locally.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 text-[10px] font-bold uppercase tracking-wider">
          {[
            { id: 'pay' as const, label: '1. Pay' },
            { id: 'utr' as const, label: '2. UTR' },
            { id: 'admin' as const, label: '3. Admin' },
            { id: 'done' as const, label: '4. Access mail' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setStep(s.id);
                if (s.id === 'admin') setClaimStatus('pending');
                if (s.id === 'done') setClaimStatus('approved');
              }}
              className={`px-3 py-1.5 rounded-full border ${
                step === s.id
                  ? 'bg-[#1C1C1E] text-white border-[#1C1C1E]'
                  : 'bg-white text-[#6B6B6B] border-[#E5E5E0]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="bg-white border border-[#E5E5E0] rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center border-b border-[#E5E5E0] bg-[#FAFAF8]/50">
              <div className="flex items-center justify-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B]">User view</p>
                <UpiMark size={16} />
              </div>
              <h2 className="text-3xl font-bold text-[#1C1C1E] mt-1">₹99</h2>
              <p className="text-xs text-[#6B6B6B]">per month · zero gateway fees</p>
            </div>
            <div className="p-6 space-y-4">
              {(step === 'pay' || step === 'utr') && (
                <>
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="UPI QR" width={200} height={200} className="rounded-xl border border-[#E5E5E0]" />
                  </div>
                  <a
                    href={upiUri}
                    className="flex items-center justify-center gap-2 w-full bg-[#2563EB] text-white font-semibold text-sm py-3 rounded-xl"
                  >
                    <Smartphone size={16} /> Pay with any UPI app
                  </a>
                  <p className="text-center font-mono text-sm font-semibold">de••••pi</p>
                  <p className="text-center text-[10px] text-[#9CA3AF]">
                    Masked on screen — full UPI ID only appears in the payment app after scanning
                  </p>
                </>
              )}

              {step === 'pay' && (
                <button
                  type="button"
                  onClick={simulatePaid}
                  className="w-full bg-[#1C1C1E] text-white font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2"
                >
                  Simulate “I paid ₹99” <ArrowRight size={14} />
                </button>
              )}

              {step === 'utr' && (
                <form onSubmit={submitUtr} className="pt-2 border-t border-[#E5E5E0] space-y-3">
                  <p className="text-sm font-semibold">Already paid? Paste UTR</p>
                  <input
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    className="w-full border border-[#E5E5E0] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1C1C1E]"
                    placeholder="12-digit UTR"
                  />
                  <button type="submit" className="w-full bg-[#1C1C1E] text-white font-semibold text-sm py-3 rounded-xl">
                    Submit for verification
                  </button>
                </form>
              )}

              {(step === 'admin' || step === 'done') && claimStatus === 'pending' && (
                <div className="space-y-3 py-2">
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <Clock size={18} className="text-amber-700 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Payment under verification</p>
                      <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                        We already have your payment details. Pro unlocks as soon as we confirm it — no need to pay again.
                      </p>
                      <p className="text-[11px] font-mono text-amber-900/70 mt-2">UTR {claim.utr}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 border border-[#E5E5E0] rounded-xl py-2.5 text-xs font-semibold text-[#1C1C1E]"
                  >
                    <RefreshCw size={14} /> Check verification status
                  </button>
                  <p className="text-[11px] text-[#9CA3AF] text-center">
                    Re-opening the paywall in this state shows this panel — never the pay button again.
                  </p>
                </div>
              )}

              {(step === 'admin' || step === 'done') && claimStatus !== 'pending' && (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm font-semibold text-[#1C1C1E]">
                    {claimStatus === 'approved' ? 'Pro unlocked ✓' : 'Payment rejected'}
                  </p>
                  <p className="text-xs text-[#6B6B6B]">UTR {claim.utr}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E0] rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-[#E5E5E0] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1C1C1E] flex items-center gap-2">
                  <IndianRupee size={18} /> Admin · UPI Payments
                </h2>
                <p className="text-xs text-[#6B6B6B]">Check bank SMS, then Approve / Reject</p>
              </div>
              {step !== 'pay' && claimStatus === 'pending' && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                  1 pending
                </span>
              )}
            </div>

            <div className="p-6">
              {step === 'pay' && (
                <p className="text-sm text-[#9CA3AF] text-center py-16">No payment requests yet. Complete user side first.</p>
              )}

              {step !== 'pay' && (
                <div className="border border-[#E5E5E0] rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#1C1C1E]">{claim.email}</span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        claimStatus === 'pending'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : claimStatus === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                    >
                      {claimStatus}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="font-bold">₹{claim.amount}</span>
                    <span className="text-[#6B6B6B]"> · UTR </span>
                    <span className="font-mono text-xs">{claim.utr}</span>
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Ref {claim.ref} · {claim.createdAt}
                  </p>
                  <p className="text-xs text-[#6B6B6B] bg-[#FAFAF8] rounded-xl p-3">
                    Admin checks PhonePe/ICICI: did ₹99 arrive from this UTR? If yes → Approve.
                  </p>
                  {claimStatus === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void adminAction('approve')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void adminAction('reject')}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 border border-[#E5E5E0] text-[#6B6B6B] text-xs font-bold py-2.5 rounded-xl"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}

              {step === 'done' && (
                <div className="mt-4 border border-emerald-200 bg-emerald-50 rounded-2xl p-4 text-sm text-emerald-900 space-y-2">
                  <p className="font-bold">Access email sent to {claim.email}</p>
                  <p className="text-xs">
                    Subject: Your Career-Ops Pro access link
                    <br />
                    CTA → /auth/access?token=… → Resume Studio unlocked
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-[#9CA3AF]">
          Real production path: /billing/upi (user) · Admin tab → UPI Payments (approve)
        </p>
      </div>
    </div>
  );
}
