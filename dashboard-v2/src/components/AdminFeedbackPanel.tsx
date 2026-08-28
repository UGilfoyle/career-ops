'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Table as AntdTable,
  Card,
  Statistic,
  Tag,
  Button,
  Segmented,
  Alert,
  Progress,
  Rate,
  Space,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HeartOutlined,
  SyncOutlined,
  LikeOutlined,
  DislikeOutlined,
  MessageOutlined,
} from '@ant-design/icons';

type FeedbackItem = {
  id: number;
  userEmail: string;
  score: number;
  scoreLabel: string;
  comment: string | null;
  context: string | null;
  updatedAt: string | null;
};

type FeedbackPayload = {
  summary: {
    total: number;
    avgScore: number;
    promoters: number;
    detractors: number;
    satisfiedPct: number;
    distribution: Record<string, number>;
  };
  feedback: FeedbackItem[];
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

export default function AdminFeedbackPanel() {
  const [data, setData] = useState<FeedbackPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'happy' | 'unhappy'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs =
        filter === 'happy' ? '?minScore=4' : filter === 'unhappy' ? '?maxScore=2' : '';
      const res = await fetch(`/api/admin/feedback${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load feedback');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const dist = summary?.distribution || {};

  const columns: ColumnsType<FeedbackItem> = [
    {
      title: 'Candidate',
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (email: string) => <span className="font-bold text-zinc-900 text-xs">{email}</span>,
    },
    {
      title: 'Score',
      key: 'score',
      render: (_, f) => (
        <Space>
          <Rate disabled defaultValue={f.score} count={5} style={{ fontSize: 13 }} />
          <Tag color={f.score >= 4 ? 'success' : f.score <= 2 ? 'error' : 'warning'}>
            {f.score}/5 · {f.scoreLabel}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Comment & Feedback',
      dataIndex: 'comment',
      key: 'comment',
      render: (comment: string | null) => (
        <span className="text-xs text-zinc-700 leading-relaxed">
          {comment || <span className="text-zinc-400 italic">No text comment provided</span>}
        </span>
      ),
    },
    {
      title: 'Context',
      dataIndex: 'context',
      key: 'context',
      render: (ctx: string | null) => (
        <Tag color="default" className="text-[10px]">
          {ctx || 'General'}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (d: string | null) => <span className="text-xs text-zinc-400">{formatWhen(d)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">User Experience & Feedback</h1>
            <Tag color="magenta" className="font-bold text-[10px] uppercase">
              CSAT
            </Tag>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real feedback and satisfaction ratings submitted by candidates.
          </p>
        </div>

        <Button icon={<SyncOutlined spin={loading} />} onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">TOTAL RESPONSES</span>}
              value={summary.total}
              valueStyle={{ fontSize: 22, fontWeight: 800 }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">AVERAGE RATING</span>}
              value={summary.total ? `${summary.avgScore} / 5` : '—'}
              valueStyle={{ fontSize: 22, fontWeight: 800, color: '#10B981' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">PROMOTERS (4-5★)</span>}
              value={summary.promoters}
              valueStyle={{ fontSize: 22, fontWeight: 800, color: '#3B82F6' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">DETRACTORS (1-2★)</span>}
              value={summary.detractors}
              valueStyle={{ fontSize: 22, fontWeight: 800, color: '#EF4444' }}
            />
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      <Segmented
        options={[
          { label: 'All Feedback', value: 'all' },
          { label: 'Promoters (Happy)', value: 'happy' },
          { label: 'Detractors (Unhappy)', value: 'unhappy' },
        ]}
        value={filter}
        onChange={(val) => setFilter(val as any)}
      />

      {/* Feedback Table */}
      <Card size="small" className="border-zinc-200 shadow-xs" styles={{ body: { padding: 0 } }}>
        <AntdTable
          dataSource={data?.feedback || []}
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
