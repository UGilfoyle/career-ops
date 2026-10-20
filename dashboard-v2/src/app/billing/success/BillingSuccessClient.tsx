'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function BillingSuccessClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const sessionId = sp.get('session_id');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [msg, setMsg] = useState('Confirming your Pro subscription…');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMsg('Missing checkout session.');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/billing/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Confirm failed');
        setStatus('ok');
        setMsg('Pro is active. Check your email for the access link, or open Resume Studio now.');
        setTimeout(() => router.push('/?tab=resume-studio'), 2500);
      } catch (e) {
        setStatus('error');
        setMsg(e instanceof Error ? e.message : 'Could not confirm payment');
      }
    })();
  }, [sessionId, router]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#E2E8F0] rounded-3xl p-8 text-center shadow-sm">
        {status === 'loading' && <Loader2 className="mx-auto mb-4 animate-spin text-[#0F172A]" size={32} />}
        {status === 'ok' && <CheckCircle2 className="mx-auto mb-4 text-emerald-600" size={36} />}
        <h1 className="text-lg font-bold text-[#0F172A] mb-2">Payment received</h1>
        <p className="text-sm text-[#6B6B6B] mb-6">{msg}</p>
        <Link href="/" className="text-sm font-semibold text-[#0F172A] underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
