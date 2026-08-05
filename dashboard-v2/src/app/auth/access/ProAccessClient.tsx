'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';

export default function ProAccessClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get('token');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your Pro access link…');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing access token.');
      return;
    }
    (async () => {
      try {
        const res = await fetch('/api/billing/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Redeem failed');
        setStatus('ok');
        setMessage('Pro access confirmed. Opening Resume Studio…');
        setTimeout(() => router.push('/?tab=resume-studio'), 2000);
      } catch (e) {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Link expired or invalid');
      }
    })();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#E5E5E0] rounded-3xl p-8 text-center shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-[#1C1C1E] text-white flex items-center justify-center mx-auto mb-4">
          {status === 'loading' ? <Loader2 size={22} className="animate-spin" /> : <Sparkles size={22} />}
        </div>
        <h1 className="text-lg font-bold text-[#1C1C1E] mb-2">Career-Ops Pro</h1>
        <p className="text-sm text-[#6B6B6B] mb-6">{message}</p>
        {status === 'error' && (
          <Link href="/login" className="text-sm font-semibold text-[#1C1C1E] underline">
            Log in to continue
          </Link>
        )}
      </div>
    </div>
  );
}
