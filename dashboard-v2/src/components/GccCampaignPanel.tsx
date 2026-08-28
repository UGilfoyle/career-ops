'use client';

import { useState } from 'react';
import {
  Card,
  Button,
  Tag,
  Input,
  InputNumber,
  Checkbox,
  Space,
  Statistic,
  Popconfirm,
  Badge,
} from 'antd';
import {
  AimOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  UserAddOutlined,
  MailOutlined,
  ThunderboltOutlined,
  EditOutlined,
  CheckOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { PageSectionHeader, AiScoreBadge } from './PageSectionHeader';
import { JobAvatar } from './JobAvatar';
import type { GccCampaign, GccTarget } from './gcc-campaign';

export type { GccCampaign, GccTarget };
export { defaultGccCampaign } from './gcc-campaign';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
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
    <div className="w-full max-w-6xl space-y-6">
      <PageSectionHeader
        title="GCC Campaign"
        subtitle="30-day break-in system: connections, curated outreach, and interview tracking"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {onImportAllGcc && pipelineGccJobs.length > 0 && (
              <Button
                icon={<AimOutlined />}
                onClick={onImportAllGcc}
              >
                Import {pipelineGccJobs.length} to Outreach
              </Button>
            )}
            {onImportHighValue && highValueCount > 0 && (
              <Button
                icon={<AimOutlined />}
                onClick={onImportHighValue}
              >
                Import {highValueCount} High-Value
              </Button>
            )}
            <Button
              type="primary"
              icon={saveStatus === 'success' ? <CheckCircleOutlined /> : <SaveOutlined />}
              onClick={onSave}
              loading={isSaving}
            >
              {saveStatus === 'saving'
                ? 'Saving...'
                : saveStatus === 'success'
                ? 'Saved'
                : 'Save Campaign'}
            </Button>
          </div>
        }
      />

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card size="small" className="border-zinc-200 shadow-xs">
          <Statistic
            title={
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <CalendarOutlined className="mr-1" /> DAY {dayNumber} / 30
              </span>
            }
            value={`Day ${dayNumber}`}
            valueStyle={{ fontSize: 18, fontWeight: 700 }}
          />
          <div className="text-xs text-zinc-500 mt-1">Started {campaign.started_at}</div>
        </Card>

        <Card size="small" className="border-zinc-200 shadow-xs">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2.5">
            Today&apos;s Targets
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-700">
                <UserAddOutlined /> Connections (Goal: 10)
              </span>
              <InputNumber
                min={0}
                max={99}
                size="small"
                value={daily.connections}
                onChange={(val) => updateDaily({ connections: Number(val) || 0 })}
                style={{ width: 60 }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-zinc-700">
                <MailOutlined /> Curated Apps (Goal: 3–5)
              </span>
              <InputNumber
                min={0}
                max={99}
                size="small"
                value={daily.applications}
                onChange={(val) => updateDaily({ applications: Number(val) || 0 })}
                style={{ width: 60 }}
              />
            </div>
            <div className="pt-1">
              <Checkbox
                checked={daily.mock_interview}
                onChange={(e) => updateDaily({ mock_interview: e.target.checked })}
              >
                <span className="text-xs text-zinc-700">Mock interview completed this week</span>
              </Checkbox>
            </div>
          </div>
        </Card>

        <Card size="small" className="bg-zinc-900 text-white border-zinc-900 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
            Signal Engine
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed m-0">
            Score targets 3+ on: expansion news, hiring velocity, platform language, leadership hires, and future captive tech domains.
          </p>
        </Card>
      </div>

      {/* Discovered GCC Roles */}
      <Card
        size="small"
        className="border-zinc-200 shadow-xs overflow-hidden"
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900">Discovered GCC Roles</span>
              <Tag color="blue" className="font-mono text-[10px]">
                {pipelineGccJobs.length}
              </Tag>
            </div>
            {onOpenPipeline && pipelineGccJobs.length > 0 && (
              <Button size="small" onClick={onOpenPipeline}>
                Open Job Pipeline
              </Button>
            )}
          </div>
        }
      >
        {pipelineGccJobs.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            No GCC captive roles detected in pipeline yet. Run{' '}
            <code className="text-zinc-700 bg-zinc-100 px-1 py-0.5 rounded">gcc-scan --deep</code> in
            Terminal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="py-2.5 px-3 text-left">Company</th>
                  <th className="py-2.5 px-3 text-left">Role</th>
                  <th className="py-2.5 px-3 text-left">Signal</th>
                  <th className="py-2.5 px-3 text-left">Score</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {pipelineGccJobs.map((job, i) => (
                  <tr key={job.pipeline_id ?? i} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <JobAvatar company={job.company} size="sm" />
                        <span className="font-bold text-zinc-900">{job.company}</span>
                        {job.gcc_high_value && (
                          <Tag color="purple" className="text-[9px] font-bold">
                            High
                          </Tag>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600 font-medium max-w-[200px] truncate">
                      {job.title}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-600">
                      {job.gcc_signal_score ?? '—'}/5
                    </td>
                    <td className="py-2.5 px-3">
                      <AiScoreBadge score={job.score} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Space size="small">
                        {onAddToOutreach && (
                          <Button
                            size="small"
                            onClick={() =>
                              onAddToOutreach(String(job.company || ''), String(job.title || ''))
                            }
                          >
                            Track
                          </Button>
                        )}
                        {onResearchDraft && (
                          <Button
                            size="small"
                            onClick={() =>
                              onResearchDraft({
                                jobId: job.pipeline_id,
                                company: String(job.company || ''),
                                role: String(job.title || ''),
                                url: job.url,
                              })
                            }
                          >
                            Draft
                          </Button>
                        )}
                        {onTailorJob && job.pipeline_id != null && (
                          <Button
                            type="primary"
                            size="small"
                            icon={<ThunderboltOutlined />}
                            onClick={() => onTailorJob(Number(job.pipeline_id))}
                          >
                            Tailor
                          </Button>
                        )}
                      </Space>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Outreach Tracker Table */}
      <Card
        size="small"
        className="border-zinc-200 shadow-xs"
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AimOutlined className="text-zinc-900" />
              <span className="text-xs font-bold text-zinc-900">Outreach Tracker</span>
            </div>
            <Button size="small" icon={<PlusOutlined />} onClick={addTarget}>
              Add Company
            </Button>
          </div>
        }
      >
        {campaign.targets.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400">
            Outreach tracker is empty. Import roles from Discovered GCC roles above or add companies manually.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                <tr>
                  <th className="py-2.5 px-3 text-left">Company</th>
                  <th className="py-2.5 px-3 text-left">Role</th>
                  <th className="py-2.5 px-2 text-center">Connected</th>
                  <th className="py-2.5 px-2 text-center">DM Sent</th>
                  <th className="py-2.5 px-2 text-center">Email Sent</th>
                  <th className="py-2.5 px-3 text-left">PAR Story</th>
                  <th className="py-2.5 px-2 text-center">Interview</th>
                  <th className="py-2.5 px-3 text-left">Follow-up</th>
                  <th className="py-2.5 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {campaign.targets.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50">
                    <td className="py-2 px-3">
                      <Input
                        size="small"
                        value={t.company}
                        onChange={(e) => updateTarget(t.id, { company: e.target.value })}
                        placeholder="e.g. Acme Corp"
                        className="w-28 text-xs font-semibold"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        size="small"
                        value={t.role}
                        onChange={(e) => updateTarget(t.id, { role: e.target.value })}
                        placeholder="Role"
                        className="w-28 text-xs"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Checkbox
                        checked={t.connection_sent}
                        onChange={(e) => updateTarget(t.id, { connection_sent: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Checkbox
                        checked={t.dm_sent}
                        onChange={(e) => updateTarget(t.id, { dm_sent: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Checkbox
                        checked={t.email_sent}
                        onChange={(e) => updateTarget(t.id, { email_sent: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        size="small"
                        value={t.story_used}
                        onChange={(e) => updateTarget(t.id, { story_used: e.target.value })}
                        placeholder="PAR story used"
                        className="w-32 text-xs"
                      />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <Checkbox
                        checked={t.interview}
                        onChange={(e) => updateTarget(t.id, { interview: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <Input
                        size="small"
                        value={t.follow_up}
                        onChange={(e) => updateTarget(t.id, { follow_up: e.target.value })}
                        placeholder="Next follow-up"
                        className="w-28 text-xs"
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      <Space size="small">
                        {onResearchDraft && (
                          <Button
                            size="small"
                            onClick={() => onResearchDraft({ company: t.company, role: t.role })}
                          >
                            Draft
                          </Button>
                        )}
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeTarget(t.id)}
                        />
                      </Space>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
