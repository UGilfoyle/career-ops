'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, Input, Button, Alert } from 'antd';
import {
  LockOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  SafetyCertificateOutlined,
  LoadingOutlined,
} from '@ant-design/icons';

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
    <div className="min-h-screen bg-[#FAFAF8] text-zinc-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-4">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/forgot-password')}
            className="text-xs font-bold text-zinc-500"
          >
            Back
          </Button>
        </div>

        <Card className="border-zinc-200 shadow-xl p-4">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center h-12 w-12 bg-zinc-900 text-white rounded-xl shadow-sm mb-3">
              <SafetyCertificateOutlined className="text-xl" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Reset Password</h1>
            <p className="text-xs font-medium text-zinc-500 mt-1">
              Enter the OTP code sent to{' '}
              <strong className="text-zinc-800">{email || 'your email'}</strong> and your new password.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                6-Digit OTP Code
              </label>
              <Input
                size="large"
                required
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456"
                className="font-mono tracking-widest text-center text-lg"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                New Password (8+ chars)
              </label>
              <Input.Password
                size="large"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                prefix={<LockOutlined className="text-zinc-400 mr-1" />}
              />
            </div>

            {error && <Alert type="error" message={error} showIcon />}
            {message && <Alert type="success" message={message} showIcon />}

            <Button
              type="primary"
              size="large"
              block
              htmlType="submit"
              loading={isLoading}
              icon={<ArrowRightOutlined />}
            >
              Update Password
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Need a new code?{' '}
            <Link href="/forgot-password" className="font-bold text-zinc-900 hover:underline">
              Send OTP again
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
          <LoadingOutlined style={{ fontSize: 28 }} spin />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
