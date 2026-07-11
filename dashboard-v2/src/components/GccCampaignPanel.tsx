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
import { PageSectionHeader } from './PageSectionHeader';

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

type Props = {
  campaign: GccCampaign;
  onChange: (next: GccCampaign) => void;
  onSave: () => void;
  onImportHighValue?: () => void;
  highValueCount?: number;
  isSaving: boolean;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
};

export function GccCampaignPanel({ campaign, onChange, onSave, onImportHighValue, highValueCount = 0, isSaving, saveStatus }: Props) {
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
                 <div className="flex items-center gap-3">
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
            No GCC targets yet. Add companies from your pipeline — track DM, email, connection, and follow-ups here.
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
        Tip: Add GCC pipeline jobs with <code className="text-[#6B6B6B]">scan --deep</code>, tailor with PAR bullets, then log outreach here — avoid blind Apply Now buttons.
      </p>
    </motion.div>
  );
}
