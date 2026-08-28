'use client';

import { useMemo, useState } from 'react';
import {
  Table as AntdTable,
  Card,
  Statistic,
  Tag,
  Segmented,
  Input,
  Button,
  Alert,
  Space,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  SyncOutlined,
  GithubOutlined,
  MailOutlined,
  UserOutlined,
  CheckCircleOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';

type AdminUser = {
  id: number;
  name: string;
  email: string;
  created_at: string | null;
  email_verified: boolean;
  auth_method: 'email' | 'github' | 'both' | 'unknown';
  oauth_providers: string[];
  newsletter_opt_in: boolean;
  referred_by: string | null;
  referral_code: string | null;
  jobs_count: number;
  applications_count: number;
};

type AdminOverview = {
  summary: {
    total_users: number;
    email_only: number;
    github_only: number;
    both_methods: number;
    verified: number;
    unverified: number;
    newsletter_on: number;
    referred: number;
    new_today: number;
    new_week: number;
  };
  users: AdminUser[];
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminUsersPanel({
  data,
  loading,
  error,
  onRefresh,
}: {
  data: AdminOverview | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState('');
  const [authFilter, setAuthFilter] = useState<'all' | 'email' | 'github' | 'both'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.users || []).filter((user) => {
      if (authFilter !== 'all' && user.auth_method !== authFilter) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        String(user.id).includes(q)
      );
    });
  }, [data?.users, query, authFilter]);

  const summary = data?.summary;

  const columns: ColumnsType<AdminUser> = [
    {
      title: 'ID & User',
      key: 'user',
      render: (_, u) => (
        <div>
          <div className="font-bold text-zinc-900 text-xs flex items-center gap-1.5">
            <span className="font-mono text-zinc-400">#{u.id}</span> {u.name || 'Unnamed User'}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono">{u.email}</div>
        </div>
      ),
    },
    {
      title: 'Auth Method',
      key: 'auth_method',
      render: (_, u) => {
        if (u.auth_method === 'github') {
          return (
            <Tag icon={<GithubOutlined />} color="default">
              GitHub
            </Tag>
          );
        }
        if (u.auth_method === 'email') {
          return (
            <Tag icon={<MailOutlined />} color="blue">
              Email
            </Tag>
          );
        }
        if (u.auth_method === 'both') {
          return (
            <Tag color="purple">
              GitHub + Email
            </Tag>
          );
        }
        return <Tag color="default">Unknown</Tag>;
      },
    },
    {
      title: 'Verification',
      key: 'verification',
      render: (_, u) => (
        <Tag color={u.email_verified ? 'success' : 'warning'}>
          {u.email_verified ? 'Verified' : 'Pending'}
        </Tag>
      ),
    },
    {
      title: 'Activity',
      key: 'activity',
      render: (_, u) => (
        <div className="text-xs space-y-0.5">
          <div>
            Jobs: <span className="font-semibold text-zinc-800">{u.jobs_count}</span>
          </div>
          <div>
            Apps: <span className="font-semibold text-zinc-800">{u.applications_count}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Newsletter',
      key: 'newsletter',
      render: (_, u) => (
        <Tag color={u.newsletter_opt_in ? 'cyan' : 'default'}>
          {u.newsletter_opt_in ? 'Subscribed' : 'Off'}
        </Tag>
      ),
    },
    {
      title: 'Joined Date',
      key: 'created_at',
      render: (_, u) => <span className="text-xs text-zinc-500">{formatDate(u.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">User Management</h1>
            <Tag color="purple" className="font-bold text-[10px] uppercase">
              Admin
            </Tag>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Registered candidate accounts, authentication providers, and engagement activity.
          </p>
        </div>

        <Button icon={<SyncOutlined spin={loading} />} onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">TOTAL USERS</span>}
              value={summary.total_users}
              valueStyle={{ fontSize: 20, fontWeight: 800 }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">NEW TODAY</span>}
              value={summary.new_today}
              valueStyle={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">NEW THIS WEEK</span>}
              value={summary.new_week}
              valueStyle={{ fontSize: 20, fontWeight: 800, color: '#3B82F6' }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">VERIFIED</span>}
              value={summary.verified}
              valueStyle={{ fontSize: 20, fontWeight: 800 }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">GITHUB AUTH</span>}
              value={summary.github_only + summary.both_methods}
              valueStyle={{ fontSize: 20, fontWeight: 800 }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title={<span className="text-[11px] font-medium text-zinc-500">NEWSLETTER</span>}
              value={summary.newsletter_on}
              valueStyle={{ fontSize: 20, fontWeight: 800 }}
            />
          </Card>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Segmented
          options={[
            { label: 'All Users', value: 'all' },
            { label: 'Email Only', value: 'email' },
            { label: 'GitHub Only', value: 'github' },
            { label: 'Both', value: 'both' },
          ]}
          value={authFilter}
          onChange={(val) => setAuthFilter(val as any)}
        />
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Search by name, email, or ID..."
            prefix={<SearchOutlined className="text-zinc-400" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
          />
        </div>
      </div>

      {/* Ant Design Table */}
      <Card size="small" className="border-zinc-200 shadow-xs" styles={{ body: { padding: 0 } }}>
        <AntdTable
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, size: 'small' }}
        />
      </Card>
    </div>
  );
}
