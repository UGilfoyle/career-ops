'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Segmented,
  Select,
  Input,
  Button,
  Card,
  Tag,
  Badge,
  Alert,
  Spin,
  Space,
  Statistic,
} from 'antd';
import {
  ThunderboltOutlined,
  ReadOutlined,
  SyncOutlined,
  CodeOutlined,
  RocketOutlined,
  FileTextOutlined,
  StarOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { canAccessPracticeBeta } from '@/lib/lifetime-access';
import ProPaywall, { type PendingPayment } from '../ProPaywall';
import PracticeComingSoon from './PracticeComingSoon';
import HandbookCard from './HandbookCard';
import PracticePackView, { type PracticePackContent } from './PracticePackView';
import { PracticeIdeView } from './PracticeIdeView';

type PipelineJob = {
  pipeline_id?: number | string;
  id?: number | string;
  company?: string;
  title?: string;
  role?: string;
  is_applied?: boolean;
  application_status?: string | null;
  app_id?: number | null;
};

type ApplicationRow = {
  id?: number | string;
  job_id?: number | string;
  company?: string;
  title?: string;
  role?: string;
  status?: string | null;
};

type QuotaState = {
  remaining: number;
  resetAt: string | null;
  pro: boolean;
  freeLimit: number;
  banner: string;
};

type PackSummary = {
  id: number;
  company: string | null;
  role: string | null;
  createdAt: string;
  counts: { coding: number; systemDesign: number; behavioral: number };
};

type Props = {
  pipeline?: PipelineJob[];
  applications?: ApplicationRow[];
  planDisplay: string;
  planSubtitle: string;
  pendingPayment?: PendingPayment | null;
  onUpgrade?: () => void;
};

function jobIsApplied(job: PipelineJob) {
  const status = String(job.application_status || '').toUpperCase();
  if (['APPLIED', 'RESPONDED', 'INTERVIEW', 'INTERVIEWING', 'OFFER', 'SENT'].includes(status)) {
    return true;
  }
  return Boolean(job.is_applied || job.app_id);
}

function packTotal(counts: { coding: number; systemDesign: number; behavioral: number }) {
  return (counts.coding || 0) + (counts.systemDesign || 0) + (counts.behavioral || 0);
}

export default function PracticePanel({
  pipeline = [],
  applications = [],
  planDisplay,
  planSubtitle,
  pendingPayment,
  onUpgrade,
}: Props) {
  const { data: session, status: sessionStatus } = useSession();
  const [mode, setMode] = useState<'job' | 'paste'>('job');
  const [jobId, setJobId] = useState<string>('');
  const [jdText, setJdText] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [activePack, setActivePack] = useState<{
    id: number;
    company: string | null;
    role: string | null;
    content: PracticePackContent;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const [comingSoon, setComingSoon] = useState(false);
  const [jobFilter, setJobFilter] = useState<'applied' | 'all'>('applied');
  const [sandboxOpen, setSandboxOpen] = useState(true);

  const sessionEmail = session?.user?.email ?? null;
  const clientBetaAllowed =
    sessionStatus === 'authenticated' && canAccessPracticeBeta(sessionEmail);

  const appliedJobIds = useMemo(() => {
    const ids = new Set<string>();
    for (const app of applications) {
      if (app.job_id != null) ids.add(String(app.job_id));
    }
    for (const j of pipeline) {
      if (jobIsApplied(j)) ids.add(String(j.pipeline_id ?? j.id ?? ''));
    }
    ids.delete('');
    return ids;
  }, [applications, pipeline]);

  const jobs = useMemo(() => {
    const mapped = pipeline
      .map((j) => ({
        id: String(j.pipeline_id ?? j.id ?? ''),
        company: j.company || 'Company',
        title: j.title || j.role || 'Role',
        applied: jobIsApplied(j) || appliedJobIds.has(String(j.pipeline_id ?? j.id ?? '')),
      }))
      .filter((j) => j.id);

    for (const app of applications) {
      const id = String(app.job_id ?? '');
      if (!id || mapped.some((m) => m.id === id)) continue;
      mapped.push({
        id,
        company: app.company || 'Company',
        title: app.title || app.role || 'Role',
        applied: true,
      });
    }

    const applied = mapped.filter((j) => j.applied);
    const rest = mapped.filter((j) => !j.applied);
    const ordered = [...applied, ...rest];
    if (jobFilter === 'applied') return applied.length ? applied : ordered.slice(0, 0);
    return ordered.slice(0, 80);
  }, [pipeline, applications, appliedJobIds, jobFilter]);

  const loadQuotaAndPacks = useCallback(async () => {
    try {
      const [qRes, pRes] = await Promise.all([
        fetch('/api/practice/quota'),
        fetch('/api/practice/packs'),
      ]);
      if (qRes.status === 403) {
        setComingSoon(true);
        return;
      }
      if (qRes.ok) {
        const qData = await qRes.json();
        setQuota(qData);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPacks(pData.packs || []);
      }
    } catch {
      // Offline or network error
    } finally {
      setBootLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuotaAndPacks();
  }, [loadQuotaAndPacks]);

  const openPack = async (packId: number) => {
    setError('');
    try {
      const res = await fetch(`/api/practice/packs/${packId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to load pack');
      setActivePack({
        id: data.pack.id,
        company: data.pack.company,
        role: data.pack.role,
        content: data.pack.content,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open pack');
    }
  };

  const handleGenerate = async () => {
    setError('');
    setShowPaywall(false);
    setLoading(true);
    try {
      const payload: Record<string, string> = { mode };
      if (mode === 'job') {
        if (!jobId) throw new Error('Select a job posting from the dropdown');
        payload.jobId = jobId;
      } else {
        if (!jdText.trim()) throw new Error('Paste the job description text');
        payload.jdText = jdText.trim();
        if (company.trim()) payload.company = company.trim();
        if (role.trim()) payload.role = role.trim();
      }

      const res = await fetch('/api/practice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 402 || data.code === 'QUOTA_EXCEEDED') {
        setShowPaywall(true);
        return;
      }
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Generation failed');
      }

      await loadQuotaAndPacks();
      if (data.packId) {
        await openPack(data.packId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  if (comingSoon && !clientBetaAllowed) {
    return <PracticeComingSoon />;
  }

  if (showPaywall) {
    return (
      <ProPaywall
        feature="practice"
        planDisplay={planDisplay}
        planSubtitle={planSubtitle}
        pendingPayment={pendingPayment}
        onUpgrade={onUpgrade}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Quota */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Interview Practice IDE</h1>
            <Tag color="purple" className="font-bold text-[10px] uppercase">
              AI Coach
            </Tag>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Generate customized coding problems, system design challenges, and STAR behavioral prompts from any job posting.
          </p>
        </div>

        {quota && (
          <div className="flex items-center gap-2">
            <Tag color={quota.pro ? 'success' : quota.remaining > 0 ? 'blue' : 'warning'} className="text-xs font-semibold py-1 px-2.5">
              {quota.pro
                ? 'Pro Member — Unlimited Packs'
                : `${quota.remaining} / ${quota.freeLimit} Weekly Pack Remaining`}
            </Tag>
          </div>
        )}
      </div>

      {error && <Alert type="error" message={error} showIcon closable onClose={() => setError('')} />}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Generate Pack + Saved Packs (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Generator Card */}
          <Card
            size="small"
            className="border-zinc-200 shadow-xs"
            title={<span className="text-xs font-bold text-zinc-900">Generate New Practice Pack</span>}
          >
            <div className="space-y-3">
              <Segmented
                block
                options={[
                  { label: 'From Pipeline Job', value: 'job' },
                  { label: 'Paste Job Description', value: 'paste' },
                ]}
                value={mode}
                onChange={(val) => setMode(val as 'job' | 'paste')}
              />

              {mode === 'job' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase">Select Job</span>
                    <Segmented
                      size="small"
                      options={[
                        { label: 'Applied', value: 'applied' },
                        { label: 'All Jobs', value: 'all' },
                      ]}
                      value={jobFilter}
                      onChange={(val) => setJobFilter(val as 'applied' | 'all')}
                    />
                  </div>
                  <Select
                    className="w-full"
                    placeholder="Choose a pipeline role…"
                    value={jobId || undefined}
                    onChange={(val) => setJobId(val)}
                    options={jobs.map((j) => ({
                      label: `${j.company} — ${j.title} ${j.applied ? '(Applied)' : ''}`,
                      value: j.id,
                    }))}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Company (optional)"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                    <Input
                      placeholder="Role Title (optional)"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                  </div>
                  <Input.TextArea
                    rows={4}
                    placeholder="Paste the full job description or key requirements here…"
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                  />
                </div>
              )}

              <Button
                type="primary"
                block
                icon={loading ? <LoadingOutlined /> : <ThunderboltOutlined />}
                loading={loading}
                onClick={handleGenerate}
              >
                {loading ? 'Analyzing JD & Generating Pack…' : 'Generate Interview Pack'}
              </Button>
            </div>
          </Card>

          {/* Saved Practice Packs List */}
          <Card
            size="small"
            className="border-zinc-200 shadow-xs"
            title={
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">Saved Practice Packs</span>
                <Tag color="default" className="font-mono text-[10px]">
                  {packs.length}
                </Tag>
              </div>
            }
          >
            {packs.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-400">
                No practice packs generated yet. Generate your first pack above!
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                {packs.map((p) => {
                  const isSelected = activePack?.id === p.id;
                  const total = packTotal(p.counts);
                  return (
                    <div
                      key={p.id}
                      onClick={() => openPack(p.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-zinc-900 bg-zinc-50 shadow-xs'
                          : 'border-zinc-100 bg-white hover:border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-900 truncate">
                            {p.company || 'Custom Job'}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {p.role || 'Software Engineering'}
                          </div>
                        </div>
                        <Tag color="blue" className="text-[10px] font-mono">
                          {total} Prompts
                        </Tag>
                      </div>
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <Tag color="default" className="text-[9px] m-0">
                          Code: {p.counts.coding}
                        </Tag>
                        <Tag color="default" className="text-[9px] m-0">
                          Sys: {p.counts.systemDesign}
                        </Tag>
                        <Tag color="default" className="text-[9px] m-0">
                          STAR: {p.counts.behavioral}
                        </Tag>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Curated Interview Handbook */}
          <HandbookCard />
        </div>

        {/* Right Column: Active Pack View or Standalone IDE (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {activePack ? (
            <Card
              size="small"
              className="border-zinc-200 shadow-xs"
              title={
                <div>
                  <div className="text-sm font-bold text-zinc-900">
                    {activePack.company || 'Role Practice Pack'} — {activePack.role || 'Interview Prep'}
                  </div>
                  <div className="text-xs text-zinc-400 font-normal">
                    Interactive coding sandbox & interview prompt evaluation
                  </div>
                </div>
              }
            >
              <PracticePackView
                content={activePack.content}
                company={activePack.company}
                role={activePack.role}
              />
            </Card>
          ) : (
            <Card
              size="small"
              className="border-zinc-200 shadow-xs"
              title={<span className="text-xs font-bold text-zinc-900">Interactive Coding Sandbox (Deno / Py / Node)</span>}
            >
              <PracticeIdeView />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
