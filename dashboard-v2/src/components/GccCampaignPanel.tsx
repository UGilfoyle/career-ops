'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Mail,
  MessageSquare,
  UserPlus,
  Calendar,
} from 'lucide-react';
import { PageSectionHeader, AiScoreBadge, CompanyAvatar } from './PageSectionHeader';

export type GccTarget = {
  id: string;
  company: string;
  role: string;
  dm_sent: boolean;
  email_sent: boolean;
  connection_sent: boolean;
  story_used: string;
  interview: boolean;
  follow_up: string;
  notes: string;
};

export type GccCampaign = {
  started_at: string;
  daily_log: Record<string, { connections: number; applications: number; mock_interview: boolean }>;
  targets: GccTarget[];
};

export const defaultGccCampaign = (): GccCampaign => ({
  started_at: new Date().toISOString().slice(0, 10),
  daily_log: {},
  targets: [],
});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type PipelineGccJob = {
  pipeline_id?: number;
  company?: string;
  title?: string;
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
  lastGccScanAdded = null,
  lastGccScanAt = null,
  gccPipelineTotal = 0,
  highValueCount = 0,
  isSaving,
  saveStatus,
}: Props) {
  const day = todayKey();
  const daily = campaign.daily_log[day] || { connections: 0, applications: 0, mock_interview: false };

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

  return (
    <motion.div key="gcc" className="w-full max-w-6xl space-y-8">
      <PageSectionHeader
        title="GCC Campaign"
        subtitle="30-day break-in system — connections, curated outreach, and interview tracking"
        actions={
                 <div className="flex flex-wrap items-center gap-3">
                   {onImportAllGcc && pipelineGccJobs.length > 0 && (
                     <button
                       type="button"
                       onClick={onImportAllGcc}
                       className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 transition-all hover:bg-emerald-100"
                     >
                       <Target size={14} />
                       Import {pipelineGccJobs.length} to outreach
                     </button>
                   )}
                   {onImportHighValue && highValueCount > 0 && (
                     <button
                       type="button"
                       onClick={onImportHighValue}
                       className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-bold text-violet-800 transition-all hover:bg-violet-100"
                     >
                       <Target size={14} />
                       Import {highValueCount} high-value
                     </button>
                   )}
                   <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className={`flex items-center gap-3 rounded-xl px-6 py-3 text-sm font-bold transition-all shadow-sm ${
              saveStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-[#1C1C1E] text-white hover:bg-[#27272a]'
            }`}
          >
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? <><CheckCircle2 size={18} /> Saved</> : 'Save Campaign'}
          </button>
                 </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5E5E0] rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[#9CA3AF] text-[10px] font-bold uppercase tracking-widest mb-2">
            <Calendar size={14} /> Day {dayNumber} / 30
          </div>
          <p className="text-sm text-[#6B6B6B]">Started {campaign.started_at}</p>
        </div>
        <div className="bg-white border border-[#E5E5E0] rounded-2xl p-5">
          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-3">Today&apos;s goals</p>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><UserPlus size={14} /> Connections (target 10)</span>
              <input
                type="number"
                min={0}
                max={99}
                value={daily.connections}
                onChange={(e) => updateDaily({ connections: Number(e.target.value) || 0 })}
                className="w-16 border border-[#E5E5E0] rounded-lg px-2 py-1 text-center text-sm"
              />
            </label>
            <label className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><Mail size={14} /> Curated apps (target 3–5)</span>
              <input
                type="number"
                min={0}
                max={99}
                value={daily.applications}
                onChange={(e) => updateDaily({ applications: Number(e.target.value) || 0 })}
                className="w-16 border border-[#E5E5E0] rounded-lg px-2 py-1 text-center text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={daily.mock_interview}
                onChange={(e) => updateDaily({ mock_interview: e.target.checked })}
                className="rounded"
              />
              Mock interview done this week
            </label>
          </div>
        </div>
        <div className="bg-[#1C1C1E] text-white rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">Signal engine</p>
          <p className="text-sm text-white/90 leading-relaxed">
            Score targets 3+ on: expansion news, hiring velocity, platform language, leadership hires, future domains.
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#E5E5E0] rounded-[2rem] overflow-hidden shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#F5F5F0] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <h3 className="font-bold text-[#1C1C1E]">Discovered GCC roles</h3>
              <span className="rounded-full bg-[#1C1C1E] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                {pipelineGccJobs.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#6B6B6B]">
              From <code className="text-[#57534e]">gcc-scan --deep</code> — also visible in Job Pipeline with a GCC badge.
            </p>
          </div>
          {onOpenPipeline && pipelineGccJobs.length > 0 && (
            <button
              type="button"
              onClick={onOpenPipeline}
              className="rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] px-4 py-2 text-xs font-bold text-[#1C1C1E] transition-all hover:bg-white"
            >
              Open Job Pipeline
            </button>
          )}
        </div>

        {pipelineGccJobs.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-semibold text-[#1C1C1E]">No GCC roles in pipeline yet</p>
            {lastGccScanAt && lastGccScanAdded != null ? (
              <p className="mt-2 text-xs text-amber-700 max-w-md mx-auto">
                Last scan ({new Date(lastGccScanAt).toLocaleString()}): <strong>{lastGccScanAdded} role(s) added</strong>.
                {lastGccScanAdded === 0
                  ? ' DuckDuckGo/board APIs found nothing matching your keywords — broaden positive keywords in Settings.'
                  : ' Data may still be syncing — refresh in ~10s or open Job Pipeline.'}
              </p>
            ) : (
              <p className="mt-2 text-xs text-[#9CA3AF] max-w-md mx-auto">
                Run <code className="text-[#6B6B6B]">gcc-scan --deep</code> in Terminal. Uses Greenhouse + Lever APIs first, then job boards.
              </p>
            )}
            {gccPipelineTotal > 0 && pipelineGccJobs.length === 0 && (
              <p className="mt-2 text-xs text-[#6B6B6B]">{gccPipelineTotal} GCC role(s) in database — reload dashboard if stale.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Signal</th>
                  <th className="px-4 py-3 text-left">Score</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F0]">
                {pipelineGccJobs.map((job, i) => (
                  <tr key={job.pipeline_id ?? i} className="hover:bg-[#FAFAF8]/80 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] font-bold tabular-nums text-[#C4C4BE]">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CompanyAvatar name={job.company} size="sm" />
                        <span className="font-bold text-[#1C1C1E]">{job.company}</span>
                        {job.gcc_high_value && (
                          <span className="rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-violet-800">
                            High
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B6B6B] font-medium max-w-[14rem] truncate">{job.title}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#57534e]">{job.gcc_signal_score ?? '—'}/5</td>
                    <td className="px-4 py-3"><AiScoreBadge score={job.score} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {onAddToOutreach && (
                          <button
                            type="button"
                            onClick={() => onAddToOutreach(String(job.company || ''), String(job.title || ''))}
                            className="rounded-lg border border-[#E5E5E0] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#1C1C1E] hover:bg-[#FAFAF8]"
                          >
                            Track
                          </button>
                        )}
                        {onTailorJob && job.pipeline_id != null && (
                          <button
                            type="button"
                            onClick={() => onTailorJob(Number(job.pipeline_id))}
                            className="rounded-lg bg-[#1C1C1E] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#27272a]"
                          >
                            Tailor
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#E5E5E0] rounded-[2rem] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F5F5F0]">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-[#1C1C1E]" />
            <h3 className="font-bold text-[#1C1C1E]">Outreach tracker</h3>
          </div>
          <button
            type="button"
            onClick={addTarget}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl border border-[#E5E5E0] hover:bg-[#FAFAF8]"
          >
            <Plus size={14} /> Add company
          </button>
        </div>

        {campaign.targets.length === 0 ? (
          <div className="p-10 text-center text-[#9CA3AF] text-sm">
            <p className="font-semibold text-[#6B6B6B]">Outreach tracker is empty</p>
            <p className="mt-2 max-w-md mx-auto">
              Import roles from <strong className="text-[#57534e]">Discovered GCC roles</strong> above, or add companies manually — then log DMs, emails, and follow-ups.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAF8] text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                <tr>
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-center" title="LinkedIn connection"><UserPlus size={14} className="inline" /></th>
                  <th className="px-4 py-3 text-center" title="Value DM"><MessageSquare size={14} className="inline" /></th>
                  <th className="px-4 py-3 text-center" title="Curated email"><Mail size={14} className="inline" /></th>
                  <th className="px-4 py-3 text-left">PAR story</th>
                  <th className="px-4 py-3 text-center">Interview</th>
                  <th className="px-4 py-3 text-left">Follow-up</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F0]">
                {campaign.targets.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FAFAF8]/80">
                    <td className="px-4 py-3">
                      <input
                        value={t.company}
                        onChange={(e) => updateTarget(t.id, { company: e.target.value })}
                        placeholder="e.g. Shark Ninja"
                        className="w-full min-w-[8rem] border border-[#E5E5E0] rounded-lg px-2 py-1.5 text-sm font-medium"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={t.role}
                        onChange={(e) => updateTarget(t.id, { role: e.target.value })}
                        placeholder="Role"
                        className="w-full min-w-[8rem] border border-[#E5E5E0] rounded-lg px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => updateTarget(t.id, { connection_sent: !t.connection_sent })} className="p-1">
                        {t.connection_sent ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Circle size={18} className="text-[#D4D4CE]" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => updateTarget(t.id, { dm_sent: !t.dm_sent })} className="p-1">
                        {t.dm_sent ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Circle size={18} className="text-[#D4D4CE]" />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => updateTarget(t.id, { email_sent: !t.email_sent })} className="p-1">
                        {t.email_sent ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Circle size={18} className="text-[#D4D4CE]" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={t.story_used}
                        onChange={(e) => updateTarget(t.id, { story_used: e.target.value })}
                        placeholder="PAR story used"
                        className="w-full min-w-[10rem] border border-[#E5E5E0] rounded-lg px-2 py-1.5 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => updateTarget(t.id, { interview: !t.interview })} className="p-1">
                        {t.interview ? <CheckCircle2 size={18} className="text-indigo-600" /> : <Circle size={18} className="text-[#D4D4CE]" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={t.follow_up}
                        onChange={(e) => updateTarget(t.id, { follow_up: e.target.value })}
                        placeholder="Next follow-up"
                        className="w-full min-w-[8rem] border border-[#E5E5E0] rounded-lg px-2 py-1.5 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => removeTarget(t.id)} className="p-2 text-[#9CA3AF] hover:text-rose-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-[#9CA3AF]">
        Tip: Run <code className="text-[#6B6B6B]">gcc-scan --deep</code> for captive employers, tailor with PAR bullets, then log outreach here — avoid blind Apply Now buttons.
      </p>
    </motion.div>
  );
}
