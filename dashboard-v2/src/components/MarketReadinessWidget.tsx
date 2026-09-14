'use client';

import { useState } from 'react';
import { Card, Tag, Button, Progress, Modal, Tooltip } from 'antd';
import {
  TrophyOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  ArrowRightOutlined,
  ThunderboltFilled,
  SafetyCertificateFilled,
  RightOutlined,
  FileDoneOutlined,
  AudioOutlined,
  SearchOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import type { ReadinessReport, ReadinessChecklistItem } from '@/lib/readiness/readiness-calculator';

type Props = {
  readiness?: ReadinessReport | null;
  onNavigateTab: (tab: string) => void;
  onOpenDossier?: () => void;
};

export function MarketReadinessWidget({ readiness, onNavigateTab, onOpenDossier }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!readiness) return null;

  const getTierColor = (tier: ReadinessReport['tier']) => {
    switch (tier) {
      case 'Elite (Top 5%)':
        return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', ant: 'green' };
      case 'Market Ready':
        return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', ant: 'blue' };
      case 'Competitive':
        return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', ant: 'orange' };
      default:
        return { bg: 'bg-zinc-800', text: 'text-zinc-400', border: 'border-zinc-700', ant: 'default' };
    }
  };

  const colors = getTierColor(readiness.tier);
  const pendingItems = readiness.checklist.filter((i) => !i.completed);
  const completedCount = readiness.checklist.filter((i) => i.completed).length;

  const handleActionClick = (item: ReadinessChecklistItem) => {
    if (item.tab === 'dossier' && onOpenDossier) {
      onOpenDossier();
    } else {
      onNavigateTab(item.tab);
    }
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'resume-studio':
        return <FileDoneOutlined />;
      case 'practice':
        return <AudioOutlined />;
      case 'pipeline':
        return <SearchOutlined />;
      case 'dossier':
        return <GlobalOutlined />;
      default:
        return <ArrowRightOutlined />;
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition-all hover:border-zinc-300">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs">
              <TrophyOutlined className="text-amber-400 text-base" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-zinc-900 m-0">Market Readiness Score</h3>
                <Tag color={colors.ant} className="text-[10px] font-mono font-bold uppercase m-0">
                  {readiness.tier}
                </Tag>
              </div>
              <p className="text-xs text-zinc-500 m-0">
                {completedCount}/{readiness.checklist.length} signals calibrated · {readiness.summary}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <div className="text-2xl font-mono font-black text-zinc-900 leading-none">
                {readiness.score}<span className="text-xs text-zinc-400 font-normal">/100</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Candidate Rank</span>
            </div>
            <Button
              size="small"
              onClick={() => setModalOpen(true)}
              className="text-xs font-medium cursor-pointer"
            >
              Details
            </Button>
          </div>
        </div>

        {/* 3 Pillar Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3.5 pb-2">
          {/* Pillar 1 */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700">Resume & ATS</span>
              <span className="font-mono text-[11px] font-bold text-zinc-900">
                {readiness.pillars.resume.score}/{readiness.pillars.resume.maxScore}
              </span>
            </div>
            <Progress
              percent={readiness.pillars.resume.percentage}
              size="small"
              strokeColor="#10B981"
              showInfo={false}
            />
          </div>

          {/* Pillar 2 */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700">Interview & STAR</span>
              <span className="font-mono text-[11px] font-bold text-zinc-900">
                {readiness.pillars.interview.score}/{readiness.pillars.interview.maxScore}
              </span>
            </div>
            <Progress
              percent={readiness.pillars.interview.percentage}
              size="small"
              strokeColor="#3B82F6"
              showInfo={false}
            />
          </div>

          {/* Pillar 3 */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-700">Pipeline Cadence</span>
              <span className="font-mono text-[11px] font-bold text-zinc-900">
                {readiness.pillars.pipeline.score}/{readiness.pillars.pipeline.maxScore}
              </span>
            </div>
            <Progress
              percent={readiness.pillars.pipeline.percentage}
              size="small"
              strokeColor="#8B5CF6"
              showInfo={false}
            />
          </div>
        </div>

        {/* Top Pending Actions (Max 2 displayed inline) */}
        {pendingItems.length > 0 && (
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-amber-50/60 border border-amber-200/60 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs text-amber-900">
              <ThunderboltFilled className="text-amber-600 text-sm" />
              <span>
                <strong>Next high-impact boost:</strong> {pendingItems[0].title}
              </span>
              <Tag color="orange" className="text-[10px] font-mono font-bold m-0">
                +{pendingItems[0].impactPts} pts
              </Tag>
            </div>

            <Button
              size="small"
              type="primary"
              className="bg-amber-600 hover:bg-amber-500 text-xs font-semibold shrink-0"
              onClick={() => handleActionClick(pendingItems[0])}
            >
              Take Action
            </Button>
          </div>
        )}
      </div>

      {/* Comprehensive Checklist Modal */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={620}
        title={
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
            <SafetyCertificateFilled className="text-emerald-600" />
            <span>Market Readiness Breakdown</span>
            <Tag color={colors.ant} className="text-[10px] font-mono uppercase font-bold">
              {readiness.score}/100
            </Tag>
          </div>
        }
        centered
      >
        <div className="pt-2 pb-2 space-y-4">
          <p className="text-xs text-zinc-600 leading-relaxed">
            The Market Readiness Score audits your profile against Tier-1 tech hiring standards. Complete the actionable items below to maximize interview callbacks and offer conversion.
          </p>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {readiness.checklist.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors ${
                  item.completed
                    ? 'border-emerald-100 bg-emerald-50/40'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="pt-0.5">
                    {item.completed ? (
                      <CheckCircleFilled className="text-emerald-600 text-sm" />
                    ) : (
                      <ClockCircleOutlined className="text-zinc-400 text-sm" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${
                          item.completed ? 'text-emerald-950 line-through opacity-80' : 'text-zinc-900'
                        }`}
                      >
                        {item.title}
                      </span>
                      <Tag
                        color={item.completed ? 'default' : 'orange'}
                        className="text-[9px] font-mono uppercase font-semibold m-0"
                      >
                        +{item.impactPts} pts
                      </Tag>
                    </div>
                    <p className="text-[11px] text-zinc-500 m-0 pt-0.5 leading-normal">
                      {item.tip}
                    </p>
                  </div>
                </div>

                {!item.completed && (
                  <Button
                    size="small"
                    icon={getTabIcon(item.tab)}
                    onClick={() => {
                      setModalOpen(false);
                      handleActionClick(item);
                    }}
                    className="shrink-0 text-xs font-medium"
                  >
                    Open
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
