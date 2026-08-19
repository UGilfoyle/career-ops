'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Mail, Key, ArrowRight, Github, Loader2, AlertCircle, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import AuthShell from '@/components/auth/AuthShell';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [referralCode, setReferralCode] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const onTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  useEffect(() => {
    const ref = (searchParams.get('ref') || '').trim().toUpperCase();
    if (ref) {
      setReferralCode(ref);
      try {
        sessionStorage.setItem('career_ops_referral', ref);
      } catch {
        /* ignore */
      }
    } else {
      try {
        const stored = sessionStorage.getItem('career_ops_referral') || '';
        if (stored) setReferralCode(stored.toUpperCase());
      } catch {
        /* ignore */
      }
    }
  }, [searchParams]);

  const validateForm = () => {
    if (formData.name.length < 2) return 'Name must be at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Invalid email address format.';
    if (formData.password.length < 8) return 'Password must be at least 8 characters.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Please complete the security check.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          ...(referralCode ? { referral_code: referralCode } : {}),
          ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
        }),
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Server returned non-JSON:', text.substring(0, 500));
        throw new Error(`Sign-up failed (HTTP ${res.status}). Check your connection and try again.`);
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      sessionStorage.setItem(
        'career_ops_pending_signup',
        JSON.stringify({ email: formData.email, password: formData.password, ts: Date.now() })
      );

      setIsSuccess(true);
      setTimeout(() => {
        router.push(`/verify?email=${encodeURIComponent(formData.email)}&provider=credentials`);
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="mb-8 lg:mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-[#1C1C1E] sm:text-4xl">Create account</h1>
          <p className="mt-2 text-sm font-medium text-[#6B6B6B]">Free to start — verify your email after signup</p>
          {referralCode ? (
            <p className="mt-3 inline-block rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              Invited via {referralCode}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-8 shadow-xl shadow-black/[0.03] sm:p-10">
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 text-center"
              >
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                  <Shield className="h-10 w-10 text-emerald-500" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">Account created</h2>
                <p className="font-medium text-[#9CA3AF]">Redirecting to email verification…</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF]">
                    Full name
                  </label>
                  <div className="group relative">
                    <User
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition-colors group-focus-within:text-[#1C1C1E]"
                      size={18}
                    />
                    <input
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      required
                      className="w-full rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8]/50 py-4 pl-12 pr-4 font-bold outline-none transition-all placeholder:text-[#9CA3AF]/50 focus:border-[#1C1C1E]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF]">
                    Email address
                  </label>
                  <div className="group relative">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition-colors group-focus-within:text-[#1C1C1E]"
                      size={18}
                    />
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@company.com"
                      required
                      className="w-full rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8]/50 py-4 pl-12 pr-4 font-bold outline-none transition-all placeholder:text-[#9CA3AF]/50 focus:border-[#1C1C1E]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF]">
                    Password
                  </label>
                  <div className="group relative">
                    <Key
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition-colors group-focus-within:text-[#1C1C1E]"
                      size={18}
                    />
                    <input
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8]/50 py-4 pl-12 pr-4 font-bold outline-none transition-all placeholder:text-[#9CA3AF]/50 focus:border-[#1C1C1E]"
                    />
                  </div>
                  <p className="mt-2 pl-1 text-[9px] font-bold tracking-widest text-[#9CA3AF]">
                    Minimum 8 characters
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-4 rounded-2xl border border-rose-100 bg-rose-50 p-5 text-xs font-bold leading-relaxed text-rose-600">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {TURNSTILE_SITE_KEY ? (
                  <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={onTurnstileToken} />
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1C1C1E] py-4 font-bold text-white shadow-lg transition-all hover:bg-[#27272a] active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      Create account
                      <ArrowRight size={20} className="text-white/40" />
                    </>
                  )}
                </button>

                <div className="flex items-center gap-4 text-[#E5E5E0]">
                  <div className="h-px w-full bg-[#E5E5E0]" />
                  <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF]">
                    Or
                  </span>
                  <div className="h-px w-full bg-[#E5E5E0]" />
                </div>

                <button
                  type="button"
                  onClick={() => signIn('github', { callbackUrl: '/?walkthrough=1' })}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#E5E5E0] bg-white py-4 font-bold text-[#1C1C1E] transition-all hover:bg-[#FAFAF8]"
                >
                  <Github size={20} />
                  Continue with GitHub
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-8 text-center text-sm font-medium text-[#9CA3AF]">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-bold text-[#1C1C1E] decoration-[#E5E5E0] underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 text-[#D4D4CE]">
          <Shield size={14} />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em]">Encrypted sign-up</span>
        </div>
      </motion.div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
          <Loader2 className="animate-spin text-[#1C1C1E]" size={28} />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
