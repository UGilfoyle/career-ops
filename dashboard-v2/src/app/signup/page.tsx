'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, User, Mail, Key, ArrowRight, Github, Loader2, AlertCircle, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { WhatsNewPanel } from '@/components/WhatsNewPanel';
import { ProductFlowPanel } from '@/components/ProductFlowPanel';

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
    if (formData.name.length < 2) return 'Candidate name must be at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Invalid Email Address format.';
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
        throw new Error(
          `Critical Infrastructure Failure (HTTP ${res.status}). This usually means DATABASE_URL is missing or Neon is unreachable.`
        );
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration sequence interrupted.');
      }

      sessionStorage.setItem(
        'career_ops_pending_signup',
        JSON.stringify({ email: formData.email, password: formData.password, ts: Date.now() })
      );

      setIsSuccess(true);
      setTimeout(() => {
        router.push(`/verify?email=${encodeURIComponent(formData.email)}&provider=credentials`);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1C1E] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#f59e0b]/5 rounded-full blur-[150px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center h-14 w-14 bg-[#1C1C1E] rounded-2xl shadow-xl mb-6">
            <Briefcase className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Initialize Account</h1>
          <p className="text-[#9CA3AF] font-medium text-sm">Create your secure career command center</p>
          {referralCode ? (
            <p className="mt-3 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full inline-block px-3 py-1">
              Invited via {referralCode}
            </p>
          ) : null}
        </div>

        <WhatsNewPanel variant="signup" showCta={false} />
        <ProductFlowPanel variant="signup" showSignupCta={false} />

        <div className="bg-white border border-[#E5E5E0] rounded-[2.5rem] p-10 shadow-2xl shadow-black/[0.02] relative overflow-hidden">
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-10"
              >
                <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-10 w-10 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Identity Created</h2>
                <p className="text-[#9CA3AF] mb-4 font-medium italic">Handshaking with verification engine...</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] ml-1">
                    Candidate Name
                  </label>
                  <div className="relative group">
                    <User
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#1C1C1E] transition-colors"
                      size={18}
                    />
                    <input
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      required
                      className="w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[#1C1C1E] transition-all font-bold placeholder:text-[#9CA3AF]/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] ml-1">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#1C1C1E] transition-colors"
                      size={18}
                    />
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@company.com"
                      required
                      className="w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[#1C1C1E] transition-all font-bold placeholder:text-[#9CA3AF]/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] ml-1">
                    Password
                  </label>
                  <div className="relative group">
                    <Key
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#1C1C1E] transition-colors"
                      size={18}
                    />
                    <input
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      required
                      className="w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[#1C1C1E] transition-all font-bold placeholder:text-[#9CA3AF]/50"
                    />
                  </div>
                  <p className="text-[9px] text-[#9CA3AF] font-bold tracking-widest pl-1 mt-2">
                    MINIMUM 8 CHARACTERS REQUIRED
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-4 p-5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold leading-relaxed">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {TURNSTILE_SITE_KEY ? (
                  <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={onTurnstileToken} />
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#1C1C1E] text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#27272a] transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      Create Account
                      <ArrowRight size={20} className="text-white/40" />
                    </>
                  )}
                </button>

                <div className="mt-8 flex items-center gap-4 text-[#E5E5E0]">
                  <div className="h-px w-full bg-[#E5E5E0]" />
                  <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] whitespace-nowrap">
                    Third Party
                  </span>
                  <div className="h-px w-full bg-[#E5E5E0]" />
                </div>

                <button
                  type="button"
                  onClick={() => signIn('github', { callbackUrl: '/?walkthrough=1' })}
                  className="w-full mt-6 bg-white border border-[#E5E5E0] text-[#1C1C1E] font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#FAFAF8] transition-all"
                >
                  <Github size={20} />
                  Continue with GitHub
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-10 text-center text-[#9CA3AF] text-sm font-medium">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-[#1C1C1E] font-bold hover:underline underline-offset-4 decoration-[#E5E5E0]"
          >
            Sign In
          </Link>
        </p>

        <div className="mt-12 flex items-center justify-center gap-3 text-[#E5E5E0]">
          <Shield size={16} />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em]">SaaS Identity v2.0-modern</span>
        </div>
      </motion.div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
          <Loader2 className="animate-spin text-[#1C1C1E]" size={28} />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
