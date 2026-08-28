'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Table as AntdTable,
  Card,
  Tag,
  Button,
  Segmented,
  Alert,
  Space,
  Popconfirm,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SyncOutlined,
  CheckOutlined,
  CloseOutlined,
  DollarOutlined,
} from '@ant-design/icons';

type UpiClaim = {
  id: number;
  userId: string;
  userEmail: string;
  amountInr: number;
  upiVpa: string;
  transactionRef: string | null;
  utr: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminPaymentsPanel() {
  const [claims, setClaims] = useState<UpiClaim[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/billing/upi/claims?status=${filter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load payments');
      setClaims(data.claims || []);
      setPendingCount(data.pendingCount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(claimId: number, action: 'approve' | 'reject') {
    setBusyId(claimId);
    setError('');
    try {
      const res = await fetch('/api/billing/upi/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  const columns: ColumnsType<UpiClaim> = [
    {
      title: 'Candidate',
      key: 'user',
      render: (_, c) => (
        <div>
          <div className="font-bold text-zinc-900 text-xs">{c.userEmail}</div>
          <div className="text-[10px] text-zinc-400 font-mono">User ID: {c.userId}</div>
        </div>
      ),
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (_, c) => (
        <span className="font-extrabold text-zinc-900 text-sm">
          ₹{c.amountInr}
        </span>
      ),
    },
    {
      title: 'UTR Reference',
      key: 'utr',
      render: (_, c) => (
        <Tag color="default" className="font-mono font-bold text-xs">
          {c.utr}
        </Tag>
      ),
    },
    {
      title: 'VPA',
      dataIndex: 'upiVpa',
      key: 'upiVpa',
      render: (vpa: string) => <span className="font-mono text-xs text-zinc-600">{vpa}</span>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, c) => {
        const s = c.status.toLowerCase();
        return (
          <Tag color={s === 'approved' ? 'success' : s === 'rejected' ? 'error' : 'warning'}>
            {c.status.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Submitted',
      key: 'createdAt',
      render: (_, c) => <span className="text-xs text-zinc-500">{formatWhen(c.createdAt)}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, c) => {
        if (c.status.toLowerCase() !== 'pending') {
          return (
            <span className="text-xs text-zinc-400">
              Reviewed {formatWhen(c.reviewedAt)}
            </span>
          );
        }

        const isBusy = busyId === c.id;

        return (
          <Space size="small">
            <Popconfirm
              title="Approve UPI Payment"
              description={`Confirm receipt of ₹${c.amountInr} for ${c.userEmail}?`}
              onConfirm={() => review(c.id, 'approve')}
              okText="Approve"
              cancelText="Cancel"
            >
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                loading={isBusy}
              >
                Approve
              </Button>
            </Popconfirm>

            <Popconfirm
              title="Reject UPI Payment"
              description={`Reject transaction UTR ${c.utr}?`}
              onConfirm={() => review(c.id, 'reject')}
              okText="Reject"
              okType="danger"
              cancelText="Cancel"
            >
              <Button size="small" danger icon={<CloseOutlined />} loading={isBusy}>
                Reject
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">UPI Payment Verification</h1>
            {pendingCount > 0 && (
              <Badge count={pendingCount} overflowCount={99}>
                <Tag color="warning" className="font-bold text-[10px] uppercase">
                  Pending Verification
                </Tag>
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manual UPI payment queue. Verify bank SMS or statement and approve to activate Pro accounts.
          </p>
        </div>

        <Button icon={<SyncOutlined spin={loading} />} onClick={() => void load()}>
          Refresh Queue
        </Button>
      </div>

      {error && <Alert type="error" message={error} showIcon closable onClose={() => setError('')} />}

      {/* Filter Tabs */}
      <Segmented
        options={[
          { label: `Pending (${pendingCount})`, value: 'pending' },
          { label: 'All Payments', value: 'all' },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
        ]}
        value={filter}
        onChange={(val) => setFilter(val as any)}
      />

      {/* Table */}
      <Card size="small" className="border-zinc-200 shadow-xs" styles={{ body: { padding: 0 } }}>
        <AntdTable
          dataSource={claims}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 15, size: 'small' }}
        />
      </Card>
    </div>
  );
}
