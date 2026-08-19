'use client';

import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Key, Mail, ArrowRight, Github, Loader2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import AuthShell from '@/components/auth/AuthShell';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const isVerified = searchParams.get('verified') === 'true';
  const isReset = searchParams.get('reset') === 'true';
  const authError = searchParams.get('error');
  const autoGithub = searchParams.get('autogithub') === '1';
  const githubCallbackUrl = '/';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const autoGithubStarted = useRef(false);

  const onTurnstileToken = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const oauthErrorMessage =
    authError === 'github-email-missing'
      ? 'GitHub did not provide an email. Use a GitHub account with a verified public email.'
      : authError === 'github-auth-failed'
        ? 'GitHub sign-in failed. Please try again.'
        : null;

  useEffect(() => {
    if (!autoGithub || autoGithubStarted.current) return;
    autoGithubStarted.current = true;
    signIn('github', { callbackUrl: githubCallbackUrl });
  }, [autoGithub]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Please complete the security check.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn('credentials', {
        email,
        password,
        turnstileToken: turnstileToken || '',
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        if (result.error.includes('verify your email')) {
          router.push(`/verify?email=${encodeURIComponent(email)}`);
          return;
        }
        setError(result.error === 'CredentialsSignin' ? 'Invalid credentials or access denied.' : result.error);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="mb-8 lg:mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-[#1C1C1E] sm:text-4xl">Sign in</h1>
          <p className="mt-2 text-sm font-medium text-[#6B6B6B]">Welcome back — enter your account details</p>
        </div>

        {isVerified && !autoGithub && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={18} />
            Account activated. You can sign in now.
          </div>
        )}

        {isReset && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={18} />
            Password updated. Sign in with your new password.
          </div>
        )}

        {autoGithub && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            <Loader2 size={18} className="animate-spin" />
            Email verified. Redirecting to GitHub sign-in...
          </div>
        )}

        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-8 shadow-xl shadow-black/[0.03] sm:p-10">
          {oauthErrorMessage && (
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600">
              <AlertCircle size={14} />
              {oauthErrorMessage}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  placeholder="••••••••"
                  required
                  className="w-full rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8]/50 py-4 pl-12 pr-4 font-bold outline-none transition-all placeholder:text-[#9CA3AF]/50 focus:border-[#1C1C1E]"
                />
              </div>
              <div className="pt-1 text-right">
                <Link href="/forgot-password" className="text-xs font-bold text-[#6B6B6B] hover:text-[#1C1C1E]">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-4 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-600"
              >
                <AlertCircle size={14} />
                {error}
              </motion.div>
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
                  Sign in
                  <ArrowRight size={20} className="text-white/40" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4 text-[#E5E5E0]">
            <div className="h-px w-full bg-[#E5E5E0]" />
            <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF]">
              Or
            </span>
            <div className="h-px w-full bg-[#E5E5E0]" />
          </div>

          <button
            type="button"
            onClick={() => signIn('github', { callbackUrl: githubCallbackUrl })}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border border-[#E5E5E0] bg-white py-4 font-bold text-[#1C1C1E] transition-all hover:bg-[#FAFAF8]"
          >
            <Github size={20} />
            Continue with GitHub
          </button>
        </div>

        <p className="mt-8 text-center text-sm font-medium text-[#9CA3AF]">
          New to Career-Ops?{' '}
          <Link
            href="/signup"
            className="font-bold text-[#1C1C1E] decoration-[#E5E5E0] underline-offset-4 hover:underline"
          >
            Create account
          </Link>
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 text-[#D4D4CE]">
          <Shield size={14} />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em]">Encrypted sign-in</span>
        </div>
      </motion.div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
          <Loader2 className="animate-spin text-[#1C1C1E]" size={28} />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
