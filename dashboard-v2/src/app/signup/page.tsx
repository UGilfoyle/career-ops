'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input, Button, Card, Divider, Alert, Tag } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  GithubOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  LoadingOutlined,
  GiftOutlined,
} from '@ant-design/icons';
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

      setIsSuccess(true);
      setTimeout(() => {
        router.push(`/verify?email=${encodeURIComponent(formData.email)}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Create Account</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Start scanning jobs, matching ATS keywords, and evaluating offers
          </p>
        </div>

        {referralCode && (
          <Alert
            type="info"
            icon={<GiftOutlined />}
            message={
              <span className="text-xs">
                Referral code <Tag color="blue" className="font-mono font-bold">{referralCode}</Tag> applied
              </span>
            }
            showIcon
            className="mb-4"
          />
        )}

        {isSuccess ? (
          <Alert
            type="success"
            message="Account created! Redirecting to email verification..."
            showIcon
            className="mb-4"
          />
        ) : (
          <Card className="border-zinc-200 shadow-md p-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Full Name
                </label>
                <Input
                  size="large"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Jane Doe"
                  prefix={<UserOutlined className="text-zinc-400 mr-1" />}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Email Address
                </label>
                <Input
                  size="large"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="jane@company.com"
                  prefix={<MailOutlined className="text-zinc-400 mr-1" />}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Password (8+ chars)
                </label>
                <Input.Password
                  size="large"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                Create Account
              </Button>
            </form>

            <Divider plain className="my-5 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              Or
            </Divider>

            <Button
              size="large"
              block
              icon={<GithubOutlined />}
              onClick={() => signIn('github', { callbackUrl: '/' })}
            >
              Sign up with GitHub
            </Button>
          </Card>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-zinc-900 hover:underline">
            Sign in
          </Link>
        </p>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-zinc-400 text-xs">
          <SafetyCertificateOutlined />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Privacy-Preserved & SSL Encrypted
          </span>
        </div>
      </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAF8]">
          <LoadingOutlined style={{ fontSize: 28 }} spin />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
