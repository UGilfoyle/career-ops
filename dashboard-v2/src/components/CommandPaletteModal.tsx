'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  Briefcase,
  Sparkles,
  Terminal as TerminalIcon,
  MessageSquare,
  GraduationCap,
  Settings,
  Target,
  Play,
  ArrowRight,
  Zap,
  Files,
  X,
} from 'lucide-react';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  onRunCommand: (cmd: string) => void;
  pipelineJobs?: Array<{ id?: number | string; pipeline_id?: number | string; company?: string; title?: string; score?: number | string }>;
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
  const inputRef = useRef<HTMLInputElement>(null);

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
        else onClose(); // Or open from parent
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: <LayoutDashboard size={16} />, category: 'Navigation', shortcut: 'G D' },
    { id: 'pipeline', label: 'Job Pipeline Studio', icon: <Search size={16} />, category: 'Navigation', shortcut: 'G P' },
    { id: 'resume-studio', label: 'Resume Studio (15 ATS Templates)', icon: <Sparkles size={16} />, category: 'Navigation', shortcut: 'G R' },
    { id: 'practice', label: 'Interview Practice IDE', icon: <GraduationCap size={16} />, category: 'Navigation', shortcut: 'G I' },
    { id: 'gcc', label: 'GCC Campaign Radar', icon: <Target size={16} />, category: 'Navigation', shortcut: 'G G' },
    { id: 'terminal', label: 'Command Terminal', icon: <TerminalIcon size={16} />, category: 'Navigation', shortcut: 'G T' },
    { id: 'chat', label: 'Career Copilot AI', icon: <MessageSquare size={16} />, category: 'Navigation', shortcut: 'G C' },
    { id: 'apps', label: 'Application Tracker', icon: <Briefcase size={16} />, category: 'Navigation', shortcut: 'G A' },
    { id: 'generated-docs', label: 'Generated Docs & Exports', icon: <Files size={16} />, category: 'Navigation', shortcut: 'G E' },
    { id: 'settings', label: 'Settings & Targeting Keywords', icon: <Settings size={16} />, category: 'Navigation', shortcut: 'G S' },
  ];

  const actionItems = [
    { id: 'cmd-scan', label: 'Run Job Scan (scan --deep)', icon: <Play size={16} className="text-blue-600" />, category: 'Action', cmd: 'scan --deep' },
    { id: 'cmd-gcc', label: 'Run GCC Captives Scan (gcc-scan --deep)', icon: <Zap size={16} className="text-amber-600" />, category: 'Action', cmd: 'gcc-scan --deep' },
    { id: 'cmd-rank', label: 'Auto-Score & Rank Pipeline (rank)', icon: <Play size={16} className="text-emerald-600" />, category: 'Action', cmd: 'rank' },
  ];

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchingNav = navItems.filter((i) => !q || i.label.toLowerCase().includes(q));
    const matchingActions = actionItems.filter((i) => !q || i.label.toLowerCase().includes(q));

    // Matching pipeline jobs if user types 2+ characters
    const matchingJobs = q.length >= 2
      ? pipelineJobs
          .filter((j) => (j.company || '').toLowerCase().includes(q) || (j.title || '').toLowerCase().includes(q))
          .slice(0, 5)
          .map((j) => ({
            id: `job-${j.pipeline_id || j.id}`,
            label: `${j.company || 'Company'} — ${j.title || 'Role'} (Score: ${j.score || '—'})`,
            icon: <Briefcase size={16} className="text-emerald-600" />,
            category: 'Pipeline Job',
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 sm:pt-28 p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#1C1C1E]/40 backdrop-blur-md transition-opacity"
        />

        {/* Command Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-xl bg-white rounded-3xl border border-[#E5E5E0] shadow-2xl overflow-hidden z-10 flex flex-col max-h-[75vh]"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F0F0EB] bg-[#FAFAF8]">
            <Search size={18} className="text-[#9CA3AF] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a command, search jobs, or jump to view..."
              className="w-full bg-transparent outline-none border-none text-[#1C1C1E] text-sm font-medium placeholder:text-[#9CA3AF]"
            />
            <button
              onClick={onClose}
              className="p-1 text-[#9CA3AF] hover:text-[#1C1C1E] rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-2 divide-y divide-[#F5F5F0]">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-[#9CA3AF] text-sm font-medium">
                No matching actions or jobs found.
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1C1C1E] text-white shadow-sm'
                          : 'text-[#1C1C1E] hover:bg-[#F5F5F0]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`shrink-0 ${isSelected ? 'text-white' : 'text-[#6B6B6B]'}`}>
                          {item.icon}
                        </span>
                        <span className="font-semibold truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {item.category && (
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-[#F0F0EB] text-[#6B6B6B]'
                            }`}
                          >
                            {item.category}
                          </span>
                        )}
                        {isSelected && <ArrowRight size={12} className="text-white shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Shortcuts */}
          <div className="px-5 py-3 border-t border-[#F0F0EB] bg-[#FAFAF8] flex items-center justify-between text-[11px] text-[#9CA3AF]">
            <div className="flex items-center gap-3">
              <span><kbd className="px-1.5 py-0.5 bg-white border border-[#E5E5E0] rounded text-[10px] font-mono shadow-2xs">↑</kbd> <kbd className="px-1.5 py-0.5 bg-white border border-[#E5E5E0] rounded text-[10px] font-mono shadow-2xs">↓</kbd> to navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-white border border-[#E5E5E0] rounded text-[10px] font-mono shadow-2xs">↵</kbd> to select</span>
            </div>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-[#E5E5E0] rounded text-[10px] font-mono shadow-2xs">Esc</kbd> to close</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
