'use client';

import { useMemo, useState } from 'react';
import {
  Table as AntdTable,
  Card,
  Statistic,
  Progress,
  Tag,
  Button,
  Input,
  Alert,
  Space,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  SyncOutlined,
  LineChartOutlined,
  ThunderboltOutlined,
  FilePdfOutlined,
  GithubOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { AnalyticsSummary, DailyActivityRow, UserAnalyticsRow } from '@/lib/analytics/queries';

export type ProductAnalyticsPayload = {
  generated_at: string;
  summary: AnalyticsSummary;
  users: UserAnalyticsRow[];
  daily: DailyActivityRow[];
  notes?: Record<string, string>;
};

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function formatShortDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminProductAnalyticsPanel({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: ProductAnalyticsPayload | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState('');
  const summary = data?.summary;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.users || []).filter((u) => {
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        String(u.id).includes(q)
      );
    });
  }, [data?.users, query]);

  const columns: ColumnsType<UserAnalyticsRow> = [
    {
      title: 'User',
      key: 'user',
      render: (_, u) => (
        <div>
          <div className="font-bold text-zinc-900 text-xs">{u.name || 'Unnamed'}</div>
          <div className="text-[11px] text-zinc-400 font-mono">{u.email}</div>
        </div>
      ),
    },
    {
      title: 'Jobs Added',
      dataIndex: 'jobs_count',
      key: 'jobs_count',
      render: (v: number) => <span className="font-semibold text-xs text-zinc-800">{v}</span>,
    },
    {
      title: 'Tailored Jobs',
      dataIndex: 'tailored_jobs',
      key: 'tailored_jobs',
      render: (v: number) => (
        <Tag color={v > 0 ? 'success' : 'default'} className="font-semibold text-xs">
          {v}
        </Tag>
      ),
    },
    {
      title: 'Applications',
      dataIndex: 'applications_count',
      key: 'applications_count',
      render: (v: number) => <span className="font-semibold text-xs text-zinc-800">{v}</span>,
    },
    {
      title: 'Tailor Funnel',
      key: 'funnel',
      render: (_, u) => {
        const rate = u.jobs_count > 0 ? Math.round((u.tailored_jobs / u.jobs_count) * 100) : 0;
        return (
          <div className="w-24">
            <Progress percent={rate} size="small" strokeColor="#10B981" />
          </div>
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
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Product Analytics & Funnel</h1>
            <Tag color="purple" className="font-bold text-[10px] uppercase">
              Metrics
            </Tag>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Accurate product funnel: jobs sourced → tailored resumes → GitHub runs → applications submitted.
          </p>
        </div>

        <Button icon={<SyncOutlined spin={loading} />} onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">ACTIVE (7D)</span>}
              value={summary.active_users_7d}
              valueStyle={{ fontSize: 20, fontWeight: 800, color: '#3B82F6' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">TOTAL JOBS</span>}
              value={summary.total_jobs}
              valueStyle={{ fontSize: 20, fontWeight: 800 }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">TAILORED JOBS</span>}
              value={summary.tailored_jobs}
              valueStyle={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">PDF ON R2</span>}
              value={summary.resume_pdf_r2}
              valueStyle={{ fontSize: 20, fontWeight: 800 }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">GH RUNS</span>}
              value={summary.tailor_runs}
              valueStyle={{ fontSize: 20, fontWeight: 800 }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">TOTAL APPS</span>}
              value={summary.total_applications}
              valueStyle={{ fontSize: 20, fontWeight: 800 }}
            />
          </Card>
        </div>
      )}

      {/* User Funnel Table */}
      <Card
        size="small"
        className="border-zinc-200 shadow-xs"
        title={
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-zinc-900">Candidate Pipeline Engagement</span>
            <div className="w-64">
              <Input
                size="small"
                placeholder="Search candidates…"
                prefix={<SearchOutlined className="text-zinc-400" />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                allowClear
              />
            </div>
          </div>
        }
        styles={{ body: { padding: 0 } }}
      >
        <AntdTable
          dataSource={filtered}
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
