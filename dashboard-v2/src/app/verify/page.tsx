'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, Input, Button, Alert, Space } from 'antd';
import {
  CheckCircleOutlined,
  ArrowRightOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import Link from 'next/link';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const provider = searchParams.get('provider') || '';

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!email) {
      router.push('/signup');
    }
  }, [email, router]);

  const handleSubmit = useCallback(
    async (codeToSubmit?: string) => {
      const finalToken = codeToSubmit || otp;
      if (finalToken.length < 6) return;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token: finalToken }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Verification failed');

        setIsSuccess(true);
        setTimeout(() => {
          if (provider === 'github') {
            router.push('/auth/continue?provider=github&callbackUrl=%2F%3Fwalkthrough%3D1');
            return;
          }
          router.push(
            `/auth/continue?provider=credentials&email=${encodeURIComponent(
              email
            )}&callbackUrl=%2F%3Fwalkthrough%3D1`
          );
        }, 1800);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Verification failed');
      } finally {
        setIsLoading(false);
      }
    },
    [email, provider, router, otp]
  );

  const handleResend = async () => {
    if (!email || resendCooldown > 0 || isLoading) return;

    setError(null);
    try {
      const res = await fetch('/api/verify/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to resend verification code');
      setResendCooldown(30);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification code');
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const onOtpChange = (text: string) => {
    setOtp(text);
    if (text.length === 6) {
      void handleSubmit(text);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-zinc-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-12 w-12 bg-zinc-900 text-white rounded-xl shadow-sm mb-3">
            <ThunderboltOutlined className="text-xl" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Check your email</h1>
          <p className="text-xs font-medium text-zinc-500 mt-1">
            We sent a 6-digit code to <strong className="text-zinc-800">{email}</strong>
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Code expires in 10 minutes.</p>
        </div>

        <Card className="border-zinc-200 shadow-xl p-4">
          {isSuccess ? (
            <div className="text-center py-6">
              <CheckCircleOutlined className="text-4xl text-emerald-500 mb-3" />
              <h2 className="text-lg font-bold text-zinc-900">Email Verified</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Account activated. Redirecting to your dashboard...
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex justify-center py-2">
                <Input.OTP
                  length={6}
                  size="large"
                  value={otp}
                  onChange={onOtpChange}
                  autoFocus
                />
              </div>

              {error && <Alert type="error" message={error} showIcon />}

              <Button
                type="primary"
                size="large"
                block
                disabled={otp.length < 6}
                loading={isLoading}
                icon={<ArrowRightOutlined />}
                onClick={() => void handleSubmit()}
              >
                Verify Email
              </Button>

              <div className="text-center pt-2">
                <Button
                  type="text"
                  size="small"
                  disabled={resendCooldown > 0}
                  onClick={handleResend}
                  icon={<SyncOutlined spin={resendCooldown > 0} />}
                  className="text-xs text-zinc-500 font-bold uppercase tracking-wider"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Wrong email address?{' '}
          <Link href="/signup" className="font-bold text-zinc-900 hover:underline">
            Back to sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
          <LoadingOutlined style={{ fontSize: 28 }} spin />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
