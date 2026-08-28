'use client';

import { useState } from 'react';
import { Button, Card, Alert, Tag, Space, Typography } from 'antd';
import {
  LockOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  ReadOutlined,
  SyncOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

const { Text, Title, Paragraph } = Typography;

export type PendingPayment = {
  provider?: string;
  status: string;
  utr?: string;
  submittedAt?: string | null;
  awaitingReview?: boolean;
  message?: string;
};

type ProPaywallProps = {
  feature: 'resume-studio' | 'copilot' | 'practice';
  planDisplay: string;
  planSubtitle: string;
  copilotRemaining?: number;
  pendingPayment?: PendingPayment | null;
  onUpgrade?: () => void;
};

export default function ProPaywall({
  feature,
  planDisplay,
  planSubtitle,
  copilotRemaining,
  pendingPayment,
  onUpgrade,
}: ProPaywallProps) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const awaitingReview = pendingPayment?.awaitingReview || pendingPayment?.status === 'pending';

  const title =
    feature === 'resume-studio'
      ? 'Resume Studio is Pro'
      : feature === 'practice'
      ? 'Interview Practice limit reached'
      : 'Copilot limit reached';

  const desc =
    feature === 'resume-studio'
      ? 'Edit your master resume, live ATS preview, PDF export, and JD match (included with Pro).'
      : feature === 'practice'
      ? 'Free plan: 1 JD practice pack every 7 days. Upgrade for unlimited coding, system design, and STAR packs tailored to each role.'
      : `Free plan: 10 Copilot messages every 2 hours${
          copilotRemaining != null ? ` (${copilotRemaining} left)` : ''
        }. Upgrade for unlimited coaching synced to your profile.`;

  const FeatureIcon =
    feature === 'resume-studio'
      ? ThunderboltOutlined
      : feature === 'practice'
      ? ReadOutlined
      : RobotOutlined;

  async function startCheckout() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Checkout failed');
      if (data.hasPro) {
        window.location.reload();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No checkout URL returned');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout');
    } finally {
      setLoading(false);
    }
  }

  async function refreshStatus() {
    setChecking(true);
    setError('');
    try {
      const res = await fetch('/api/billing/status');
      const data = await res.json();
      if (data.hasPro) {
        window.location.reload();
        return;
      }
      setError('Payment is still under review. We email you the moment it clears.');
    } catch {
      setError('Could not check status. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-6 py-12 text-center">
      {/* Icon */}
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mb-4 shadow-sm text-2xl">
        <FeatureIcon />
      </div>

      <Tag icon={<LockOutlined />} color="default" className="font-bold uppercase tracking-wider text-[10px] mb-2">
        PRO FEATURE
      </Tag>

      <h2 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">{title}</h2>
      <p className="text-sm text-zinc-500 max-w-md leading-relaxed mb-6">{desc}</p>

      {/* Pricing Pill Card */}
      <Card className="mb-6 border-zinc-200 shadow-xs px-6 py-1">
        <div className="text-3xl font-extrabold text-zinc-900 tracking-tight">{planDisplay}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{planSubtitle}</div>
      </Card>

      {error && <Alert type="error" message={error} className="mb-4 max-w-sm" showIcon />}

      {awaitingReview ? (
        <div className="max-w-sm w-full space-y-4">
          <Alert
            type="warning"
            showIcon
            icon={<ClockCircleOutlined />}
            message={<span className="font-bold">Payment under verification</span>}
            description={
              <div className="text-xs space-y-1 mt-1">
                <div>{pendingPayment?.message || 'We received your payment. Pro activates once confirmed.'}</div>
                {pendingPayment?.utr && (
                  <div className="font-mono text-zinc-600">UTR: {pendingPayment.utr}</div>
                )}
              </div>
            }
          />
          <Button
            icon={<SyncOutlined spin={checking} />}
            loading={checking}
            onClick={() => void refreshStatus()}
            block
            size="large"
          >
            Check verification status
          </Button>
          <p className="text-[11px] text-zinc-400">
            No need to pay again: one payment per account is tracked until it is approved.
          </p>
        </div>
      ) : (
        <div className="max-w-sm w-full space-y-3">
          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            icon={<ThunderboltOutlined />}
            onClick={() => {
              onUpgrade?.();
              void startCheckout();
            }}
          >
            Upgrade to Pro (Pay via UPI)
          </Button>
          <p className="text-[11px] text-zinc-400">
            Pay {planDisplay} → submit payment details → we verify → Pro access email lands in your inbox.
          </p>
        </div>
      )}
    </div>
  );
}
