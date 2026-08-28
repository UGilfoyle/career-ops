'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Table as AntdTable,
  Card,
  Statistic,
  Tag,
  Button,
  Alert,
  Space,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CrownOutlined,
  SyncOutlined,
  UserOutlined,
  DollarOutlined,
} from '@ant-design/icons';

type SubscriptionRow = {
  userId: string;
  userEmail: string | null;
  userName: string | null;
  status: string;
  plan: string;
  provider: string | null;
  countryCode: string | null;
  currency: string | null;
  amountMinor: number | null;
  currentPeriodEnd: string | null;
  externalRef: string | null;
  updatedAt: string | null;
};

type RecentUpi = {
  id: number;
  userEmail: string;
  amountInr: number;
  utr: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type SubscriptionsPayload = {
  summary: {
    activePro: number;
    pendingUpi: number;
    approvedUpi: number;
    totalInrCollected: number;
    totalInrDisplay: string;
    inrThisMonth: number;
    inrThisMonthDisplay: string;
    approvedThisMonth: number;
  };
  subscriptions: SubscriptionRow[];
  recentUpiApproved: RecentUpi[];
};

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function providerLabel(provider: string | null) {
  if (!provider) return '—';
  if (provider === 'upi_direct') return 'UPI';
  if (provider === 'stripe') return 'Stripe';
  return provider;
}

export default function AdminSubscriptionsPanel() {
  const [data, setData] = useState<SubscriptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/subscriptions');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load subscriptions');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;

  const columns: ColumnsType<SubscriptionRow> = [
    {
      title: 'Candidate',
      key: 'user',
      render: (_, s) => (
        <div>
          <div className="font-bold text-zinc-900 text-xs">{s.userEmail || `User #${s.userId}`}</div>
          <div className="text-[10px] text-zinc-400 font-mono">Plan: {s.plan}</div>
        </div>
      ),
    },
    {
      title: 'Provider',
      key: 'provider',
      render: (_, s) => (
        <Tag color="blue" className="font-semibold">
          {providerLabel(s.provider)}
        </Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, s) => (
        <Tag color="success" className="font-bold uppercase text-[10px]">
          {s.status}
        </Tag>
      ),
    },
    {
      title: 'Reference / UTR',
      key: 'externalRef',
      render: (_, s) => (
        <span className="font-mono text-xs text-zinc-600">{s.externalRef || '—'}</span>
      ),
    },
    {
      title: 'Period End',
      key: 'currentPeriodEnd',
      render: (_, s) => (
        <span className="text-xs text-zinc-500">{formatWhen(s.currentPeriodEnd)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Pro Subscriptions & Revenue</h1>
            <Tag color="gold" className="font-bold text-[10px] uppercase">
              Billing
            </Tag>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Active Pro subscriber accounts, revenue metrics, and recent approvals.
          </p>
        </div>

        <Button icon={<SyncOutlined spin={loading} />} onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">ACTIVE PRO USERS</span>}
              value={summary.activePro}
              valueStyle={{ fontSize: 22, fontWeight: 800, color: '#10B981' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">PENDING UPI</span>}
              value={summary.pendingUpi}
              valueStyle={{ fontSize: 22, fontWeight: 800, color: '#F59E0B' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">ALL-TIME REVENUE</span>}
              value={summary.totalInrDisplay}
              valueStyle={{ fontSize: 22, fontWeight: 800 }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">THIS MONTH REVENUE</span>}
              value={summary.inrThisMonthDisplay}
              valueStyle={{ fontSize: 22, fontWeight: 800 }}
            />
          </Card>
        </div>
      )}

      {/* Active Subscribers Table */}
      <Card
        size="small"
        className="border-zinc-200 shadow-xs"
        title={<span className="text-xs font-bold text-zinc-900">Active Subscribers</span>}
        styles={{ body: { padding: 0 } }}
      >
        <AntdTable
          dataSource={data?.subscriptions || []}
          columns={columns}
          rowKey="userId"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15, size: 'small' }}
        />
      </Card>
    </div>
  );
}
