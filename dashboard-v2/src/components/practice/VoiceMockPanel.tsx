'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Card,
  Button,
  Tag,
  Segmented,
  Select,
  Input,
  Progress,
  Tooltip,
  Alert,
  Divider,
} from 'antd';
import {
  AudioOutlined,
  SoundOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  StopOutlined,
  InfoCircleOutlined,
  TrophyOutlined,
  FireOutlined,
} from '@ant-design/icons';
import {
  Mic,
  Bot,
  User,
  Volume2,
  Sparkles,
  Layers,
  ShieldCheck,
  Terminal,
  UserCheck,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useVoiceInterview,
  type VoiceInterviewConfig,
  type InterviewStatus,
} from './useVoiceInterview';

interface PipelineJobOption {
  id?: string | number;
  company?: string;
  title?: string;
  role?: string;
}

interface Props {
  pipeline?: PipelineJobOption[];
  onBackToPacks?: () => void;
}

export default function VoiceMockPanel({ pipeline = [], onBackToPacks }: Props) {
  const [company, setCompany] = useState('Stripe');
  const [role, setRole] = useState('Senior Full Stack Engineer');
  const [roundType, setRoundType] = useState<'behavioral' | 'system-design' | 'technical' | 'hiring-manager'>('behavioral');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [handsFreeMode, setHandsFreeMode] = useState(false);
  const [isHandsFreeActive, setIsHandsFreeActive] = useState(false);
  const [isHoldingMic, setIsHoldingMic] = useState(false);
  const [history, setHistory] = useState<Array<{
    id: string;
    company: string;
    role: string;
    roundType: string;
    difficulty: string;
    score: number;
    verdict: string;
    date: string;
  }>>([]);

  // Load past mock history
  useEffect(() => {
    try {
      const saved = localStorage.getItem('career_ops_voice_sessions');
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  const interviewConfig = useMemo<VoiceInterviewConfig>(
    () => ({
      company: company.trim() || 'Target Company',
      role: role.trim() || 'Software Engineer',
      roundType,
      difficulty,
      durationMinutes,
    }),
    [company, role, roundType, difficulty, durationMinutes],
  );

  const {
    status,
    transcript,
    interimText,
    timeRemaining,
    scorecard,
    error,
    speechSupported,
    voices,
    selectedVoice,
    setSelectedVoice,
    audioLevel,
    startInterview,
    startListening,
    stopListeningAndSend,
    evaluateInterview,
    reset,
  } = useVoiceInterview(interviewConfig);

  // Auto-scroll transcript on new message
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  // Save completed session to local history
  useEffect(() => {
    if (scorecard && status === 'completed') {
      const newEntry = {
        id: `sess-${Date.now()}`,
        company: interviewConfig.company,
        role: interviewConfig.role,
        roundType: interviewConfig.roundType,
        difficulty: interviewConfig.difficulty,
        score: scorecard.score,
        verdict: scorecard.verdict,
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      };
      setHistory((prev) => {
        const next = [newEntry, ...prev.filter((p) => p.id !== newEntry.id)].slice(0, 10);
        try {
          localStorage.setItem('career_ops_voice_sessions', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [scorecard, status, interviewConfig]);

  // Spacebar hold-to-talk listener
  useEffect(() => {
    if (status !== 'listening' && status !== 'speaking') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsHoldingMic(true);
        startListening();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsHoldingMic(false);
        stopListeningAndSend();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [status, startListening, stopListeningAndSend]);

  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleMicPressStart = () => {
    setIsHoldingMic(true);
    startListening();
  };

  const handleMicPressEnd = () => {
    setIsHoldingMic(false);
    stopListeningAndSend();
  };

  const handleHandsFreeToggle = () => {
    if (isHandsFreeActive) {
      setIsHandsFreeActive(false);
      stopListeningAndSend();
    } else {
      setIsHandsFreeActive(true);
      startListening();
    }
  };

  // Export full transcript as markdown
  const handleExportMarkdown = () => {
    const lines = [
      `# Voice Mock Interview: ${interviewConfig.role} at ${interviewConfig.company}`,
      `**Date:** ${new Date().toLocaleDateString()}`,
      `**Round:** ${interviewConfig.roundType} | **Difficulty:** ${interviewConfig.difficulty}`,
      '',
    ];

    if (scorecard) {
      lines.push(
        `## Evaluation Scorecard: ${scorecard.score}/10 (${scorecard.verdict})`,
        '',
        `> ${scorecard.summary}`,
        '',
        '### Category Breakdown',
        `- Clarity & Communication: ${scorecard.categoryScores.clarity}/10`,
        `- Technical Depth: ${scorecard.categoryScores.technicalDepth}/10`,
        `- STAR Structure: ${scorecard.categoryScores.starStructure}/10`,
        `- Role Alignment: ${scorecard.categoryScores.roleAlignment}/10`,
        '',
        '### Key Strengths',
        ...scorecard.strengths.map((s) => `- ${s}`),
        '',
        '### Areas for Improvement',
        ...scorecard.weaknesses.map((w) => `- ${w}`),
        '',
        '### Next Steps',
        ...scorecard.nextSteps.map((n) => `- ${n}`),
        '',
      );
    }

    lines.push('## Full Transcript', '');
    transcript.forEach((m) => {
      lines.push(`**${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}** (${m.timestamp}):`);
      lines.push(m.text, '');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-interview-${interviewConfig.company.toLowerCase()}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Last interviewer message for main speech display
  const lastInterviewerMsg = [...transcript].reverse().find((m) => m.role === 'interviewer');

  return (
    <div className="space-y-4">
      {!speechSupported && (
        <Alert
          type="warning"
          showIcon
          message="Browser Speech Recognition Notice"
          description="Your current browser does not have the native Web Speech API enabled. Google Chrome, Edge, and Safari 14.1+ are recommended for voice interviews."
          className="mb-4"
        />
      )}

      {error && (
        <Alert
          type="error"
          showIcon
          closable
          message={error}
          className="mb-4"
        />
      )}

      {/* VIEW 1: SETUP SCREEN */}
      {status === 'idle' && (
        <Card
          size="small"
          className="border-zinc-200 shadow-sm"
          title={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-900 text-white">
                  <Mic size={13} strokeWidth={2.2} />
                </span>
                <span className="text-sm font-bold text-zinc-900">Voice Mock Interview Simulator</span>
              </div>
              <Tag color="purple" className="font-bold text-[10px] uppercase">
                Real-Time Voice AI
              </Tag>
            </div>
          }
        >
          <div className="max-w-2xl mx-auto py-2 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900">
                Practice Live Behavioral & Technical Screens
              </h2>
              <p className="text-xs text-zinc-500 max-w-lg mx-auto">
                Realistic voice interview simulation with real-time AI response, hold-to-talk speech recognition, and instant Bar-Raiser scorecard feedback.
              </p>
            </div>

            {/* Quick Scenario Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  <Zap size={13} className="text-amber-500" />
                  1-Click Practice Scenarios
                </span>
                <span className="text-[10px] text-zinc-400">Click to autofill setup</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    title: 'Amazon Bar-Raiser',
                    desc: 'STAR & Pressure',
                    company: 'Amazon',
                    role: 'Senior Software Engineer',
                    round: 'behavioral',
                    diff: 'hard',
                    dur: 10,
                    icon: <ShieldCheck size={15} className="text-amber-600" />,
                  },
                  {
                    title: 'Stripe Sys Design',
                    desc: 'Ledger Architecture',
                    company: 'Stripe',
                    role: 'Staff Infrastructure Engineer',
                    round: 'system-design',
                    diff: 'hard',
                    dur: 15,
                    icon: <Layers size={15} className="text-blue-600" />,
                  },
                  {
                    title: 'Tech Live Screen',
                    desc: 'CS Core & Tradeoffs',
                    company: 'Google',
                    role: 'Full Stack Engineer',
                    round: 'technical',
                    diff: 'medium',
                    dur: 10,
                    icon: <Terminal size={15} className="text-emerald-600" />,
                  },
                  {
                    title: 'Hiring Manager',
                    desc: 'Culture & Direction',
                    company: 'Linear',
                    role: 'Product Engineer',
                    round: 'hiring-manager',
                    diff: 'easy',
                    dur: 5,
                    icon: <UserCheck size={15} className="text-purple-600" />,
                  },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCompany(preset.company);
                      setRole(preset.role);
                      setRoundType(preset.round as any);
                      setDifficulty(preset.diff as any);
                      setDurationMinutes(preset.dur);
                    }}
                    className="p-2.5 rounded-xl border border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100/80 hover:border-zinc-300 text-left transition-all card-hover-lift cursor-pointer group"
                  >
                    <div className="h-7 w-7 rounded-lg bg-white border border-zinc-200/80 flex items-center justify-center mb-1.5 shadow-2xs group-hover:border-zinc-300">
                      {preset.icon}
                    </div>
                    <div className="text-[11px] font-bold text-zinc-900 truncate group-hover:text-zinc-950">
                      {preset.title}
                    </div>
                    <div className="text-[9.5px] text-zinc-500 truncate">
                      {preset.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Target Company</label>
                <Input
                  placeholder="e.g. Stripe, Google, Anthropic"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Role / Position</label>
                <Input
                  placeholder="e.g. Senior Full Stack Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
            </div>

            {/* Quick Fill from Pipeline */}
            {pipeline.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase">Or Autofill from Your Pipeline</span>
                </div>
                <Select
                  className="w-full"
                  placeholder="Select one of your applied jobs…"
                  allowClear
                  onChange={(val) => {
                    const found = pipeline.find((p) => String(p.id) === String(val));
                    if (found) {
                      if (found.company) setCompany(found.company);
                      if (found.title || found.role) setRole(found.title || found.role || '');
                    }
                  }}
                  options={pipeline.map((p) => ({
                    label: `${p.company} — ${p.title || p.role}`,
                    value: String(p.id),
                  }))}
                />
              </div>
            )}

            {/* Interview Round Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-700">Interview Round Type</label>
              <Segmented
                block
                value={roundType}
                onChange={(val) => setRoundType(val as any)}
                options={[
                  { label: 'Behavioral (STAR)', value: 'behavioral' },
                  { label: 'System Design', value: 'system-design' },
                  { label: 'Technical Screen', value: 'technical' },
                  { label: 'Hiring Manager', value: 'hiring-manager' },
                ]}
              />
            </div>

            {/* Difficulty & Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700">Difficulty Level</label>
                <Segmented
                  block
                  value={difficulty}
                  onChange={(val) => setDifficulty(val as any)}
                  options={[
                    { label: 'Easy', value: 'easy' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Hard (Bar-Raiser)', value: 'hard' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700">Session Duration</label>
                <Segmented
                  block
                  value={durationMinutes}
                  onChange={(val) => setDurationMinutes(Number(val))}
                  options={[
                    { label: '5 min (Blitz)', value: 5 },
                    { label: '10 min (Standard)', value: 10 },
                    { label: '15 min (Deep)', value: 15 },
                  ]}
                />
              </div>
            </div>

            {/* AI Voice Selection */}
            {voices.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700">Interviewer Voice (Free Browser TTS)</label>
                  <Button
                    size="small"
                    type="text"
                    icon={<SoundOutlined />}
                    onClick={() => {
                      if (!window.speechSynthesis) return;
                      window.speechSynthesis.cancel();
                      const u = new SpeechSynthesisUtterance("Hello! I'm your interviewer today. Let's begin whenever you're ready.");
                      if (selectedVoice) u.voice = selectedVoice;
                      window.speechSynthesis.speak(u);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-900"
                  >
                    Test Voice
                  </Button>
                </div>
                <Select
                  className="w-full"
                  value={selectedVoice?.name}
                  onChange={(name) => {
                    const v = voices.find((vox) => vox.name === name);
                    if (v) setSelectedVoice(v);
                  }}
                  options={voices.map((v) => ({
                    label: `${v.name} (${v.lang})`,
                    value: v.name,
                  }))}
                />
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              {onBackToPacks && (
                <Button onClick={onBackToPacks}>
                  Back to IDE
                </Button>
              )}
              <Button
                type="primary"
                size="large"
                block
                icon={<AudioOutlined />}
                onClick={() => void startInterview()}
                className="bg-zinc-900 hover:bg-zinc-800 font-semibold"
              >
                Start Voice Interview ({durationMinutes} min)
              </Button>
            </div>

            {/* Mock Interview Track Record */}
            {history.length > 0 && (
              <div className="pt-4 border-t border-zinc-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                    <TrophyOutlined className="text-amber-500" />
                    <span>Your Mock Track Record ({history.length} completed)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        localStorage.removeItem('career_ops_voice_sessions');
                        setHistory([]);
                      } catch {}
                    }}
                    className="text-[10px] text-zinc-400 hover:text-zinc-600 underline cursor-pointer"
                  >
                    Clear History
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl border border-zinc-200/80 bg-white flex items-center justify-between text-xs hover:border-zinc-300 transition-colors shadow-2xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-zinc-900 truncate">{item.company}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{item.role} · {item.date}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Tag color="purple" className="text-[10px] font-mono m-0 font-bold">
                          {item.score}/10
                        </Tag>
                        <Tag color={item.verdict.toLowerCase().includes('hire') ? 'success' : 'default'} className="text-[9px] m-0">
                          {item.verdict}
                        </Tag>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* VIEW 2: ACTIVE LIVE INTERVIEW */}
      {(status === 'greeting' || status === 'listening' || status === 'speaking' || status === 'thinking') && (
        <div className="space-y-4">
          {/* Header Bar */}
          <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-zinc-200 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-zinc-900 flex items-center justify-center text-white text-base font-bold shadow-xs">
                {company.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900">{company} Interview</span>
                  <Tag color={difficulty === 'hard' ? 'error' : difficulty === 'medium' ? 'blue' : 'green'} className="text-[10px] m-0 font-medium uppercase">
                    {difficulty}
                  </Tag>
                  <Tag color="default" className="text-[10px] m-0 font-medium capitalize">
                    {roundType.replace('-', ' ')}
                  </Tag>
                </div>
                <div className="text-xs text-zinc-500">{role}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Timer Badge */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold ${
                  timeRemaining < 60
                    ? 'border-red-200 bg-red-50 text-red-600 animate-pulse'
                    : timeRemaining < 180
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700'
                }`}
              >
                <ClockCircleOutlined />
                <span>{formatTime(timeRemaining)}</span>
              </div>

              <Button
                danger
                size="small"
                icon={<StopOutlined />}
                onClick={() => void evaluateInterview()}
              >
                End & Score
              </Button>
            </div>
          </div>

          {/* Interviewer Center Stage */}
          <Card size="small" className="border-zinc-200 bg-gradient-to-b from-zinc-50/50 to-white shadow-xs">
            <div className="py-6 flex flex-col items-center text-center space-y-4">
              {/* Interviewer Avatar with Pulse */}
              <div className="relative">
                <div
                  className={`h-20 w-20 rounded-full flex items-center justify-center transition-all ${
                    status === 'speaking'
                      ? 'bg-zinc-900 text-white ring-8 ring-zinc-200'
                      : status === 'thinking'
                      ? 'bg-purple-900 text-white ring-8 ring-purple-100 animate-pulse'
                      : 'bg-zinc-800 text-white'
                  }`}
                >
                  {status === 'speaking' ? (
                    <Volume2 size={32} className="text-white" />
                  ) : status === 'thinking' ? (
                    <Sparkles size={30} className="text-purple-200 animate-spin" style={{ animationDuration: '3s' }} />
                  ) : (
                    <Bot size={32} className="text-white" />
                  )}
                </div>

                {/* Sound wave rings when speaking */}
                {status === 'speaking' && (
                  <span className="absolute inset-0 rounded-full border-2 border-zinc-400 animate-ping opacity-30" />
                )}
              </div>

              {/* Status Pill */}
              <div>
                <Tag
                  color={
                    status === 'speaking'
                      ? 'default'
                      : status === 'thinking'
                      ? 'purple'
                      : isHoldingMic || isHandsFreeActive
                      ? 'error'
                      : 'processing'
                  }
                  className="font-semibold text-xs py-0.5 px-3 rounded-full"
                >
                  {status === 'speaking' && 'Interviewer is speaking…'}
                  {status === 'thinking' && 'AI is formulating follow-up…'}
                  {status === 'listening' && (isHoldingMic || isHandsFreeActive ? 'Recording your answer…' : 'Ready — hold mic or Space to speak')}
                </Tag>
              </div>

              {/* Spoken Dialogue Text */}
              <div className="max-w-xl px-4 min-h-[64px] flex items-center justify-center">
                <p className="text-base sm:text-lg font-medium text-zinc-900 leading-relaxed italic">
                  &ldquo;{lastInterviewerMsg ? lastInterviewerMsg.text : 'Welcome! Let us begin…'}&rdquo;
                </p>
              </div>

              {/* Waveform Visualizer */}
              <div className="flex items-center justify-center gap-1.5 h-8">
                {[...Array(16)].map((_, i) => {
                  const active = status === 'speaking' || isHoldingMic || isHandsFreeActive;
                  const randomHeight = active ? Math.max(8, (audioLevel || 20) * (0.3 + (i % 5) * 0.15)) : 4;
                  return (
                    <motion.div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        isHoldingMic || isHandsFreeActive
                          ? 'bg-red-500'
                          : status === 'speaking'
                          ? 'bg-zinc-800'
                          : 'bg-zinc-200'
                      }`}
                      animate={{ height: `${randomHeight}px` }}
                    />
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Action Stage: Hold to Talk */}
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-3">
            <div className="flex items-center gap-4">
              {/* Main Hold-to-Talk Button */}
              <button
                type="button"
                onMouseDown={handleMicPressStart}
                onMouseUp={handleMicPressEnd}
                onTouchStart={handleMicPressStart}
                onTouchEnd={handleMicPressEnd}
                disabled={status === 'thinking'}
                className={`group relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-md transition-all select-none cursor-pointer ${
                  isHoldingMic || isHandsFreeActive
                    ? 'bg-red-600 scale-105 ring-8 ring-red-100'
                    : 'bg-zinc-900 hover:bg-zinc-800 active:scale-95'
                }`}
              >
                <AudioOutlined className={`text-2xl ${(isHoldingMic || isHandsFreeActive) ? 'animate-pulse' : ''}`} />
                {(isHoldingMic || isHandsFreeActive) && (
                  <>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                    </span>
                    <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-30 pointer-events-none" />
                    <span className="absolute -inset-2 rounded-full border border-red-400 animate-pulse opacity-40 pointer-events-none" />
                  </>
                )}
              </button>
            </div>

            <div className="text-center space-y-1">
              <div className="text-xs font-bold text-zinc-900">
                {isHoldingMic ? 'Release to Send Answer' : 'Hold to Speak (or press Space)'}
              </div>
              <p className="text-[11px] text-zinc-400">
                Speak clearly into your microphone. Keep answers punchy and structured.
              </p>
            </div>

            {/* Hands-Free Toggle Alternative */}
            <div className="pt-1 flex items-center gap-2">
              <Button
                size="small"
                type={isHandsFreeActive ? 'primary' : 'default'}
                danger={isHandsFreeActive}
                onClick={handleHandsFreeToggle}
                className="text-xs"
              >
                {isHandsFreeActive ? 'Stop Hands-Free Recording' : 'Toggle Hands-Free Mode'}
              </Button>
            </div>

            {/* Live Interim Transcript Bubble */}
            {interimText && (
              <div className="w-full max-w-lg mt-2 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 animate-fadeInUp">
                <span className="font-semibold text-zinc-500">Transcribing: </span>
                <span>{interimText}</span>
              </div>
            )}
          </div>

          {/* Live Transcript Drawer/Log */}
          <Card
            size="small"
            className="border-zinc-200 shadow-xs"
            title={
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">Interview Transcript</span>
                <span className="text-[10px] text-zinc-400 font-mono">{transcript.length} turns</span>
              </div>
            }
          >
            <div
              ref={transcriptScrollRef}
              className="max-h-56 overflow-y-auto space-y-2.5 pr-1 text-xs"
            >
              {transcript.length === 0 ? (
                <div className="text-center py-6 text-zinc-400">
                  Waiting for interview to begin…
                </div>
              ) : (
                transcript.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-2.5 rounded-xl border ${
                      msg.role === 'interviewer'
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-900 mr-8'
                        : 'bg-blue-50/60 border-blue-100 text-blue-950 ml-8'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-bold text-[11px]">
                        {msg.role === 'interviewer' ? (
                          <>
                            <Bot size={13} className="text-zinc-500" />
                            <span>{company} Interviewer</span>
                          </>
                        ) : (
                          <>
                            <User size={13} className="text-blue-600" />
                            <span>You</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">{msg.timestamp}</span>
                    </div>
                    <p className="leading-relaxed m-0">{msg.text}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* VIEW 3: SCORECARD / EVALUATION */}
      {status === 'completed' && (
        <div className="space-y-5 animate-fadeInUp">
          {scorecard ? (
            <Card
              size="small"
              className="border-zinc-200 shadow-sm"
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrophyOutlined className="text-amber-500" />
                    <span className="text-sm font-bold text-zinc-900">
                      Interview Performance Scorecard
                    </span>
                  </div>
                  <Tag color="success" className="font-bold text-xs">
                    {scorecard.verdict}
                  </Tag>
                </div>
              }
            >
              <div className="space-y-6 py-2">
                {/* Score Hero */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center h-16 w-16 rounded-2xl bg-zinc-900 text-white">
                      <span className="text-2xl font-bold leading-none">{scorecard.score}</span>
                      <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">/ 10</span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-zinc-900">
                        {scorecard.verdict} for {role}
                      </h3>
                      <p className="text-xs text-zinc-500 max-w-md mt-0.5 leading-relaxed">
                        {scorecard.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="default"
                      icon={<DownloadOutlined />}
                      onClick={handleExportMarkdown}
                    >
                      Export Notes (.md)
                    </Button>
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={reset}
                      className="bg-zinc-900 hover:bg-zinc-800"
                    >
                      New Interview
                    </Button>
                  </div>
                </div>

                {/* Category Progress Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-zinc-100 bg-white">
                    <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                      <span>Clarity & Communication</span>
                      <span>{scorecard.categoryScores.clarity}/10</span>
                    </div>
                    <Progress
                      percent={scorecard.categoryScores.clarity * 10}
                      showInfo={false}
                      strokeColor="#18181B"
                      size="small"
                    />
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-100 bg-white">
                    <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                      <span>Technical Depth</span>
                      <span>{scorecard.categoryScores.technicalDepth}/10</span>
                    </div>
                    <Progress
                      percent={scorecard.categoryScores.technicalDepth * 10}
                      showInfo={false}
                      strokeColor="#3B82F6"
                      size="small"
                    />
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-100 bg-white">
                    <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                      <span>STAR Framework</span>
                      <span>{scorecard.categoryScores.starStructure}/10</span>
                    </div>
                    <Progress
                      percent={scorecard.categoryScores.starStructure * 10}
                      showInfo={false}
                      strokeColor="#10B981"
                      size="small"
                    />
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-100 bg-white">
                    <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                      <span>Role Alignment</span>
                      <span>{scorecard.categoryScores.roleAlignment}/10</span>
                    </div>
                    <Progress
                      percent={scorecard.categoryScores.roleAlignment * 10}
                      showInfo={false}
                      strokeColor="#8B5CF6"
                      size="small"
                    />
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Strengths */}
                  <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                      <CheckCircleOutlined />
                      <span>Key Strengths Observed</span>
                    </div>
                    <ul className="space-y-1 text-xs text-zinc-700 pl-4 list-disc">
                      {scorecard.strengths.map((s, idx) => (
                        <li key={idx} className="leading-relaxed">{s}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Areas to Polish */}
                  <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/40 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 uppercase tracking-wide">
                      <CloseCircleOutlined />
                      <span>Areas to Polish</span>
                    </div>
                    <ul className="space-y-1 text-xs text-zinc-700 pl-4 list-disc">
                      {scorecard.weaknesses.map((w, idx) => (
                        <li key={idx} className="leading-relaxed">{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Actionable Next Steps */}
                {scorecard.nextSteps && scorecard.nextSteps.length > 0 && (
                  <div className="p-3.5 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase tracking-wide">
                      <FireOutlined />
                      <span>Recommended Practice Drills Before On-Site</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-800">
                      {scorecard.nextSteps.map((step, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-white border border-blue-100/80 flex items-start gap-2">
                          <span className="font-mono font-bold text-blue-600">0{idx + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcript Review in Scorecard */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-900">Session Transcript Log</span>
                  <div className="max-h-60 overflow-y-auto space-y-2 p-3 rounded-xl border border-zinc-200 bg-zinc-50/60 text-xs">
                    {transcript.map((m) => (
                      <div key={m.id} className="leading-relaxed">
                        <span className="font-bold text-zinc-900">
                          {m.role === 'interviewer' ? 'Interviewer' : 'You'}:{' '}
                        </span>
                        <span className="text-zinc-700">{m.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card size="small" className="border-zinc-200 text-center py-10">
              <div className="text-sm font-semibold text-zinc-700 mb-2">
                Evaluation completed.
              </div>
              <Button type="primary" onClick={reset}>
                Start New Session
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
