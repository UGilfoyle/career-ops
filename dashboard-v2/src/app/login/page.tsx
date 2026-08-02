'use client';

import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, Key, Mail, ArrowRight, Github, Loader2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TurnstileWidget } from '@/components/TurnstileWidget';

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
        if (result.error.includes("verify your email")) {
           router.push(`/verify?email=${encodeURIComponent(email)}`);
           return;
        }
        setError(result.error === 'CredentialsSignin' ? 'Invalid credentials or access denied.' : result.error);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1C1C1E] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Glows: Subtle warm tones */}
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
          <h1 className="text-4xl font-bold tracking-tight mb-2">Welcome Back</h1>
          <p className="text-[#9CA3AF] font-medium">Access your AI career command center</p>
        </div>

        {isVerified && !autoGithub && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 text-sm font-bold">
            <CheckCircle2 size={18} />
            Account activated. You can sign in now.
          </div>
        )}

        {isReset && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 text-sm font-bold">
            <CheckCircle2 size={18} />
            Password updated. Sign in with your new password.
          </div>
        )}

        {autoGithub && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700 text-sm font-bold">
            <Loader2 size={18} className="animate-spin" />
            Email verified. Redirecting to GitHub sign-in...
          </div>
        )}

        <div className="bg-white border border-[#E5E5E0] rounded-[2.5rem] p-10 shadow-2xl shadow-black/[0.02]">
          {oauthErrorMessage && (
            <div className="mb-6 flex items-center gap-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold">
              <AlertCircle size={14} />
              {oauthErrorMessage}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#1C1C1E] transition-colors" size={18} />
                <input
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  className="w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[#1C1C1E] transition-all font-bold placeholder:text-[#9CA3AF]/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] ml-1">Password</label>
              <div className="relative group">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] group-focus-within:text-[#1C1C1E] transition-colors" size={18} />
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-[#1C1C1E] transition-all font-bold placeholder:text-[#9CA3AF]/50"
                />
              </div>
              <div className="text-right pt-1">
                <Link href="/forgot-password" className="text-xs font-bold text-[#6B6B6B] hover:text-[#1C1C1E]">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold"
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
              className="w-full bg-[#1C1C1E] text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#27272a] transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  Sign In
                  <ArrowRight size={20} className="text-white/40" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4 text-[#E5E5E0]">
             <div className="h-px w-full bg-[#E5E5E0]" />
             <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-[0.2em] whitespace-nowrap">Third Party</span>
             <div className="h-px w-full bg-[#E5E5E0]" />
          </div>

          <button 
            type="button"
            onClick={() => signIn('github', { callbackUrl: githubCallbackUrl })}
            className="w-full mt-6 bg-white border border-[#E5E5E0] text-[#1C1C1E] font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#FAFAF8] transition-all"
          >
            <Github size={20} />
            Continue with GitHub
          </button>
        </div>

        <p className="mt-10 text-center text-[#9CA3AF] text-sm font-medium">
          New to Career-Ops?{' '}
          <Link href="/signup" className="text-[#1C1C1E] font-bold hover:underline underline-offset-4 decoration-[#E5E5E0]">
            Create Account
          </Link>
        </p>

        <div className="mt-12 flex items-center justify-center gap-3 text-[#E5E5E0]">
           <Shield size={16} />
           <span className="text-[9px] font-bold uppercase tracking-[0.25em]">Secure Auth v2.0-modern</span>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center"><Loader2 className="animate-spin text-[#1C1C1E]" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
