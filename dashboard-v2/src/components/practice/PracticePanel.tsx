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
import { Mic, Code2, Target } from 'lucide-react';
import { canAccessPracticeBeta } from '@/lib/lifetime-access';
import ProPaywall, { type PendingPayment } from '../ProPaywall';
import PracticeComingSoon from './PracticeComingSoon';
import HandbookCard from './HandbookCard';
import { type PracticePackContent } from './PracticePackView';
import { PracticeIdeView } from './PracticeIdeView';
import VoiceMockPanel from './VoiceMockPanel';

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
  const [viewMode, setViewMode] = useState<'voice' | 'ide'>('voice');
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

  const openPack = useCallback(async (packId: number) => {
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
  }, []);

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
        const loadedPacks = pData.packs || [];
        setPacks(loadedPacks);
        if (loadedPacks.length > 0) {
          void openPack(loadedPacks[0].id);
        }
      }
    } catch {
      // Offline or network error
    } finally {
      setBootLoading(false);
    }
  }, [openPack]);

  useEffect(() => {
    void loadQuotaAndPacks();
  }, [loadQuotaAndPacks]);

  const handleGenerate = async (params?: {
    mode?: 'job' | 'paste';
    jobId?: string;
    jdText?: string;
    company?: string;
    role?: string;
  }) => {
    setError('');
    setShowPaywall(false);
    setLoading(true);
    try {
      const activeMode = params?.mode || mode;
      const payload: Record<string, string> = { mode: activeMode };
      if (activeMode === 'job') {
        const targetJobId = params?.jobId || jobId;
        if (!targetJobId) throw new Error('Select a job posting from the dropdown');
        payload.jobId = targetJobId;
      } else {
        const text = (params?.jdText ?? jdText).trim();
        if (!text) throw new Error('Paste the job description text');
        payload.jdText = text;
        const comp = (params?.company ?? company).trim();
        const r = (params?.role ?? role).trim();
        if (comp) payload.company = comp;
        if (r) payload.role = r;
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

  if (bootLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <div className="space-y-2">
            <div className="h-6 w-52 rounded-md skeleton-shimmer" />
            <div className="h-3.5 w-80 rounded-md skeleton-shimmer" />
          </div>
          <div className="h-8 w-44 rounded-lg skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 space-y-4">
            <div className="h-64 rounded-xl border border-zinc-200 p-4 space-y-3 skeleton-shimmer" />
            <div className="h-44 rounded-xl border border-zinc-200 p-4 skeleton-shimmer" />
          </div>
          <div className="lg:col-span-7">
            <div className="h-96 rounded-xl border border-zinc-200 skeleton-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              {viewMode === 'voice' ? 'Voice Mock Interview' : 'Interview Practice IDE'}
            </h1>
            <Tag color={viewMode === 'voice' ? 'purple' : 'blue'} className="font-bold text-[10px] uppercase">
              {viewMode === 'voice' ? 'Real-Time Voice AI' : 'AI Coach'}
            </Tag>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {viewMode === 'voice'
              ? 'Live spoken interview simulation with hold-to-talk, real-time transcript, and Bar-Raiser scorecard evaluation.'
              : 'Generate customized coding problems, system design challenges, and STAR behavioral prompts from any job posting.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            options={[
              {
                label: (
                  <span className="inline-flex items-center gap-1.5 px-1 py-0.5">
                    <Mic size={13} />
                    <span>Voice Mock</span>
                  </span>
                ),
                value: 'voice',
              },
              {
                label: (
                  <span className="inline-flex items-center gap-1.5 px-1 py-0.5">
                    <Code2 size={13} />
                    <span>Coding / Prompts IDE</span>
                  </span>
                ),
                value: 'ide',
              },
            ]}
            value={viewMode}
            onChange={(val) => setViewMode(val as 'voice' | 'ide')}
            className="font-medium bg-zinc-100 p-0.5 rounded-lg shadow-2xs"
          />

          {quota && (
            <Tag color={quota.pro ? 'success' : quota.remaining > 0 ? 'blue' : 'warning'} className="text-xs font-semibold py-1 px-2.5 m-0">
              {quota.pro
                ? 'Pro Member'
                : `${quota.remaining} / ${quota.freeLimit} Weekly`}
            </Tag>
          )}
        </div>
      </div>

      {error && <Alert type="error" message={error} showIcon closable onClose={() => setError('')} />}

      {viewMode === 'voice' ? (
        <VoiceMockPanel pipeline={jobs} onBackToPacks={() => setViewMode('ide')} />
      ) : (
        <div className="space-y-6">
          <PracticeIdeView
            company={activePack?.company || (packs[0]?.company ?? 'Target Company')}
            role={activePack?.role || (packs[0]?.role ?? 'Software Engineer')}
            codingPrompts={activePack?.content?.coding || []}
            systemDesignPrompts={activePack?.content?.systemDesign || []}
            behavioralPrompts={activePack?.content?.behavioral || []}
            questionCount={
              activePack
                ? (activePack.content.coding?.length || 0) +
                  (activePack.content.systemDesign?.length || 0) +
                  (activePack.content.behavioral?.length || 0)
                : undefined
            }
            packs={packs}
            activePackId={activePack?.id ?? null}
            onSelectPack={openPack}
            jobs={jobs}
            onGenerateNewPack={handleGenerate}
            generating={loading}
          />

          {/* Curated AI + DSA Handbook */}
          <div className="pt-2">
            <HandbookCard />
          </div>
        </div>
      )}
    </div>
  );
}
