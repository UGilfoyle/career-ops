'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Input, Button, Alert } from 'antd';
import {
  MailOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send reset code');
        return;
      }
      setMessage('Reset code sent. Redirecting to verification...');
      setTimeout(() => {
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      }, 900);
    } catch {
      setError('Unexpected error while sending reset code');
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
            onClick={() => router.push('/login')}
            className="text-xs font-bold text-zinc-500"
          >
            Back to login
          </Button>
        </div>

        <Card className="border-zinc-200 shadow-xl p-4">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center h-12 w-12 bg-zinc-900 text-white rounded-xl shadow-sm mb-3">
              <SafetyCertificateOutlined className="text-xl" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Forgot Password</h1>
            <p className="text-xs font-medium text-zinc-500 mt-1">
              Enter your email to receive an OTP code to securely reset your password.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
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
              Send Reset Code (OTP)
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Remembered password?{' '}
            <Link href="/login" className="font-bold text-zinc-900 hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
