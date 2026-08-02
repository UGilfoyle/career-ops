'use client';

import { useMemo, useState } from 'react';
import { Github, Mail, Search, Shield, UserCheck, Users } from 'lucide-react';

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

function AuthBadge({ method }: { method: AdminUser['auth_method'] }) {
  if (method === 'github') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#1C1C1E]/15 bg-[#F5F5F0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1C1C1E]">
        <Github size={11} /> GitHub
      </span>
    );
  }
  if (method === 'email') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
        <Mail size={11} /> Email
      </span>
    );
  }
  if (method === 'both') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
        <Github size={11} />
        <Mail size={11} />
        Both
      </span>
    );
  }
  return (
    <span className="rounded-full border border-[#E5E5E0] bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
      Unknown
    </span>
  );
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
        user.name.toLowerCase().includes(q)
        || user.email.toLowerCase().includes(q)
        || String(user.id).includes(q)
      );
    });
  }, [data?.users, query, authFilter]);

  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1C1C1E] flex items-center gap-2">
            <Shield size={22} />
            User Registry
          </h2>
          <p className="text-sm font-medium text-[#6B6B6B]">
            Monitor signups, auth method (GitHub vs email), and activity per tenant.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-xl border border-[#E5E5E0] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#1C1C1E] hover:bg-[#FAFAF8] disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {[
          { label: 'Total users', value: summary?.total_users, icon: <Users size={16} /> },
          { label: 'GitHub', value: summary?.github_only, icon: <Github size={16} /> },
          { label: 'Email', value: summary?.email_only, icon: <Mail size={16} /> },
          { label: 'Verified', value: summary?.verified, icon: <UserCheck size={16} /> },
          { label: 'New (7d)', value: summary?.new_week, icon: <Shield size={16} /> },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-[#E5E5E0] bg-white p-4">
            <div className="mb-2 flex items-center gap-2 text-[#9CA3AF]">{card.icon}</div>
            <div className="text-2xl font-bold text-[#1C1C1E]">{card.value ?? '—'}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'All'],
            ['github', 'GitHub'],
            ['email', 'Email'],
            ['both', 'Both'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAuthFilter(id)}
              className={`rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                authFilter === id
                  ? 'bg-[#1C1C1E] text-white'
                  : 'border border-[#E5E5E0] bg-white text-[#6B6B6B] hover:text-[#1C1C1E]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-xl border border-[#E5E5E0] bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#1C1C1E]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full text-left text-sm">
            <thead className="border-b border-[#F5F5F0] bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Auth</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Jobs</th>
                <th className="px-4 py-3">Apps</th>
                <th className="px-4 py-3">Newsletter</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#9CA3AF] font-medium">
                    Loading users…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#9CA3AF] font-medium">
                    No users match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="border-b border-[#F5F5F0] last:border-0 hover:bg-[#FAFAF8]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1C1C1E]">{user.name || '—'}</div>
                      <div className="text-xs text-[#6B6B6B]">{user.email}</div>
                      <div className="text-[10px] text-[#9CA3AF]">#{user.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <AuthBadge method={user.auth_method} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          user.email_verified
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {user.email_verified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{user.jobs_count}</td>
                    <td className="px-4 py-3 font-mono text-xs">{user.applications_count}</td>
                    <td className="px-4 py-3 text-xs">{user.newsletter_opt_in ? 'On' : 'Off'}</td>
                    <td className="px-4 py-3 text-xs text-[#6B6B6B]">{formatDate(user.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
