'use client';

import React, { useState, useRef } from 'react';
import {
  Target,
  Sparkles,
  Zap,
  ArrowRight,
  Plus,
  Trash2,
  Calendar,
  UserPlus,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Check,
  RefreshCw,
  ExternalLink,
  Building2,
} from 'lucide-react';
import { PageSectionHeader, AiScoreBadge } from './PageSectionHeader';
import { JobAvatar } from './JobAvatar';
import type { GccCampaign, GccTarget } from './gcc-campaign';

export type { GccCampaign, GccTarget };
export { defaultGccCampaign } from './gcc-campaign';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatRelativeTime(dateStr?: string | null) {
  if (!dateStr) return 'Never';
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return 'Never';
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days < 0) return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type PipelineGccJob = {
  pipeline_id?: number;
  company?: string;
  title?: string;
  url?: string;
  source?: string | null;
  portal_key?: string | null;
  logo_url?: string | null;
  logo_source?: string | null;
  score?: string | number | null;
  gcc_signal_score?: number | null;
  gcc_high_value?: boolean;
};

type Props = {
  campaign: GccCampaign;
  onChange: (next: GccCampaign) => void;
  onSave: () => void;
  onImportHighValue?: () => void;
  onImportAllGcc?: () => void;
  pipelineGccJobs?: PipelineGccJob[];
  onOpenPipeline?: () => void;
  onTailorJob?: (jobId: number) => void;
  onAddToOutreach?: (company: string, role: string) => void;
  onResearchDraft?: (opts: { jobId?: number; company: string; role: string; url?: string }) => void;
  onRefresh?: () => void;
  lastGccScanAdded?: number | null;
  lastGccScanAt?: string | null;
  gccPipelineTotal?: number;
  highValueCount?: number;
  isSaving: boolean;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
};

