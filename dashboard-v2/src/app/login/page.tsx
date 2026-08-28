'use client';

import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Button, Card, Divider, Alert, Space } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  GithubOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

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
        setError(
          result.error === 'CredentialsSignin' ? 'Invalid credentials or access denied.' : result.error
        );
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
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Sign in</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Welcome back — access your Career-Ops dashboard & pipeline
          </p>
        </div>

        {isVerified && !autoGithub && (
          <Alert
            type="success"
            message="Account activated. You can sign in now."
            showIcon
            className="mb-4"
          />
        )}

        {isReset && (
          <Alert
            type="success"
            message="Password updated. Sign in with your new password."
            showIcon
            className="mb-4"
          />
        )}

        {autoGithub && (
          <Alert
            type="info"
            message="Email verified. Redirecting to GitHub sign-in..."
            showIcon
            className="mb-4"
          />
        )}

        <Card className="border-zinc-200 shadow-md p-2">
          {oauthErrorMessage && (
            <Alert type="error" message={oauthErrorMessage} showIcon className="mb-4" />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Email Address
              </label>
              <Input
                size="large"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                prefix={<MailOutlined className="text-zinc-400 mr-1" />}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-900"
                >
                  Forgot password?
                </Link>
              </div>
              <Input.Password
                size="large"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                prefix={<LockOutlined className="text-zinc-400 mr-1" />}
              />
            </div>

            {error && <Alert type="error" message={error} showIcon />}

            {TURNSTILE_SITE_KEY && (
              <TurnstileWidget siteKey={TURNSTILE_SITE_KEY} onToken={onTurnstileToken} />
            )}

            <Button
              type="primary"
              size="large"
              block
              htmlType="submit"
              loading={isLoading}
              icon={<ArrowRightOutlined />}
            >
              Sign In
            </Button>
          </form>

          <Divider plain className="my-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Or
          </Divider>

          <Button
            size="large"
            block
            icon={<GithubOutlined />}
            onClick={() => signIn('github', { callbackUrl: githubCallbackUrl })}
          >
            Continue with GitHub
          </Button>
        </Card>

        <p className="mt-6 text-center text-sm text-zinc-500">
          New to Career-Ops?{' '}
          <Link href="/signup" className="font-bold text-zinc-900 hover:underline">
            Create account
          </Link>
        </p>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-zinc-400 text-xs">
          <SafetyCertificateOutlined />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Secure Encrypted Session
          </span>
        </div>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
          <LoadingOutlined style={{ fontSize: 28 }} spin />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
