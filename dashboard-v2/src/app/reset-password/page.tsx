'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Key, Loader2, Shield } from 'lucide-react';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }
      setMessage('Password updated. Redirecting to sign in...');
      setTimeout(() => router.push('/login?reset=true'), 1000);
    } catch {
      setError('Unexpected error while resetting password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1C1E] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-[#E5E5E0] rounded-[2.5rem] p-10 shadow-2xl shadow-black/[0.02]">
        <div className="inline-flex items-center justify-center h-14 w-14 bg-[#1C1C1E] rounded-2xl shadow-xl mb-6">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Reset Password</h1>
        <p className="text-[#6B6B6B] font-medium mb-8">Enter the OTP sent to {email || 'your email'} and choose a new password.</p>

        <button
          type="button"
          onClick={() => router.push('/forgot-password')}
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[#6B6B6B] hover:text-[#1C1C1E]"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] ml-1">OTP Code</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              maxLength={6}
              className="w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl py-4 px-4 outline-none focus:border-[#1C1C1E] transition-all font-bold tracking-[0.3em]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] ml-1">New Password</label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[#1C1C1E] transition-all font-bold placeholder:text-[#9CA3AF]/50"
              />
            </div>
          </div>

          {error && <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-2xl p-3">{error}</p>}
          {message && <p className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">{message}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#1C1C1E] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#27272a] transition-all disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <>Update Password <ArrowRight size={18} className="text-white/50" /></>}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#9CA3AF] font-medium">
          Need a new code?{' '}
          <Link href="/forgot-password" className="text-[#1C1C1E] font-bold hover:underline">
            Send OTP again
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center"><Loader2 className="animate-spin text-[#1C1C1E]" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
