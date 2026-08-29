'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tabs, Button, Tag, Badge, Tooltip, Space, Input } from 'antd';
import {
  CodeOutlined,
  PlusOutlined,
  CloseOutlined,
  ClearOutlined,
  SyncOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';

export type TerminalLog = {
  type: 'stdout' | 'stderr' | 'done' | 'clear';
  content?: string;
  code?: number;
};

export type TerminalSession = {
  id: string;
  name: string;
  logs: TerminalLog[];
  isExecuting: boolean;
  cmdInput: string;
  history: string[];
  historyIndex: number;
  eventSource?: EventSource | null;
  awaitingPostingConfirm?: boolean;
  staleTailorTarget?: string | null;
};

type MultiTerminalPanelProps = {
  terminalPrompt: string;
  onToast: (msg: string) => void;
  externalCommand?: { command: string; id: number } | null;
};

const INITIAL_WELCOME = `   _____                           ____            
  / ___/___ _________  ___  _____ / __ \\____  _____
 / /__ / __ \`/ ___/ _ \\/ _ \\/ ___// / / / __ \\/ ___/
/ /___/ /_/ / /  /  __/  __/ /   / /_/ / /_/ (__  ) 
\\____/\\__,_/_/   \\___/\\___/_/    \\____/ .___/____/  
                                     /_/            
Career-Ops Parallel Terminal Engine (Multi-Session Enabled)`;

export function MultiTerminalPanel({
  terminalPrompt,
  onToast,
  externalCommand,
}: MultiTerminalPanelProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([
    {
      id: 'term-1',
      name: 'Terminal 1',
      logs: [],
      isExecuting: false,
      cmdInput: '',
      history: [],
      historyIndex: -1,
    },
  ]);
  const [activeKey, setActiveKey] = useState('term-1');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const eventSourcesRef = useRef<Record<string, EventSource>>({});

  // Auto-scroll when logs update
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [sessions, activeKey]);

  // Focus input when tab changes
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [activeKey]);

  // Cleanup all EventSources on unmount
  useEffect(() => {
    return () => {
      Object.values(eventSourcesRef.current).forEach((es) => es.close());
    };
  }, []);

  const activeSession = sessions.find((s) => s.id === activeKey) || sessions[0];

  const updateSession = useCallback((id: string, updater: (s: TerminalSession) => TerminalSession) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }, []);

  const appendLog = useCallback((id: string, log: TerminalLog) => {
    updateSession(id, (s) => ({
      ...s,
      logs: [...s.logs, log],
    }));
  }, [updateSession]);

  const killExecution = useCallback((sessionId: string) => {
    if (eventSourcesRef.current[sessionId]) {
      eventSourcesRef.current[sessionId].close();
      delete eventSourcesRef.current[sessionId];
    }
    updateSession(sessionId, (s) => ({
      ...s,
      isExecuting: false,
      awaitingPostingConfirm: false,
      staleTailorTarget: null,
      logs: [...s.logs, { type: 'stderr', content: '\n^C (Execution aborted by user)\n' }],
    }));
  }, [updateSession]);

  const runCommandOnSession = useCallback(
    (sessionId: string, query: string) => {
      // Close previous connection on this session if any
      if (eventSourcesRef.current[sessionId]) {
        eventSourcesRef.current[sessionId].close();
      }

      updateSession(sessionId, (s) => ({
        ...s,
        isExecuting: true,
        logs: [...s.logs, { type: 'stdout', content: `\n${terminalPrompt} ${query}\n` }],
      }));

      const es = new EventSource(`/api/exec?q=${encodeURIComponent(query)}`);
      eventSourcesRef.current[sessionId] = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'done') {
            updateSession(sessionId, (s) => ({ ...s, isExecuting: false }));
            es.close();
            delete eventSourcesRef.current[sessionId];
          } else if (data.type === 'clear') {
            updateSession(sessionId, (s) => ({ ...s, logs: [] }));
          } else {
            const content = String(data.content || '');
            if (data.type === 'stderr' && /GITHUB_PAT not configured/i.test(content)) {
              onToast('Add a GitHub PAT in Settings (workflow scope) to run cloud actions.');
            }
            appendLog(sessionId, data);
          }
        } catch {
          appendLog(sessionId, { type: 'stdout', content: event.data });
        }
      };

      es.onerror = () => {
        appendLog(sessionId, { type: 'stderr', content: '\n[ERROR] Connection lost or command failed.\n' });
        updateSession(sessionId, (s) => ({ ...s, isExecuting: false }));
        es.close();
        delete eventSourcesRef.current[sessionId];
      };
    },
    [appendLog, onToast, terminalPrompt, updateSession]
  );

  // Handle external command triggers
  const lastExternalIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (externalCommand && externalCommand.id !== lastExternalIdRef.current) {
      lastExternalIdRef.current = externalCommand.id;
      let targetId = activeKey;
      const cur = sessions.find((s) => s.id === activeKey);
      if (cur?.isExecuting) {
        const idle = sessions.find((s) => !s.isExecuting);
        if (idle) {
          targetId = idle.id;
        } else if (sessions.length < 6) {
          const newId = `term-${Date.now()}`;
          const newNum = sessions.length + 1;
          const newSession: TerminalSession = {
            id: newId,
            name: `Terminal ${newNum}`,
            logs: [],
            isExecuting: false,
            cmdInput: '',
            history: [],
            historyIndex: -1,
          };
          setSessions((prev) => [...prev, newSession]);
          targetId = newId;
        }
      }
      setActiveKey(targetId);
      runCommandOnSession(targetId, externalCommand.command);
    }
  }, [externalCommand, activeKey, sessions, runCommandOnSession]);

  const addSession = () => {
    if (sessions.length >= 6) {
      onToast('Maximum 6 concurrent terminal sessions allowed.');
      return;
    }
    const newId = `term-${Date.now()}`;
    const newNum = sessions.length + 1;
    const newSession: TerminalSession = {
      id: newId,
      name: `Terminal ${newNum}`,
      logs: [],
      isExecuting: false,
      cmdInput: '',
      history: [],
      historyIndex: -1,
    };
    setSessions((prev) => [...prev, newSession]);
    setActiveKey(newId);
  };

  const removeSession = (targetId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (sessions.length === 1) {
      // Clear logs of only remaining session
      updateSession(targetId, (s) => ({ ...s, logs: [] }));
      return;
    }
    killExecution(targetId);
    const remaining = sessions.filter((s) => s.id !== targetId);
    setSessions(remaining);
    if (activeKey === targetId) {
      setActiveKey(remaining[remaining.length - 1].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    const q = activeSession.cmdInput.trim();
    if (!q) return;

    // Handle Yes/No posting confirm gate
    if (activeSession.awaitingPostingConfirm && activeSession.staleTailorTarget) {
      updateSession(activeKey, (s) => ({
        ...s,
        history: [q, ...s.history].slice(0, 50),
        historyIndex: -1,
        cmdInput: '',
        logs: [...s.logs, { type: 'stdout', content: `Continue with resume generation? [Yes/No]: ${q}\n` }],
      }));

      if (/^(y|yes)$/i.test(q)) {
        const target = activeSession.staleTailorTarget;
        updateSession(activeKey, (s) => ({ ...s, awaitingPostingConfirm: false, staleTailorTarget: null }));
        runCommandOnSession(activeKey, `tailor ${target} --deep --yes`);
        return;
      }
      if (/^(n|no)$/i.test(q)) {
        updateSession(activeKey, (s) => ({
          ...s,
          awaitingPostingConfirm: false,
          staleTailorTarget: null,
          logs: [...s.logs, { type: 'stdout', content: 'no\n[INFO] Cancelled — no resume generated.\n' }],
        }));
        return;
      }
      appendLog(activeKey, {
        type: 'stdout',
        content: `[WARN] Please answer Yes or No (got "${q}").\nContinue with resume generation? [Yes/No]:\n`,
      });
      return;
    }

    if (activeSession.isExecuting) return;

    updateSession(activeKey, (s) => ({
      ...s,
      history: [q, ...s.history].slice(0, 50),
      historyIndex: -1,
      cmdInput: '',
    }));

    // Check if tailor command needs posting check
    const tailorMatch = q.match(/^tailor\s+(.+)$/i);
    if (tailorMatch) {
      const rest = tailorMatch[1].trim();
      const yes = /\s--yes\b|\s-y\b|\s--confirm-stale\b/i.test(rest);
      const target = rest
        .replace(/\s+--deep\b/gi, '')
        .replace(/\s+--yes\b/gi, '')
        .replace(/\s+-y\b/gi, '')
        .replace(/\s+--confirm-stale\b/gi, '')
        .trim();

      if (!target) {
        appendLog(activeKey, { type: 'stderr', content: 'Usage: tailor <job_id|url> --deep\n' });
        return;
      }

      if (yes) {
        runCommandOnSession(activeKey, `tailor ${target} --deep --yes`);
        return;
      }

      // Check posting age gate
      appendLog(activeKey, {
        type: 'stdout',
        content: `\n${terminalPrompt} ${q}\n[CHECK] Running job posting age verification…\n`,
      });

      try {
        const isUrl = /^https?:\/\//i.test(target);
        const id = Number.parseInt(target, 10);
        const res = await fetch(
          isUrl ? `/api/job/posting-check?url=${encodeURIComponent(target)}` : `/api/job/${id}?refresh=1`
        );
        if (res.ok) {
          const job = await res.json();
          const gateMessage = String(job?.posting_gate_message || '').trim();
          if (gateMessage) {
            appendLog(activeKey, { type: 'stdout', content: `\n${gateMessage}\n` });
          }
          if (job?.posting_analysis?.needs_confirm) {
            updateSession(activeKey, (s) => ({
              ...s,
              awaitingPostingConfirm: true,
              staleTailorTarget: target,
              logs: [
                ...s.logs,
                {
                  type: 'stdout',
                  content:
                    '\nContinue with resume generation? [Yes/No]:\n(Type yes or no, then Enter — Ctrl+C to cancel)\n',
                },
              ],
            }));
            return;
          }
        }
      } catch {
        /* proceed */
      }

      runCommandOnSession(activeKey, `tailor ${target} --deep`);
      return;
    }

    runCommandOnSession(activeKey, q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      killExecution(activeKey);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!activeSession.history.length) return;
      const nextIdx = Math.min(activeSession.historyIndex + 1, activeSession.history.length - 1);
      updateSession(activeKey, (s) => ({
        ...s,
        historyIndex: nextIdx,
        cmdInput: s.history[nextIdx] || '',
      }));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeSession.historyIndex <= 0) {
        updateSession(activeKey, (s) => ({ ...s, historyIndex: -1, cmdInput: '' }));
        return;
      }
      const nextIdx = activeSession.historyIndex - 1;
      updateSession(activeKey, (s) => ({
        ...s,
        historyIndex: nextIdx,
        cmdInput: s.history[nextIdx] || '',
      }));
    }
  };

  const runningCount = sessions.filter((s) => s.isExecuting).length;

  return (
    <div className="space-y-4">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-zinc-900">Interactive Execution Engine</span>
            {runningCount > 0 && (
              <Tag color="processing" icon={<SyncOutlined spin />} className="font-mono text-xs">
                {runningCount} Active Job{runningCount > 1 ? 's' : ''}
              </Tag>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Parallel terminal runners for job scraping, ranking, tailoring, and auto-apply workflows.
          </p>
        </div>

        {/* Quick Command Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={addSession}
            disabled={sessions.length >= 6}
            className="text-xs font-mono bg-emerald-600 hover:bg-emerald-500 border-emerald-600"
          >
            + New Tab
          </Button>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => runCommandOnSession(activeKey, 'scan --deep')}
            disabled={activeSession?.isExecuting}
            className="text-xs font-mono"
          >
            scan
          </Button>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => runCommandOnSession(activeKey, 'gcc-scan --deep')}
            disabled={activeSession?.isExecuting}
            className="text-xs font-mono"
          >
            gcc-scan
          </Button>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => runCommandOnSession(activeKey, 'rank --deep')}
            disabled={activeSession?.isExecuting}
            className="text-xs font-mono"
          >
            rank
          </Button>
          <Button
            size="small"
            icon={<ClearOutlined />}
            onClick={() => updateSession(activeKey, (s) => ({ ...s, logs: [] }))}
            className="text-xs font-mono"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Terminal Shell Window */}
      <div className="rounded-2xl border border-zinc-300 bg-zinc-950 shadow-xl overflow-hidden flex flex-col h-[600px]">
        {/* Terminal Tab Bar */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {sessions.map((sess) => {
              const isActive = sess.id === activeKey;
              return (
                <div
                  key={sess.id}
                  onClick={() => setActiveKey(sess.id)}
                  className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-all select-none ${
                    isActive
                      ? 'bg-zinc-800 text-white font-bold border border-zinc-700 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                  }`}
                >
                  {sess.isExecuting ? (
                    <SyncOutlined spin className="text-emerald-400 text-[10px]" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  )}
                  <span>{sess.name}</span>
                  {sessions.length > 1 && (
                    <CloseOutlined
                      className="text-[9px] hover:text-rose-400 transition-colors ml-0.5"
                      onClick={(e) => removeSession(sess.id, e)}
                    />
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addSession}
              disabled={sessions.length >= 6}
              title="Open a new parallel terminal session (up to 6)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PlusOutlined className="text-[10px]" />
              <span>New Tab</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500 shrink-0">
            <span>{sessions.length}/6 parallel sessions</span>
          </div>
        </div>

        {/* Terminal Output Area */}
        <div
          ref={logContainerRef}
          className="flex-1 p-4 font-mono text-xs overflow-y-auto whitespace-pre-wrap bg-zinc-950 text-zinc-100 selection:bg-emerald-800 selection:text-white leading-relaxed select-text"
        >
          {activeSession.logs.length === 0 && !activeSession.isExecuting ? (
            <div className="space-y-4 text-zinc-400">
              <pre className="font-mono text-[10px] sm:text-xs text-zinc-300 font-bold leading-tight select-none">
                {INITIAL_WELCOME}
              </pre>
              <div className="space-y-1.5 text-zinc-400 border-t border-zinc-800 pt-3">
                <p>
                  <strong className="text-emerald-400">1. gcc-scan --deep</strong> → Discover GCC & captive employer jobs (India hubs)
                </p>
                <p>
                  <strong className="text-emerald-400">2. scan --deep</strong> → Broad job-board discovery (LinkedIn, Indeed, etc.)
                </p>
                <p>
                  <strong className="text-emerald-400">3. rank --deep</strong> → Score and rank discovered roles against your profile
                </p>
                <p>
                  <strong className="text-emerald-400">4. tailor &lt;id&gt; --deep</strong> → Generate customized ATS resume & cover letter
                </p>
                <p>
                  <strong className="text-emerald-400">5. apply &lt;id&gt; --deep</strong> → Automatically apply to tracked role
                </p>
                <p>
                  <strong className="text-emerald-400">6. add &lt;url&gt;</strong> → Scrape and ingest job URL into pipeline
                </p>
                <p>
                  <strong className="text-emerald-400">help</strong> → Print command reference
                </p>
                <p className="text-zinc-400 pt-1 border-t border-zinc-900">
                  ⚡ <strong className="text-emerald-400">Parallel Execution:</strong> Click <span className="text-emerald-300 font-bold bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-700">[+ New Tab]</span> to run up to 6 concurrent sessions in parallel.
                </p>
              </div>
              <div className="text-[11px] text-zinc-600 font-mono">
                Press Enter to run · Ctrl+C to abort running task · Multi-sessions run in parallel
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {activeSession.logs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.type === 'stderr'
                      ? 'text-rose-400 font-semibold'
                      : log.type === 'done'
                      ? 'text-emerald-400 font-bold'
                      : 'text-zinc-200'
                  }
                >
                  {log.content}
                </div>
              ))}
              {activeSession.isExecuting && (
                <div className="flex items-center gap-2 text-emerald-400 mt-2">
                  <SyncOutlined spin />
                  <span className="text-[11px]">Executing command...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Terminal Input Bar */}
        <div className="p-3 bg-zinc-900 border-t border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span
              className={`font-bold font-mono text-xs shrink-0 select-none ${
                activeSession.awaitingPostingConfirm ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {activeSession.awaitingPostingConfirm
                ? 'Continue with resume generation? [Yes/No]:'
                : terminalPrompt}
            </span>
            <form onSubmit={handleSubmit} className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={activeSession.cmdInput}
                onChange={(e) =>
                  updateSession(activeKey, (s) => ({ ...s, cmdInput: e.target.value }))
                }
                onKeyDown={handleKeyDown}
                placeholder={
                  activeSession.awaitingPostingConfirm
                    ? 'yes or no'
                    : 'scan / rank / tailor <id> / help (Ctrl+C to abort)'
                }
                disabled={activeSession.isExecuting}
                className="w-full bg-transparent outline-none border-none text-zinc-100 font-mono text-xs placeholder:text-zinc-600 caret-emerald-400"
                autoFocus
              />
            </form>
            {activeSession.isExecuting && (
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => killExecution(activeKey)}
                className="text-xs font-mono"
              >
                Abort
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
