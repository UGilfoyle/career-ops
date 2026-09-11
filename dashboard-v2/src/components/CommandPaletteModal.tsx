'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Input, Tag, Badge } from 'antd';
import {
  SearchOutlined,
  DashboardOutlined,
  CompassOutlined,
  FileDoneOutlined,
  ReadOutlined,
  AimOutlined,
  CodeOutlined,
  MessageOutlined,
  AppstoreOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  PlayCircleOutlined,
  ArrowRightOutlined,
  RocketOutlined,
} from '@ant-design/icons';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  onRunCommand: (cmd: string) => void;
  pipelineJobs?: Array<{
    id?: number | string;
    pipeline_id?: number | string;
    company?: string;
    title?: string;
    score?: number | string;
  }>;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  onNavigateTab,
  onRunCommand,
  pipelineJobs = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<any>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keyboard shortcut: ⌘K or Ctrl+K to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: <DashboardOutlined />, category: 'Navigation', shortcut: 'G D' },
    { id: 'pipeline', label: 'Job Pipeline Studio', icon: <CompassOutlined />, category: 'Navigation', shortcut: 'G P' },
    { id: 'resume-studio', label: 'Resume Studio (15 ATS Templates)', icon: <FileDoneOutlined />, category: 'Navigation', shortcut: 'G R' },
    { id: 'practice', label: 'Interview Practice IDE', icon: <ReadOutlined />, category: 'Navigation', shortcut: 'G I' },
    { id: 'gcc-campaign', label: 'GCC Campaign Radar', icon: <AimOutlined />, category: 'Navigation', shortcut: 'G G' },
    { id: 'terminal', label: 'Command Terminal', icon: <CodeOutlined />, category: 'Navigation', shortcut: 'G T' },
    { id: 'chat', label: 'Career Copilot AI', icon: <MessageOutlined />, category: 'Navigation', shortcut: 'G C' },
    { id: 'applications', label: 'Application Tracker', icon: <AppstoreOutlined />, category: 'Navigation', shortcut: 'G A' },
    { id: 'generated-docs', label: 'Generated Docs & Exports', icon: <FolderOpenOutlined />, category: 'Navigation', shortcut: 'G E' },
    { id: 'settings', label: 'Settings & Targeting Keywords', icon: <SettingOutlined />, category: 'Navigation', shortcut: 'G S' },
  ];

  const actionItems = [
    { id: 'cmd-scan', label: 'Run Job Scan (scan --deep)', icon: <PlayCircleOutlined className="text-blue-500" />, category: 'Action', cmd: 'scan --deep' },
    { id: 'cmd-gcc', label: 'Run GCC Captives Scan (gcc-scan --deep)', icon: <ThunderboltOutlined className="text-amber-500" />, category: 'Action', cmd: 'gcc-scan --deep' },
    { id: 'cmd-rank', label: 'Auto-Score & Rank Pipeline (rank)', icon: <RocketOutlined className="text-emerald-500" />, category: 'Action', cmd: 'rank' },
  ];

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchingNav = navItems.filter((i) => !q || i.label.toLowerCase().includes(q));
    const matchingActions = actionItems.filter((i) => !q || i.label.toLowerCase().includes(q));

    const matchingJobs =
      q.length >= 2
        ? pipelineJobs
            .filter((j) => (j.company || '').toLowerCase().includes(q) || (j.title || '').toLowerCase().includes(q))
            .slice(0, 6)
            .map((j) => ({
              id: `job-${j.pipeline_id || j.id}`,
              label: `${j.company || 'Company'} — ${j.title || 'Role'}`,
              icon: <CompassOutlined className="text-emerald-600" />,
              category: 'Pipeline Job',
              score: j.score,
              jobId: j.pipeline_id || j.id,
            }))
        : [];

    return [...matchingActions, ...matchingNav, ...matchingJobs];
  }, [query, pipelineJobs]);

  const handleSelect = (item: any) => {
    if (item.category === 'Navigation') {
      onNavigateTab(item.id);
    } else if (item.category === 'Action' && item.cmd) {
      onRunCommand(item.cmd);
    } else if (item.category === 'Pipeline Job' && item.jobId) {
      onNavigateTab('pipeline');
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      closable={false}
      centered
      width={620}
      destroyOnClose
      styles={{
        body: {
          padding: 0,
        },
      }}
    >
      <div className="flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-zinc-100 bg-zinc-50/70">
          <Input
            ref={inputRef}
            size="large"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, search jobs, or jump to view..."
            prefix={<SearchOutlined className="text-zinc-400 mr-2 text-base" />}
            variant="borderless"
            className="text-sm font-medium"
            allowClear
          />
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-zinc-50">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-sm font-medium">
              No matching actions or jobs found.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item: any, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                        : 'text-zinc-800 bg-transparent border-transparent hover:bg-zinc-100/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`shrink-0 text-sm ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                        {item.icon}
                      </span>
                      <span className="font-semibold truncate">{item.label}</span>
                      {item.score && (
                        <Tag color={isSelected ? 'default' : 'success'} className="ml-1 text-[10px] font-bold">
                          Score {item.score}
                        </Tag>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.category && (
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {item.category}
                        </span>
                      )}
                      {isSelected && <ArrowRightOutlined className="text-white text-xs shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Shortcuts */}
        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-[10px] font-mono shadow-2xs text-zinc-700">↑</kbd>{' '}
              <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-[10px] font-mono shadow-2xs text-zinc-700">↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-[10px] font-mono shadow-2xs text-zinc-700">↵</kbd> select
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-[10px] font-mono shadow-2xs text-zinc-700">Esc</kbd> close
          </span>
        </div>
      </div>
    </Modal>
  );
}