export function GccCampaignPanel({
  campaign,
  onChange,
  onSave,
  onImportHighValue,
  onImportAllGcc,
  pipelineGccJobs = [],
  onOpenPipeline,
  onTailorJob,
  onAddToOutreach,
  onResearchDraft,
  onRefresh,
  lastGccScanAdded = null,
  lastGccScanAt = null,
  gccPipelineTotal = 0,
  highValueCount = 0,
  isSaving,
  saveStatus,
}: Props) {
  const day = todayKey();
  const daily = campaign.daily_log[day] || { connections: 0, applications: 0, mock_interview: false };

  const [gccUrl, setGccUrl] = useState('');
  const [actionStatus, setActionStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [actionType, setActionType] = useState<'tailor' | 'scan' | null>(null);
  const [stepMessage, setStepMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

  const updateDaily = (patch: Partial<typeof daily>) => {
    onChange({
      ...campaign,
      daily_log: {
        ...campaign.daily_log,
        [day]: { ...daily, ...patch },
      },
    });
  };

  const addTarget = () => {
    onChange({
      ...campaign,
      targets: [
        ...campaign.targets,
        {
          id: `gcc-${Date.now()}`,
          company: '',
          role: '',
          dm_sent: false,
          email_sent: false,
          connection_sent: false,
          story_used: '',
          interview: false,
          follow_up: '',
          notes: '',
        },
      ],
    });
  };

  const updateTarget = (id: string, patch: Partial<GccTarget>) => {
    onChange({
      ...campaign,
      targets: campaign.targets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  };

  const removeTarget = (id: string) => {
    onChange({
      ...campaign,
      targets: campaign.targets.filter((t) => t.id !== id),
    });
  };

  const dayNumber = Math.max(
    1,
    Math.floor((Date.now() - new Date(campaign.started_at).getTime()) / 86400000) + 1
  );

  const handleInstantTailor = (targetUrl?: string) => {
    const rawUrl = (targetUrl || gccUrl).trim();
    if (!rawUrl) return;

    if (/[\r\n\t<>]/.test(rawUrl) || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))) {
      setErrorMessage('Please enter a valid job URL (e.g. https://linkedin.com/jobs/view/...)');
      setActionStatus('error');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setActionType('tailor');
    setActionStatus('running');
    setErrorMessage('');
    setStepMessage('Extracting GCC competency signals from job posting...');

    let receivedEvents = false;
    const query = `tailor ${rawUrl} --deep`;
    const es = new EventSource(`/api/exec?q=${encodeURIComponent(query)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      receivedEvents = true;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'done') {
          es.close();
          setActionStatus('success');
          setStepMessage('GCC resume and tailored leadership pitch ready!');
          if (onRefresh) onRefresh();
        } else if (data.type === 'stderr') {
          const content = String(data.content || '');
          if (content.toLowerCase().includes('error') || content.toLowerCase().includes('fail')) {
            setErrorMessage(content.slice(0, 160));
          }
        } else if (data.type === 'stdout') {
          const content = String(data.content || '');
          if (content.includes('task accepted') || content.includes('working')) {
            setStepMessage('Task queued in high-performance cloud engine...');
          } else if (content.includes('crafting') || content.includes('tailored resume')) {
            setStepMessage('Aligning skills, experience & generating ATS documents...');
          } else if (content.includes('Processing')) {
            setStepMessage('Matching profile against GCC requirements...');
          }
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      if (!receivedEvents) {
        setActionStatus('error');
        setErrorMessage('Unable to connect to execution service. Please check your connection.');
      } else {
        setActionStatus('success');
        setStepMessage('Task dispatched to background engine. Results will appear in Resume Studio shortly!');
        if (onRefresh) onRefresh();
      }
    };
  };

  const handleRunGccScan = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setActionType('scan');
    setActionStatus('running');
    setErrorMessage('');
    setStepMessage('Warming up GCC captive employer crawler (India tech hubs)...');

    let receivedEvents = false;
    const query = `gcc-scan --deep`;
    const es = new EventSource(`/api/exec?q=${encodeURIComponent(query)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      receivedEvents = true;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'done') {
          es.close();
          setActionStatus('success');
          setStepMessage('GCC Scan completed! Discovered captive roles updated in pipeline.');
          if (onRefresh) onRefresh();
        } else if (data.type === 'stderr') {
          const content = String(data.content || '');
          if (content.toLowerCase().includes('error') || content.toLowerCase().includes('fail')) {
            setErrorMessage(content.slice(0, 160));
          }
        } else if (data.type === 'stdout') {
          const content = String(data.content || '');
          if (content.includes('Warming up') || content.includes('Searching')) {
            setStepMessage('Searching captive MNC employers on LinkedIn & job boards...');
          } else if (content.includes('Scanned') || content.includes('Found')) {
            setStepMessage(content.trim().slice(0, 100));
          }
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      if (!receivedEvents) {
        setActionStatus('error');
        setErrorMessage('Scanner connection interrupted. Check your network.');
      } else {
        setActionStatus('success');
        setStepMessage('GCC Scanner completed background run. Refreshing discovered roles...');
        if (onRefresh) onRefresh();
      }
    };
  };

  const resetActionState = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setActionStatus('idle');
    setActionType(null);
    setStepMessage('');
    setErrorMessage('');
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2.5">
      {onImportAllGcc && pipelineGccJobs.length > 0 && (
        <button
          type="button"
          onClick={onImportAllGcc}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 shadow-sm transition-colors"
        >
          <Target size={14} className="text-zinc-600" />
          <span>Import {pipelineGccJobs.length} to Outreach</span>
        </button>
      )}

      {onImportHighValue && highValueCount > 0 && (
        <button
          type="button"
          onClick={onImportHighValue}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl border border-purple-200 bg-purple-50 text-purple-900 hover:bg-purple-100 shadow-sm transition-colors"
        >
          <Sparkles size={14} className="text-purple-600" />
          <span>Import {highValueCount} High-Value</span>
        </button>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm transition-colors disabled:opacity-60"
      >
        {isSaving ? (
          <Loader2 size={14} className="animate-spin text-zinc-400" />
        ) : saveStatus === 'success' ? (
          <CheckCircle2 size={14} className="text-emerald-400" />
        ) : (
          <Save size={14} />
        )}
        <span>
          {isSaving
            ? 'Saving...'
            : saveStatus === 'success'
            ? 'Saved'
            : 'Save Campaign'}
        </span>
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-6xl space-y-6">
      <PageSectionHeader
        title="GCC Campaign"
        subtitle="30-day captive break-in system: leadership connections, curated outreach, and interview acceleration"
        actions={headerActions}
      />

      {/* Feature 1: Live Action Center (Tailor & GCC Scanner) */}
      <div className="relative rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-zinc-900 to-blue-500" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/80">
                <Sparkles size={12} className="text-emerald-600" />
                GCC Break-in Engine
              </span>
              <span className="text-[11px] text-zinc-400 font-medium">
                India Hubs: Bengaluru · Hyderabad · Pune · Gurugram
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
              Instant GCC Resume Tailor & Captive Discovery
            </h3>
            <p className="text-xs text-zinc-500 mt-1 font-normal leading-relaxed">
              Paste any GCC job URL or trigger the captive employer crawler to extract competency signals and generate targeted ATS resumes in seconds.
            </p>

            <div className="pt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunGccScan}
                disabled={actionStatus === 'running'}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-colors disabled:opacity-60"
              >
                <span>Run GCC Scanner</span>
                <Zap size={13} />
              </button>
            </div>
          </div>

          {/* Form / Execution Status */}
          <div className="w-full lg:max-w-md">
            {actionStatus === 'idle' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleInstantTailor();
                }}
                className="flex flex-col sm:flex-row items-center gap-2.5"
              >
                <div className="relative w-full flex-1">
                  <input
                    type="url"
                    required
                    value={gccUrl}
                    onChange={(e) => setGccUrl(e.target.value)}
                    placeholder="Paste GCC job URL (LinkedIn, Naukri, Portal)..."
                    className="w-full h-10 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-sm w-full sm:w-auto shrink-0"
                >
                  <span>Tailor GCC Role</span>
                  <ArrowRight size={14} />
                </button>
              </form>
            )}

            {actionStatus === 'running' && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-blue-950 truncate">
                      {stepMessage || (actionType === 'scan' ? 'Crawling captive employers...' : 'Processing GCC job posting...')}
                    </p>
                    <p className="text-[11px] text-blue-700/90 mt-0.5 font-normal">
                      {actionType === 'scan'
                        ? 'Executing gcc-scan --deep in high-performance cloud engine'
                        : 'Aligning competency signals and generating ATS resume documents'}
                    </p>
                  </div>
                  <Loader2 size={18} className="animate-spin text-blue-600 shrink-0" />
                </div>
                <div className="mt-3 h-1 w-full rounded-full bg-blue-200/60 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full animate-pulse w-3/4 transition-all duration-500" />
                </div>
              </div>
            )}

            {actionStatus === 'success' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-950 truncate">
                        {actionType === 'scan' ? 'GCC Scan Completed' : 'GCC Resume Tailored'}
                      </p>
                      <p className="text-[11px] text-emerald-700 mt-0.5 truncate">
                        {stepMessage}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetActionState}
                    className="inline-flex items-center justify-center h-7 px-2.5 text-[11px] font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 transition-colors shrink-0"
                  >
                    <span>Done</span>
                  </button>
                </div>
              </div>
            )}

            {actionStatus === 'error' && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle size={16} className="text-red-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-red-950 truncate">
                        Action encountered an issue
                      </p>
                      <p className="text-[11px] text-red-700 mt-0.5 truncate">
                        {errorMessage || 'Unable to complete task. Check URL or network.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetActionState}
                    className="inline-flex items-center justify-center h-7 px-2.5 text-[11px] font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 transition-colors shrink-0"
                  >
                    <span>Try again</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature 2: Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: 30-Day Campaign Progress */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Timeline Progress
              </span>
              <span className="text-xs font-semibold text-zinc-500">
                {Math.min(100, Math.round((dayNumber / 30) * 100))}% Completed
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-zinc-900 tracking-tight">
                Day {dayNumber}
              </span>
              <span className="text-xs font-medium text-zinc-400">
                / 30 Days
              </span>
            </div>

            <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((dayNumber / 30) * 100))}%` }}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 mt-4 flex items-center justify-between text-xs text-zinc-400">
            <span>Started {campaign.started_at}</span>
            <span className="font-medium text-zinc-600">{Math.max(0, 30 - dayNumber)} days left</span>
          </div>
        </div>

        {/* Card 2: Today's Daily Targets */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">
              Daily Execution Targets
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
                  <UserPlus size={13} className="text-zinc-500" />
                  <span>Connections (Goal: 10)</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={daily.connections}
                  onChange={(e) => updateDaily({ connections: Number(e.target.value) || 0 })}
                  className="h-7 w-16 px-2 text-center font-bold text-xs rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
                  <Mail size={13} className="text-zinc-500" />
                  <span>Curated Apps (Goal: 3 to 5)</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={daily.applications}
                  onChange={(e) => updateDaily({ applications: Number(e.target.value) || 0 })}
                  className="h-7 w-16 px-2 text-center font-bold text-xs rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={daily.mock_interview}
                onChange={(e) => updateDaily({ mock_interview: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
              />
              <span className="text-xs text-zinc-700 font-medium">
                Mock interview completed this week
              </span>
            </label>
          </div>
        </div>

        {/* Card 3: Signal Engine Briefing */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-sm text-white flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                GCC Signal Engine
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                Live Scanner
              </span>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-normal">
              Score targets 3+ on expansion news, hiring velocity, platform modernization, leadership appointments, and emerging captive engineering domains.
            </p>
          </div>

          <div className="pt-4 border-t border-zinc-800/80 mt-4 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-zinc-500 block">Discovered</span>
              <span className="text-sm font-bold text-zinc-100">{gccPipelineTotal} roles</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-zinc-500 block">Last Crawl</span>
              <span className="text-sm font-bold text-zinc-100">{formatRelativeTime(lastGccScanAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 3: Discovered GCC Roles */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Building2 size={16} className="text-zinc-800" />
            <h3 className="text-sm font-bold text-zinc-900">
              Discovered GCC Roles
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {pipelineGccJobs.length}
            </span>
          </div>

          {onOpenPipeline && pipelineGccJobs.length > 0 && (
            <button
              type="button"
              onClick={onOpenPipeline}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 shadow-sm transition-colors"
            >
              <span>Open Job Pipeline</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {pipelineGccJobs.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-xs text-zinc-500">
              No GCC captive roles detected in pipeline yet.
            </p>
            <button
              type="button"
              onClick={handleRunGccScan}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm transition-colors mx-auto"
            >
              <Zap size={13} />
              <span>Run GCC Scanner Now</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50/70 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="py-2.5 px-3 text-left">Company</th>
                  <th className="py-2.5 px-3 text-left">Role</th>
                  <th className="py-2.5 px-3 text-left">Signal</th>
                  <th className="py-2.5 px-3 text-left">Score</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/70">
                {pipelineGccJobs.map((job, i) => (
                  <tr key={job.pipeline_id ?? i} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <JobAvatar company={job.company} size="sm" />
                        <span className="font-bold text-zinc-900">{job.company}</span>
                        {job.gcc_high_value && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            High
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-zinc-700 font-medium max-w-[240px] truncate">
                      {job.title}
                    </td>
                    <td className="py-3 px-3 font-mono text-zinc-600">
                      {job.gcc_signal_score != null ? `${job.gcc_signal_score}/5` : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <AiScoreBadge score={job.score} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {onAddToOutreach && (
                          <button
                            type="button"
                            onClick={() =>
                              onAddToOutreach(String(job.company || ''), String(job.title || ''))
                            }
                            className="inline-flex items-center justify-center h-7 px-2.5 text-[11px] font-semibold rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 transition-colors"
                          >
                            <span>Track</span>
                          </button>
                        )}

                        {onResearchDraft && (
                          <button
                            type="button"
                            onClick={() =>
                              onResearchDraft({
                                jobId: job.pipeline_id,
                                company: String(job.company || ''),
                                role: String(job.title || ''),
                                url: job.url,
                              })
                            }
                            className="inline-flex items-center justify-center h-7 px-2.5 text-[11px] font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            <span>Draft</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (job.url) {
                              setGccUrl(job.url);
                              handleInstantTailor(job.url);
                            } else if (onTailorJob && job.pipeline_id != null) {
                              onTailorJob(Number(job.pipeline_id));
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 text-[11px] font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                        >
                          <Zap size={11} />
                          <span>Tailor</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feature 4: Outreach Tracker Table */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-zinc-800" />
            <h3 className="text-sm font-bold text-zinc-900">
              Outreach Tracker
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700">
              {campaign.targets.length} targets
            </span>
          </div>

          <button
            type="button"
            onClick={addTarget}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm transition-colors"
          >
            <Plus size={13} />
            <span>Add Target</span>
          </button>
        </div>

        {campaign.targets.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-400">
            Outreach tracker is empty. Import roles from Discovered GCC roles above or click Add Target to log companies manually.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50/70 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="py-2.5 px-3 text-left">Company</th>
                  <th className="py-2.5 px-3 text-left">Role</th>
                  <th className="py-2.5 px-2 text-center">Connected</th>
                  <th className="py-2.5 px-2 text-center">DM Sent</th>
                  <th className="py-2.5 px-2 text-center">Email Sent</th>
                  <th className="py-2.5 px-3 text-left">PAR Story / Angle</th>
                  <th className="py-2.5 px-2 text-center">Interview</th>
                  <th className="py-2.5 px-3 text-left">Next Follow-up</th>
                  <th className="py-2.5 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100/70">
                {campaign.targets.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={t.company}
                        onChange={(e) => updateTarget(t.id, { company: e.target.value })}
                        placeholder="e.g. Acme GCC"
                        className="h-8 w-32 px-2.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-900 focus:outline-none transition-all"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={t.role}
                        onChange={(e) => updateTarget(t.id, { role: e.target.value })}
                        placeholder="Target role"
                        className="h-8 w-32 px-2.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-900 focus:outline-none transition-all"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={t.connection_sent}
                        onChange={(e) => updateTarget(t.id, { connection_sent: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={t.dm_sent}
                        onChange={(e) => updateTarget(t.id, { dm_sent: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={t.email_sent}
                        onChange={(e) => updateTarget(t.id, { email_sent: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={t.story_used}
                        onChange={(e) => updateTarget(t.id, { story_used: e.target.value })}
                        placeholder="PAR story used"
                        className="h-8 w-36 px-2.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-900 focus:outline-none transition-all"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={t.interview}
                        onChange={(e) => updateTarget(t.id, { interview: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={t.follow_up}
                        onChange={(e) => updateTarget(t.id, { follow_up: e.target.value })}
                        placeholder="Next follow-up date"
                        className="h-8 w-32 px-2.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 focus:bg-white focus:border-zinc-900 focus:outline-none transition-all"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        {onResearchDraft && (
                          <button
                            type="button"
                            onClick={() => onResearchDraft({ company: t.company, role: t.role })}
                            className="inline-flex items-center justify-center h-7 px-2 text-[11px] font-semibold rounded-lg border border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 transition-colors"
                          >
                            <span>Draft</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeTarget(t.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                          title="Remove target"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
