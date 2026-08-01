'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { 
  MessageSquare,
  Send,
  Bot,
  BarChart3, 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  FileText, 
  LayoutDashboard, 
  Play, 
  Search, 
  Settings, 
  Terminal as TerminalIcon,
  LogOut,
  Shield,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  Upload,
  ExternalLink,
  Trash2,
  AlertTriangle,
  MoreVertical,
  Eye,
  Globe,
  TrendingUp,
  BookOpen,
  Copy,
  HelpCircle,
  Code,
  Columns,
  List,
  AlertCircle,
  Sparkles,
  Files,
  Filter,
  ArrowUpDown,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut, useSession } from 'next-auth/react';
import { PageSectionHeader, AiScoreBadge, CompanyAvatar } from './PageSectionHeader';
import ResumeStudio from './resume-studio/ResumeStudio';
import GeneratedDocsPanel from './GeneratedDocsPanel';
import { GccCampaignPanel, defaultGccCampaign, type GccCampaign } from './GccCampaignPanel';
import {
  STALE_POSTING_DAYS,
  ANCIENT_POSTING_DAYS,
  daysSincePosted,
  type JobPostingAnalysis,
} from '@/lib/job-posting-date';

/** Hide legacy Resume Manager nav once Generated Docs is the primary library UI. */
const SHOW_RESUME_MANAGER_NAV = false;

function formatRelativeTime(dateStr?: string | null) {
  if (!dateStr) return '—';
  const then = new Date(dateStr).getTime();
  if (!Number.isFinite(then)) return '—';
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days < 0) return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusChipClass(status?: string | null) {
  const s = String(status || '').toUpperCase();
  if (['APPLIED', 'RESPONDED', 'SENT'].includes(s)) return 'bg-sky-50 text-sky-700 border-sky-200';
  if (['INTERVIEW', 'ENTREVISTA', 'INTERVIEWING'].includes(s)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['OFFER', 'OFERTA'].includes(s)) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (['REJECTED', 'DISCARDED', 'SKIP', 'RECHAZADO', 'DESCARTADO'].includes(s)) return 'bg-stone-100 text-stone-600 border-stone-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export default function Dashboard({ initialData }: { initialData?: any }) {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.email === 'admin@career-ops.local';
  const [data, setData] = useState<any>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appsViewMode, setAppsViewMode] = useState<'kanban' | 'table'>('kanban');
  const [appsSortBy, setAppsSortBy] = useState<'score' | 'date'>('score');
  const [appsStageFocus, setAppsStageFocus] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [cmdInput, setCmdInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [profileFormData, setProfileFormData] = useState<any>({
    candidate: { full_name: '', location: '', email: '', phone: '', linkedin: '', github: '' },
    narrative: { headline: '', exit_story: '', superpowers: [] },
    experience: [],
    education: [],
    targeting_keywords: { positive: [], negative: [] },
    search: { portals: ['linkedin', 'naukri', 'indeed', 'instahyre', 'flexiple', 'greenhouse', 'lever', 'japan-dev'] },
    github_settings: { pat: '', repo: 'UGilfoyle/career-ops' }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [walkthroughStep, setWalkthroughStep] = useState<number | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<{ top: number, left: number, width: number, height: number } | null>(null);
  const [accountInfo, setAccountInfo] = useState({ email: '', password: '', confirmPassword: '' });
  const [tagInputPositive, setTagInputPositive] = useState('');
  const [tagInputNegative, setTagInputNegative] = useState('');
  const [tagInputPortals, setTagInputPortals] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [resumeImportStatus, setResumeImportStatus] = useState<'idle' | 'uploading' | 'ready' | 'error'>('idle');
  const [resumeImport, setResumeImport] = useState<any>(null);
  // Merge is the safer default — Replace can wipe roles the PDF parser misses.
  const [resumeImportMode, setResumeImportMode] = useState<'replace' | 'merge'>('merge');
  const [jobDetailsOpen, setJobDetailsOpen] = useState(false);
  const [jobDetailsLoading, setJobDetailsLoading] = useState(false);
  const [jobDetails, setJobDetails] = useState<any>(null);
  const [jobDetailsError, setJobDetailsError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Visitor analytics state
  const [visitorStats, setVisitorStats] = useState<any>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; company: string; title: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Stale posting confirm before tailor
  const [staleTailorOpen, setStaleTailorOpen] = useState(false);
  const [staleTailorChecking, setStaleTailorChecking] = useState(false);
  const [staleTailorTarget, setStaleTailorTarget] = useState<{
    jobId: number;
    command: string;
    company: string;
    title: string;
    posted_at: string | null;
    ageDays: number | null;
    analysis: JobPostingAnalysis | null;
    gateMessage: string;
  } | null>(null);

  const [clearPipelineOpen, setClearPipelineOpen] = useState(false);
  const [clearPipelineScope, setClearPipelineScope] = useState<'all' | 'visible'>('all');
  const [clearPipelineLoading, setClearPipelineLoading] = useState(false);
  const [gccCampaign, setGccCampaign] = useState<GccCampaign>(defaultGccCampaign);
  const [studioReviewJob, setStudioReviewJob] = useState<{
    jobId: number;
    company?: string;
    title?: string;
    score?: string | number | null;
    ats_content_score?: number | null;
  } | null>(null);
  const [studioInitialJobId, setStudioInitialJobId] = useState<number | null>(null);
  const [betaBannerDismissed, setBetaBannerDismissed] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: "Hello! I am your Career-Ops Copilot. I have analyzed your target keywords and resume profile. Ask me anything, or try one of these suggestions below to get started!"
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const appendTerminalLine = (line: string) => {
    setLogs((prev) => [...prev, { type: 'stdout', content: `\n${line}\n` }]);
  };

  const q = searchQuery.trim().toLowerCase();
  const matches = (value: any) => {
    if (!q) return true;
    return String(value || '').toLowerCase().includes(q);
  };

  const filteredPipeline = (data?.pipeline || []).filter((job: any) =>
    matches(job.company) || matches(job.title) || matches(job.url) || matches(job.source) || matches(job.score)
  );
  const filteredApplications = (data?.applications || []).filter((app: any) =>
    matches(app.company) || matches(app.role) || matches(app.url) || matches(app.status) || matches(app.score)
  );
  const sortedApplications = [...filteredApplications].sort((a: any, b: any) => {
    if (appsSortBy === 'score') {
      return parseFloat(String(b.score || 0)) - parseFloat(String(a.score || 0));
    }
    const dateA = a.applied_at ? new Date(a.applied_at).getTime() : 0;
    const dateB = b.applied_at ? new Date(b.applied_at).getTime() : 0;
    return dateB - dateA;
  });
  const filteredDocs = (data?.pdfs || []).filter((doc: any) =>
    matches(doc.company) || matches(doc.title) || matches(doc.name)
  );

  const pipelineTotal = data?.pipeline?.length ?? 0;
  const pipelineFiltered = filteredPipeline.length;
  const pipelineFilterActive = q.length > 0 && pipelineFiltered < pipelineTotal;

  const pipelineCount = data?.pipeline?.length || 0;
  const appliedCount = data?.stats?.applied || 0;
  const interviewCount = data?.stats?.interviews || 0;
  const offerCount = data?.stats?.offers || 0;
  const maxCount = Math.max(pipelineCount, appliedCount, interviewCount, offerCount, 1);

  const funnelStages = [
    {
      key: 'sourced',
      label: 'Sourced',
      count: pipelineCount,
      height: pipelineCount > 0 ? `${Math.max(12, (pipelineCount / maxCount) * 100)}%` : '6px',
      gradient: 'from-amber-400 to-amber-600',
      textColor: 'text-amber-600',
      tooltipTitle: `${pipelineCount} Sourced Jobs`,
      tooltipDesc: 'Click to open Job Pipeline'
    },
    {
      key: 'applied',
      label: 'Applied',
      count: appliedCount,
      height: appliedCount > 0 ? `${Math.max(12, (appliedCount / maxCount) * 100)}%` : '6px',
      gradient: 'from-stone-500 to-stone-800',
      textColor: 'text-stone-800',
      tooltipTitle: `${appliedCount} Applications`,
      tooltipDesc: 'Click to filter Applications'
    },
    {
      key: 'interviews',
      label: 'Interviews',
      count: interviewCount,
      height: interviewCount > 0 ? `${Math.max(12, (interviewCount / maxCount) * 100)}%` : '6px',
      gradient: 'from-emerald-400 to-emerald-600',
      textColor: 'text-emerald-600',
      tooltipTitle: `${interviewCount} Interviews`,
      tooltipDesc: interviewCount === 0 && appliedCount > 0
        ? 'Move an Applied role forward'
        : 'Click to filter Applications'
    },
    {
      key: 'offers',
      label: 'Offers',
      count: offerCount,
      height: offerCount > 0 ? `${Math.max(12, (offerCount / maxCount) * 100)}%` : '6px',
      gradient: 'from-purple-500 to-purple-700',
      textColor: 'text-purple-600',
      tooltipTitle: `${offerCount} Offers Secured`,
      tooltipDesc: 'Click to filter Applications'
    }
  ];

  const profileDone = Boolean(
    data?.profile?.candidate?.full_name?.trim() || profileFormData.candidate?.full_name?.trim()
  );
  const targetingDone =
    (profileFormData.targeting_keywords?.positive?.length ?? 0) > 0 ||
    (data?.targeting_keywords?.positive?.length ?? 0) > 0;
  const githubDone = Boolean(
    profileFormData.github_settings?.pat?.trim() ||
    data?.resume_context?.github_settings?.pat?.trim()
  );
  const scanDone = pipelineCount > 0;
  const tailorDone = (data?.pdfs?.length ?? 0) > 0;
  const studioDone = Boolean(
    profileFormData?.studio?.template_id ||
      data?.profile?.studio?.template_id ||
      (profileFormData?.experience || []).length > 0 ||
      (data?.profile?.experience || []).length > 0
  );
  const showBetaBanner =
    (process.env.NEXT_PUBLIC_BETA_MODE === '1' || process.env.NEXT_PUBLIC_BETA_MODE === 'true') &&
    !betaBannerDismissed;

  const openInStudio = (job: {
    jobId: number;
    company?: string;
    title?: string;
    score?: string | number | null;
    ats_content_score?: number | null;
  }) => {
    setStudioReviewJob(job);
    setStudioInitialJobId(job.jobId);
    setActiveTab('resume-studio');
  };

  const openFunnelStage = (key: string) => {
    if (key === 'sourced') {
      setAppsStageFocus(null);
      setActiveTab('pipeline');
      return;
    }
    const stageMap: Record<string, string> = {
      applied: 'APPLIED',
      interviews: 'INTERVIEWING',
      offers: 'OFFER',
    };
    setAppsStageFocus(stageMap[key] || null);
    setAppsViewMode('kanban');
    setActiveTab('apps');
  };

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem('career-ops-sidebar-collapsed') === '1');
      setBetaBannerDismissed(localStorage.getItem('career-ops-beta-banner-dismissed') === '1');
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('career-ops-sidebar-collapsed', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    if (!isSearchOpen) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isSearchOpen]);

  const formatCompletionMessage = (meta: any) => {
    const script: string = String(meta?.lastBackgroundActionScript || '');
    const status: string = String(meta?.lastBackgroundStatus || '');
    const label =
      script === 'scratch-scan.mjs'
        ? 'Scan'
        : script === 'rank-pipeline.mjs'
          ? 'Rank'
          : script === 'agentic-tailor.mjs'
            ? 'Tailor'
            : script === 'auto-apply.mjs'
              ? 'Apply'
              : 'Background job';
    const outcome =
      status === 'success'
        ? 'completed'
        : status === 'cancelled'
          ? 'cancelled'
          : 'failed';

    const hint =
      label === 'Tailor' && outcome === 'completed'
        ? ' [FILE] PDF ready in Generated Docs'
        : '';
    return { toast: `[OK] ✔ ${label} ${outcome}${hint}`, terminal: `[OK] ✔ ${label} ${outcome}${hint}` };
  };

  const steps = [
    {
      target: null,
      title: "Welcome to Career Command Center",
      content: "Your AI-powered job search pipeline is ready. This dashboard helps you scan 45+ portals, auto-tailor ATS-optimized resumes, track applications, and prepare for interviews — all from one place. Let's get you set up for success.",
      icon: <Zap size={24}/>
    },
    {
      target: "nav-terminal",
      title: "The Command Terminal",
      content: "Your control center for background jobs. Type 'scan' to crawl job portals, 'rank' to score matches, 'tailor 123 --deep' to generate ATS-optimized resumes, or 'apply 123 --deep' to auto-fill applications. Use '--deep' to run heavy tasks on GitHub Actions (recommended).",
      icon: <TerminalIcon size={24}/>
    },
    {
      target: "nav-settings",
      title: "Build Your Profile",
      content: "The AI needs to know you to represent you well. Upload your resume or manually fill in your Experience, Education, and skills. The more complete your profile, the better your tailored resumes and cover letters will be.",
      icon: <Settings size={24}/>
    },
    {
      target: "config-narrative",
      title: "Your Professional Story",
      content: "This shapes every resume and cover letter. Write a 2-3 sentence headline that captures what you do best (e.g., 'Senior Backend Engineer specializing in distributed systems and 99.99% uptime'). Add 3-5 'superpowers' — specific skills where you excel (e.g., 'Microservices Architecture', 'AWS Cost Optimization', 'Team Leadership').",
      icon: <FileText size={24}/>,
      tab: 'settings'
    },
    {
      target: "config-targeting",
      title: "Smart Job Filtering",
      content: "Define what you're hunting for. Add POSITIVE keywords for roles you want (e.g., 'Senior', 'Backend', 'Remote', 'AWS'). Add NEGATIVE keywords to filter out noise (e.g., 'Frontend', 'Junior', 'PHP'). The AI uses this to score every job 0-10 and surface your best matches.",
      icon: <Search size={24}/>,
      tab: 'settings'
    },
    {
      target: "nav-pipeline",
      title: "Your Job Pipeline",
      content: "Every discovered job lands here with an AI score. High scores (7+) are strong matches — click 'Tailor' to generate a resume/cover letter customized to that specific JD. Your tailored documents are saved and accessible via the 'Generated Docs' section.",
      icon: <BarChart3 size={24}/>
    },
    {
      target: null,
      title: "You're Ready to Hunt",
      content: "Quick start: 1) Complete your profile in Settings, 2) Set targeting keywords, 3) Run 'scan --deep' in the terminal, 4) Review high-scoring jobs in Pipeline, 5) Click 'Tailor' to generate ATS-optimized applications. Good luck!",
      icon: <CheckCircle2 size={24}/>
    }
  ];

  useEffect(() => {
    if (walkthroughStep !== null) {
      const step = steps[walkthroughStep];
      if (step?.tab) setActiveTab(step.tab);
      
      setTimeout(() => {
        if (step?.target) {
          const el = document.getElementById(step.target);
          if (el) {
            const rect = el.getBoundingClientRect();
            setSpotlightRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else {
          setSpotlightRect(null);
        }
      }, step?.tab ? 300 : 0);
    }
  }, [walkthroughStep]);

  // Trigger walkthrough for both email+password and GitHub OAuth users
  useEffect(() => {
    if (status !== 'authenticated') return;

    const search = new URLSearchParams(window.location.search);
    const forceWalkthrough = search.get('walkthrough') === '1';
    if (forceWalkthrough) {
      setTimeout(() => setWalkthroughStep(0), 800);
      search.delete('walkthrough');
      const nextQuery = search.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
      return;
    }

    const userKey = session?.user?.email || session?.user?.id || 'default';
    const onboardingKey = `career_ops_onboarding_v2:${userKey}`;
    const hasSeenOnboarding = localStorage.getItem(onboardingKey);

    if (!hasSeenOnboarding) {
      setTimeout(() => setWalkthroughStep(0), 1200);
    }
  }, [status, session?.user?.email, session?.user?.id]);

  // Track last seen background completion event (so we can show toast even if it completed while user was away)
  useEffect(() => {
    if (status !== 'authenticated') return;
    const userKey = session?.user?.email || session?.user?.id || 'default';
    const key = `career_ops_last_seen_bg_event:${userKey}`;
    try {
      const seen = localStorage.getItem(key);
      if (seen === null) localStorage.setItem(key, '0');
    } catch {
      // ignore storage failures
    }
  }, [status, session?.user?.email, session?.user?.id]);

  const completeOnboarding = () => {
    const userKey = session?.user?.email || session?.user?.id || 'default';
    localStorage.setItem(`career_ops_onboarding_v2:${userKey}`, 'true');
    setWalkthroughStep(null);
  };

  const runCommand = (query: string) => {
    setLogs(prev => [...prev, { type: 'stdout', content: `\ncareer-ops > ${query}\n` }]);
    setIsExecuting(true);
    
    const eventSource = new EventSource(`/api/exec?q=${encodeURIComponent(query)}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'done') {
        setIsExecuting(false);
        eventSource.close();
      } else if (data.type === 'clear') {
        setLogs([]);
      } else {
        const content = String(data.content || '');
        if (data.type === 'stderr' && /GITHUB_PAT not configured/i.test(content)) {
          setToast({
            show: true,
            message: 'Add a GitHub PAT in Settings (workflow scope) to run deep scan/tailor.',
          });
        }
        setLogs(prev => [...prev, data]);
      }
    };

    eventSource.onerror = () => {
      setLogs(prev => [...prev, { type: 'stderr', content: '\n✗ Connection lost or execution failed.' }]);
      setIsExecuting(false);
      eventSource.close();
    };
  };

  /**
   * Gate tailor behind posting-age/history check.
   * Always prints the check into Terminal; Yes/No modal when stale/repost/ancient.
   */
  const requestTailor = async (jobId: number | string, command?: string) => {
    const id = Number.parseInt(String(jobId), 10);
    if (!Number.isFinite(id)) {
      setToast({ show: true, message: 'Invalid job id for tailor.' });
      return;
    }
    const cmd = (command && command.trim()) || `tailor ${id} --deep`;
    if (staleTailorChecking || isExecuting) return;

    setStaleTailorChecking(true);
    setActiveTab('terminal');
    setLogs((prev) => [
      ...prev,
      { type: 'stdout', content: `\ncareer-ops > checking job posting history for #${id}…\n` },
    ]);
    try {
      const res = await fetch(`/api/job/${id}?refresh=1`);
      if (!res.ok) {
        setLogs((prev) => [
          ...prev,
          { type: 'stderr', content: `⚠ Posting check failed (HTTP ${res.status}) — continuing without age gate.\n` },
        ]);
        runCommand(cmd);
        return;
      }
      const job = await res.json();
      const analysis = (job?.posting_analysis || null) as JobPostingAnalysis | null;
      const gateMessage = String(job?.posting_gate_message || '').trim();
      if (gateMessage) {
        setLogs((prev) => [...prev, { type: 'stdout', content: `\n${gateMessage}\n` }]);
      }

      const needsConfirm = Boolean(analysis?.needs_confirm);
      if (needsConfirm) {
        const postedAt = analysis?.posted_at ?? job?.posted_at ?? null;
        setStaleTailorTarget({
          jobId: id,
          command: cmd,
          company: String(job?.company || analysis?.company || 'Unknown company'),
          title: String(job?.title || 'Role'),
          posted_at: postedAt ? String(postedAt) : null,
          ageDays: analysis?.age_days ?? daysSincePosted(postedAt),
          analysis,
          gateMessage,
        });
        setStaleTailorOpen(true);
        return;
      }
      runCommand(cmd);
    } catch {
      setLogs((prev) => [
        ...prev,
        { type: 'stderr', content: '⚠ Posting check errored — continuing without age gate.\n' },
      ]);
      runCommand(cmd);
    } finally {
      setStaleTailorChecking(false);
    }
  };

  const confirmStaleTailor = () => {
    const cmd = staleTailorTarget?.command;
    setStaleTailorOpen(false);
    setStaleTailorTarget(null);
    if (cmd) {
      setActiveTab('terminal');
      setLogs((prev) => [
        ...prev,
        { type: 'stdout', content: '✓ You chose Yes — generating resume & cover letter…\n' },
      ]);
      // --yes skips the non-interactive CI gate after dashboard confirmation
      const withYes = /\s--yes\b/i.test(cmd) ? cmd : `${cmd} --yes`;
      runCommand(withYes);
    }
  };

  const cancelStaleTailor = () => {
    setLogs((prev) => [
      ...prev,
      { type: 'stdout', content: '✗ You chose No — resume generation cancelled.\n' },
    ]);
    setStaleTailorOpen(false);
    setStaleTailorTarget(null);
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdInput.trim() || isExecuting || staleTailorChecking) return;
    
    const q = cmdInput.trim();
    setHistory(prev => [q, ...prev].slice(0, 50));
    setHistoryIndex(-1);

    const tailorMatch = q.match(/^tailor\s+(\d+)\b(.*)$/i);
    if (tailorMatch) {
      const id = tailorMatch[1];
      const rest = (tailorMatch[2] || '').trim();
      const cmd = rest ? `tailor ${id} ${rest}` : `tailor ${id} --deep`;
      setCmdInput('');
      void requestTailor(id, cmd);
      return;
    }

    runCommand(q);
    setCmdInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+C to clear current line (terminal-style)
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      if (cmdInput.trim()) {
        appendTerminalLine(`^C`);
        setCmdInput('');
        setHistoryIndex(-1);
      } else if (isExecuting) {
        appendTerminalLine(`^C`);
        appendTerminalLine(`[ERR] Command execution cannot be interrupted. Please wait for completion.`);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIndex = historyIndex + 1;
      if (nextIndex < history.length) {
        setHistoryIndex(nextIndex);
        setCmdInput(history[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setCmdInput(history[nextIndex]);
      } else {
        setHistoryIndex(-1);
        setCmdInput('');
      }
    }
  };

  useEffect(() => {
    const fetchData = () => {
      fetch('/api/data?t=' + Date.now(), { cache: 'no-store' })
        .then(res => res.json())
        .then(d => {
          setData((prevData: any) => {
            const userKey = session?.user?.email || session?.user?.id || 'default';
            const lastSeenKey = `career_ops_last_seen_bg_event:${userKey}`;

            // Toast even on first load (if webhook completed while user was away)
            try {
              const nextMeta = d?.meta || {};
              const nextEventId = Number(nextMeta.lastBackgroundEventId || 0);
              const lastSeen = Number(localStorage.getItem(lastSeenKey) || 0);
              if (nextEventId > 0 && nextEventId > lastSeen) {
                const msg = formatCompletionMessage(nextMeta);
                setToast({ show: true, message: msg.toast });
                setTimeout(() => setToast({ show: false, message: '' }), 5000);
                appendTerminalLine(msg.terminal);
                localStorage.setItem(lastSeenKey, String(nextEventId));
              }
            } catch {
              // ignore storage failures
            }

            if (prevData) {
              // Reliable background completion signals (GitHub Actions / cron)
              const prevMeta = prevData.meta || {};
              const nextMeta = d.meta || {};
              // Completion toast (even when 0 jobs were added/ranked)
              // Trigger on event id change OR completed_at change (more robust across reloads/localStorage).
              if (
                (nextMeta.lastBackgroundEventId &&
                  nextMeta.lastBackgroundEventId !== prevMeta.lastBackgroundEventId) ||
                (nextMeta.lastBackgroundCompletedAt &&
                  nextMeta.lastBackgroundCompletedAt !== prevMeta.lastBackgroundCompletedAt)
              ) {
                const msg = formatCompletionMessage(nextMeta);
                setToast({ show: true, message: msg.toast });
                setTimeout(() => setToast({ show: false, message: '' }), 5000);
                appendTerminalLine(msg.terminal);
                try {
                  localStorage.setItem(lastSeenKey, String(Number(nextMeta.lastBackgroundEventId || 0)));
                } catch {
                  // ignore
                }
              }
              if (
                typeof prevMeta.jobsTotal === 'number' &&
                typeof nextMeta.jobsTotal === 'number' &&
                nextMeta.jobsTotal > prevMeta.jobsTotal
              ) {
                setToast({ show: true, message: '[OK] ✔ Scan completed — new jobs added' });
                setTimeout(() => setToast({ show: false, message: '' }), 5000);
                appendTerminalLine('[OK] ✔ Scan completed. New jobs added');
              } else if (
                typeof prevMeta.jobsRanked === 'number' &&
                typeof nextMeta.jobsRanked === 'number' &&
                nextMeta.jobsRanked > prevMeta.jobsRanked
              ) {
                setToast({ show: true, message: '[OK] ✔ Rank completed — scores updated' });
                setTimeout(() => setToast({ show: false, message: '' }), 5000);
                appendTerminalLine('[OK] ✔ Rank completed. Scores updated');
              }

              if (prevData.pdfs && d.pdfs && d.pdfs.length > prevData.pdfs.length) {
                setToast({ show: true, message: '[OK] ✔ Tailor completed — resume generated' });
                setTimeout(() => setToast({ show: false, message: '' }), 5000);
                appendTerminalLine('[OK] ✔ Tailor completed. New document generated');
              } else if (prevData.applications && d.applications && d.applications.length > prevData.applications.length) {
                setToast({ show: true, message: '[OK] ✔ Apply completed — application recorded' });
                setTimeout(() => setToast({ show: false, message: '' }), 5000);
                appendTerminalLine('[OK] ✔ Apply completed. Application recorded');
              } else if (prevData.pipeline && d.pipeline) {
                const prevScores = prevData.pipeline.map((j: any) => j.score || 0).join(',');
                const newScores = d.pipeline.map((j: any) => j.score || 0).join(',');
                if (d.pipeline.length > prevData.pipeline.length) {
                setToast({ show: true, message: '[OK] ✔ Scan completed — pipeline updated' });
                setTimeout(() => setToast({ show: false, message: '' }), 5000);
                appendTerminalLine('[OK] ✔ Scan completed. Pipeline updated');
                } else if (prevScores !== newScores) {
                  setToast({ show: true, message: '[OK] ✔ Rank completed — pipeline scores updated' });
                  setTimeout(() => setToast({ show: false, message: '' }), 5000);
                  appendTerminalLine('[OK] ✔ Rank completed. Pipeline scores updated');
                }
              }
            }
            return d;
          });
          setLoading(false);
        });
    };
    if (!initialData) {
      fetchData();
    }
    // Poll every 5 seconds to ensure near-instant updates when GitHub Actions finish
    const interval = setInterval(fetchData, 5000); 
    // Also fetch visitor stats for the stat card
    fetch('/api/view').then(r => r.json()).then(setVisitorStats).catch(() => {});
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'settings' || activeTab === 'gcc' || activeTab === 'resume-studio') {
      fetch('/api/settings')
        .then(res => res.json())
        .then(d => {
          setProfileFormData({
            candidate: d.resume_context?.candidate || { full_name: '', location: '', email: '', linkedin: '', github: '' },
            narrative: d.resume_context?.narrative || { headline: '', exit_story: '', superpowers: [] },
            experience: d.resume_context?.experience || [],
            education: d.resume_context?.education || [],
            targeting_keywords: d.targeting_keywords || { positive: [], negative: [] },
            search: d.resume_context?.search || { portals: ['linkedin', 'naukri', 'indeed', 'instahyre', 'flexiple', 'greenhouse', 'lever', 'japan-dev'] },
            github_settings: d.resume_context?.github_settings || { pat: '', repo: 'UGilfoyle/career-ops' },
            studio: d.resume_context?.studio || { template_id: 'ats-professional' },
          });
          setGccCampaign(d.resume_context?.gcc_campaign || defaultGccCampaign());
          setAccountInfo(prev => ({ ...prev, email: d.email || '' }));
        });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const handleSendChatMessage = async (customText?: string) => {
    const textToSend = (customText || chatInput).trim();
    if (!textToSend || chatLoading) return;

    const newMsgs = [...chatMessages, { role: 'user' as const, content: textToSend }];
    setChatMessages(newMsgs);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const data = await res.json();
      if (data.error) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error: ${data.error}` }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Network error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (accountInfo.password && accountInfo.password !== accountInfo.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_context: {
            candidate: profileFormData.candidate,
            narrative: profileFormData.narrative,
            experience: profileFormData.experience,
            education: profileFormData.education,
            search: profileFormData.search,
            github_settings: profileFormData.github_settings
          },
          targeting_keywords: profileFormData.targeting_keywords,
          email: accountInfo.email,
          password: accountInfo.password || undefined
        })
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const addToGccCampaign = (company: string, role: string) => {
    const exists = gccCampaign.targets.some(
      (t) => t.company.toLowerCase() === company.toLowerCase()
        && (t.role || '').toLowerCase() === (role || '').toLowerCase()
    );
    if (exists) {
      setToast({ show: true, message: `${company} is already in GCC Campaign` });
      setActiveTab('gcc');
      return;
    }
    setGccCampaign({
      ...gccCampaign,
      targets: [
        ...gccCampaign.targets,
        {
          id: `gcc-${Date.now()}`,
          company,
          role: role || '',
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
    setToast({ show: true, message: `Added ${company} to GCC Campaign — click Save Campaign` });
    setActiveTab('gcc');
  };

  const importHighValueGccFromPipeline = () => {
    const highValue = (data?.pipeline || []).filter((j: any) => j.gcc_high_value);
    if (highValue.length === 0) {
      setToast({ show: true, message: 'No high-value GCC jobs in pipeline yet. Run scan + rank first.' });
      return;
    }
    const existing = new Set(
      gccCampaign.targets.map((t) => `${t.company.toLowerCase()}|${(t.role || '').toLowerCase()}`)
    );
    const added = highValue.filter((j: any) => {
      const key = `${String(j.company || '').toLowerCase()}|${String(j.title || '').toLowerCase()}`;
      return !existing.has(key);
    });
    if (added.length === 0) {
      setToast({ show: true, message: 'All high-value GCC jobs are already tracked' });
      setActiveTab('gcc');
      return;
    }
    setGccCampaign({
      ...gccCampaign,
      targets: [
        ...gccCampaign.targets,
        ...added.map((j: any) => ({
          id: `gcc-${j.pipeline_id}-${Date.now()}`,
          company: j.company || '',
          role: j.title || '',
          dm_sent: false,
          email_sent: false,
          connection_sent: false,
          story_used: '',
          interview: false,
          follow_up: '',
          notes: `Signal ${j.gcc_signal_score ?? '?'}/5 · score ${j.score ?? '—'}`,
        })),
      ],
    });
    setToast({ show: true, message: `Imported ${added.length} high-value GCC job(s) — click Save Campaign` });
    setActiveTab('gcc');
  };

  const handleSaveGccCampaign = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_context: {
            candidate: profileFormData.candidate,
            narrative: profileFormData.narrative,
            experience: profileFormData.experience,
            education: profileFormData.education,
            search: profileFormData.search,
            github_settings: profileFormData.github_settings,
            gcc_campaign: gccCampaign,
          },
          targeting_keywords: profileFormData.targeting_keywords,
        }),
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const normalizeExperience = (arr: any[]) =>
    (Array.isArray(arr) ? arr : []).filter(Boolean).map((e) => ({
      company: String(e?.company || '').trim(),
      role: String(e?.role || '').trim(),
      period: String(e?.period || '').trim(),
      location: String(e?.location || '').trim(),
      bullets: Array.isArray(e?.bullets) ? e.bullets.map((b: any) => String(b || '').trim()).filter(Boolean) : [],
    }));

  const normalizeEducation = (arr: any[]) =>
    (Array.isArray(arr) ? arr : []).filter(Boolean).map((e) => ({
      school: String(e?.school || '').trim(),
      degree: String(e?.degree || '').trim(),
      period: String(e?.period || '').trim(),
      location: String(e?.location || '').trim(),
    }));

  const mergeUniqueByKey = (base: any[], incoming: any[], keyFn: (v: any) => string) => {
    const out: any[] = [];
    const seen = new Set<string>();
    const push = (v: any) => {
      const k = keyFn(v);
      if (!k) return;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(v);
    };
    base.forEach(push);
    incoming.forEach(push);
    return out;
  };

  const mergeCandidateFields = (prev: any, incoming: any) => {
    const base = { ...(prev || {}) };
    const next = incoming && typeof incoming === 'object' ? incoming : {};
    for (const key of ['full_name', 'email', 'phone', 'location', 'linkedin', 'github']) {
      const value = typeof next[key] === 'string' ? next[key].trim() : '';
      if (value) base[key] = value;
    }
    return base;
  };

  const applyResumeImportPayload = async (
    payload: any,
    mode: 'replace' | 'merge' = resumeImportMode
  ) => {
    const nextExp = normalizeExperience(payload?.experience || []);
    const nextEdu = normalizeEducation(payload?.education || []);
    const prevExp = normalizeExperience(profileFormData?.experience || []);
    const prevEdu = normalizeEducation(profileFormData?.education || []);
    const nextCandidate = mergeCandidateFields(profileFormData?.candidate, payload?.candidate);

    // Never silently wipe existing experience with an empty/partial Replace parse.
    if (mode === 'replace') {
      if (nextExp.length === 0 && prevExp.length > 0) {
        setToast({
          show: true,
          message: '❌ Replace blocked: parser found 0 roles. Keeping your existing experience. Try Merge or re-upload.',
        });
        setTimeout(() => setToast({ show: false, message: '' }), 6000);
        return false;
      }
      if (prevExp.length > 0 && nextExp.length < prevExp.length) {
        const missingHint = prevExp
          .filter(
            (p: any) =>
              !nextExp.some(
                (n: any) =>
                  String(n.company || '').toLowerCase() === String(p.company || '').toLowerCase()
              )
          )
          .map((p: any) => p.company)
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');
        setToast({
          show: true,
          message: `❌ Replace blocked: resume only parsed ${nextExp.length}/${prevExp.length} roles${
            missingHint ? ` (missing: ${missingHint})` : ''
          }. Switch to Merge to keep existing entries.`,
        });
        setTimeout(() => setToast({ show: false, message: '' }), 8000);
        return false;
      }
    }

    const exp =
      mode === 'replace'
        ? nextExp
        : mergeUniqueByKey(prevExp, nextExp, (e) => `${e.company}::${e.role}::${e.period}`.toLowerCase());
    const education =
      mode === 'replace'
        ? nextEdu
        : mergeUniqueByKey(prevEdu, nextEdu, (e) => `${e.school}::${e.degree}::${e.period}`.toLowerCase());

    setProfileFormData((prev: any) => ({
      ...prev,
      candidate: nextCandidate,
      experience: exp,
      education,
    }));

    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_context: {
            candidate: nextCandidate,
            narrative: profileFormData.narrative,
            experience: exp,
            education: education,
            search: profileFormData.search,
            github_settings: profileFormData.github_settings,
          },
          targeting_keywords: profileFormData.targeting_keywords,
          email: accountInfo.email,
          password: accountInfo.password || undefined,
        }),
      });
      if (res.ok) {
        setSaveStatus('success');
        const nameHint = nextCandidate?.full_name ? ` as ${nextCandidate.full_name}` : '';
        setToast({
          show: true,
          message: `[OK] ✔ Resume ${mode === 'merge' ? 'merged' : 'replaced'} and saved${nameHint} (${exp.length} roles).`,
        });
        setResumeImportStatus('idle');
        setResumeImport(null);
        setTimeout(() => setSaveStatus('idle'), 3000);
        return true;
      }
      setSaveStatus('error');
      setToast({ show: true, message: '❌ Failed to save imported settings' });
      return false;
    } catch {
      setSaveStatus('error');
      setToast({ show: true, message: '❌ Error saving imported settings' });
      return false;
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast({ show: false, message: '' }), 5000);
    }
  };

  const handleResumeImportFile = async (file: File) => {
    setResumeImportStatus('uploading');
    setResumeImport(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/resume/import', { method: 'POST', body: fd });
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const payload: any = isJson ? await res.json() : await res.text();
      if (!res.ok) {
        const msg =
          (isJson ? payload?.error : String(payload || '')) ||
          `Import failed (HTTP ${res.status})`;
        throw new Error(msg);
      }
      // API returns both top-level and extracted.*; prefer extracted for shape stability.
      const extracted = payload?.extracted || payload;
      setResumeImport(extracted);
      setResumeImportStatus('ready');

      // Auto-save with Merge by default so Settings UI fills immediately without a second click.
      // Replace still requires an explicit "Replace & Save" after preview (safer).
      if (resumeImportMode === 'merge') {
        await applyResumeImportPayload(extracted, 'merge');
      }
    } catch (e: any) {
      setResumeImportStatus('error');
      setResumeImport({ error: e?.message || 'Import failed' });
    }
  };

  const applyResumeImport = async () => {
    if (!resumeImport) return;
    await applyResumeImportPayload(resumeImport, resumeImportMode);
  };

  const openJobDetails = async (jobId: number) => {
    setJobDetailsOpen(true);
    setJobDetails(null);
    setJobDetailsError(null);
    setJobDetailsLoading(true);
    try {
      const res = await fetch(`/api/job/${jobId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load job');
      setJobDetails(json);
    } catch (e: any) {
      setJobDetailsError(e?.message || 'Failed to load job');
    } finally {
      setJobDetailsLoading(false);
    }
  };

  const updateApplicationStatus = async (appId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/applications/${appId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.error || 'Failed to update status');
      }
      // Refresh dashboard data
      const refreshRes = await fetch('/api/data');
      if (refreshRes.ok) {
        const refreshedData = await refreshRes.json();
        setData(refreshedData);
      }
    } catch (err: any) {
      console.error('Update status error:', err);
      setToast({ show: true, message: err.message || 'Failed to update status' });
      setTimeout(() => setToast({ show: false, message: '' }), 4000);
    }
  };

  const handleMarkApplied = async (jobId: number) => {
    try {
      const res = await fetch('/api/applications/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'APPLIED' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to mark as applied');

      const refreshRes = await fetch('/api/data');
      if (refreshRes.ok) {
        const freshData = await refreshRes.json();
        setData(freshData);
      }

      setToast({ show: true, message: '[OK] ✔ Job moved to Applications board' });
      setTimeout(() => setToast({ show: false, message: '' }), 4000);
    } catch (e: any) {
      setToast({ show: true, message: `[ERR] ✗ ${e?.message || 'Action failed'}` });
      setTimeout(() => setToast({ show: false, message: '' }), 5000);
    }
  };

  const openDeleteConfirm = (id: number, company: string, title: string) => {
    setDeleteTarget({ id, company, title });
    setDeleteConfirmOpen(true);
  };

  const handleDeleteJob = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/job/${deleteTarget.id}/delete`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to delete');

      // Refresh data
      const refreshRes = await fetch('/api/data');
      if (refreshRes.ok) {
        const freshData = await refreshRes.json();
        setData(freshData);
      }

      setToast({ show: true, message: `[OK] ✔ Deleted ${deleteTarget.company} — ${deleteTarget.title}` });
      setTimeout(() => setToast({ show: false, message: '' }), 3000);
      setDeleteConfirmOpen(false);
      if (jobDetailsOpen && jobDetails?.id === deleteTarget.id) {
        setJobDetailsOpen(false);
        setJobDetails(null);
        setJobDetailsError(null);
      }
      setDeleteTarget(null);
    } catch (e: any) {
      setToast({ show: true, message: `[ERR] ✗ Delete failed: ${e?.message || 'Unknown error'}` });
      setTimeout(() => setToast({ show: false, message: '' }), 5000);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openClearPipelineModal = () => {
    setClearPipelineScope(pipelineFilterActive ? 'visible' : 'all');
    setClearPipelineOpen(true);
  };

  const handleClearPipeline = async () => {
    if (clearPipelineScope === 'visible' && pipelineFiltered === 0) {
      setToast({ show: true, message: '[ERR] ✗ No visible jobs to delete' });
      setTimeout(() => setToast({ show: false, message: '' }), 4000);
      return;
    }
    setClearPipelineLoading(true);
    try {
      const body =
        clearPipelineScope === 'visible'
          ? {
              scope: 'ids',
              ids: filteredPipeline.map((j: any) => Number(j.pipeline_id)).filter((n: number) => Number.isFinite(n)),
            }
          : { scope: 'all' };
      const res = await fetch('/api/pipeline/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Clear failed');

      const refreshRes = await fetch('/api/data');
      if (refreshRes.ok) {
        const freshData = await refreshRes.json();
        setData(freshData);
      }

      setToast({
        show: true,
        message: `[OK] ✔ Removed ${json.deletedCount ?? 0} job(s) from pipeline`,
      });
      setTimeout(() => setToast({ show: false, message: '' }), 4000);
      setClearPipelineOpen(false);
      setJobDetailsOpen(false);
      setJobDetails(null);
      setJobDetailsError(null);
    } catch (e: any) {
      setToast({ show: true, message: `[ERR] ✗ ${e?.message || 'Clear failed'}` });
      setTimeout(() => setToast({ show: false, message: '' }), 5000);
    } finally {
      setClearPipelineLoading(false);
    }
  };

  useEffect(() => {
    const term = document.getElementById('terminal-logs');
    if (term) {
      term.scrollTo({
        top: term.scrollHeight,
        behavior: 'auto'
      });
    }
  }, [logs]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAFAF8] text-[#1C1C1E]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 border-2 border-[#1C1C1E] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const firstNameFromProfile = data?.profile?.candidate?.full_name?.trim()?.split(/\s+/)?.[0];
  const firstNameFromSession =
    session?.user?.name?.trim()?.split(/\s+/)?.[0] ||
    session?.user?.email?.split('@')?.[0];
  const displayName = firstNameFromProfile || firstNameFromSession || null;

  const activeApplicationCount = (data?.applications || []).filter((app: any) => {
    const s = String(app.status || '').toUpperCase();
    return !['REJECTED', 'DISCARDED', 'SKIP', 'RECHAZADO', 'DESCARTADO'].includes(s);
  }).length;

  const searchActions = (
    <>
      <button
        onClick={() => setIsSearchOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${
          isSearchOpen || searchQuery.trim()
            ? 'border-[#1C1C1E] bg-white text-[#1C1C1E]'
            : 'border-[#E5E5E0] bg-white text-[#1C1C1E] hover:bg-[#FAFAF8]'
        }`}
      >
        <Search size={16} />
        <span>{searchQuery.trim() ? 'Searching' : 'Search'}</span>
      </button>
      <button
        onClick={() => { setActiveTab('terminal'); runCommand('rank'); }}
        className="flex items-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#27272a]"
      >
        <Play size={16} />
        <span>Quick Run</span>
      </button>
    </>
  );

  const appsHeaderActions = (
    <>
      <div className="flex items-center rounded-xl border border-[#E5E5E0] bg-[#F5F5F0] p-1">
        <button
          type="button"
          onClick={() => setAppsViewMode('kanban')}
          className={`rounded-lg px-3 py-1.5 caps-mono transition-all ${appsViewMode === 'kanban' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'text-[#6B6B6B] hover:text-[#1C1C1E]'}`}
        >
          Kanban
        </button>
        <button
          type="button"
          onClick={() => setAppsViewMode('table')}
          className={`rounded-lg px-3 py-1.5 caps-mono transition-all ${appsViewMode === 'table' ? 'bg-[#1C1C1E] text-white shadow-sm' : 'text-[#6B6B6B] hover:text-[#1C1C1E]'}`}
        >
          Table
        </button>
      </div>
      <button
        type="button"
        onClick={() => setIsSearchOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
          isSearchOpen || searchQuery.trim()
            ? 'border-[#1C1C1E] bg-white text-[#1C1C1E]'
            : 'border-[#E5E5E0] bg-white text-[#1C1C1E] hover:bg-[#FAFAF8]'
        }`}
      >
        <Filter size={14} />
        Filter
      </button>
      <button
        type="button"
        onClick={() => setAppsSortBy((prev) => (prev === 'score' ? 'date' : 'score'))}
        className="flex items-center gap-2 rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-sm font-bold text-[#1C1C1E] transition-colors hover:bg-[#FAFAF8]"
        title={appsSortBy === 'score' ? 'Sorted by score' : 'Sorted by date'}
      >
        <ArrowUpDown size={14} />
        Sort
      </button>
    </>
  );

  return (
    <div className="flex h-screen bg-[#FAFAF8] text-[#1C1C1E] font-[family-name:var(--font-inter)] selection:bg-[#1C1C1E]/10">
      {/* Sidebar: collapsible — icons only when collapsed */}
      <aside
        className={`relative flex h-screen flex-col overflow-hidden border-r border-[#E5E5E0] bg-[#F5F5F0] transition-[width] duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-[4.5rem]' : 'w-60'
        }`}
      >
        <div className={`flex-1 overflow-y-auto overflow-x-hidden ${sidebarCollapsed ? 'px-2 py-4' : 'px-4 py-6'}`}>
          <div
            className={`mb-6 flex items-center ${
              sidebarCollapsed ? 'justify-center' : 'gap-2.5 px-1'
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1c1c1e]">
              <Zap size={14} className="text-white" strokeWidth={2} />
            </div>
            {!sidebarCollapsed && (
              <div className="flex min-w-0 items-baseline gap-1.5 overflow-hidden">
                <span className="truncate text-[16px] font-semibold text-[#1a1a1a]">Career-Ops</span>
                <span className="shrink-0 text-[11px] font-medium text-[#9ca3af]">v2.0</span>
              </div>
            )}
          </div>

          <nav className="space-y-0.5">
            <NavItem id="nav-dashboard" icon={<LayoutDashboard size={18}/>} label="Dashboard" active={activeTab === 'dashboard'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('dashboard')} />
            <NavItem id="nav-pipeline" icon={<Search size={18}/>} label="Job Pipeline" active={activeTab === 'pipeline'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('pipeline')} />
            <NavItem id="nav-apps" icon={<Briefcase size={18}/>} label="Applications" active={activeTab === 'apps'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('apps')} />
            <NavItem id="nav-gcc" icon={<Target size={18}/>} label="GCC Campaign" active={activeTab === 'gcc'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('gcc')} />
            <NavItem id="nav-resume-studio" icon={<Sparkles size={18}/>} label="Resume Studio" active={activeTab === 'resume-studio'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('resume-studio')} badge={showBetaBanner || process.env.NEXT_PUBLIC_BETA_MODE === '1' ? 'Beta' : undefined} />
            <NavItem id="nav-generated-docs" icon={<Files size={18}/>} label="Generated Docs" active={activeTab === 'generated-docs'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('generated-docs')} />
            <NavItem id="nav-terminal" icon={<TerminalIcon size={18}/>} label="Terminal" active={activeTab === 'terminal'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('terminal')} />
            <NavItem id="nav-chat" icon={<MessageSquare size={18}/>} label="Career Copilot" active={activeTab === 'chat'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('chat')} />
            {SHOW_RESUME_MANAGER_NAV && (
            <NavItem id="nav-cv" icon={<FileText size={18}/>} label="Resume Manager" active={activeTab === 'cv'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('cv')} />
            )}
            {isAdmin && (
              <NavItem id="nav-analytics" icon={<Eye size={18}/>} label="Analytics" active={activeTab === 'analytics'} collapsed={sidebarCollapsed} onClick={() => { setActiveTab('analytics'); if (!visitorStats) { fetch('/api/view').then(r => r.json()).then(setVisitorStats).catch(() => {}); } }} />
            )}
            <NavItem id="nav-docs" icon={<BookOpen size={18}/>} label="Tutorial & Docs" active={activeTab === 'docs'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('docs')} />
          </nav>
        </div>

        <div className={`mt-auto border-t border-[#E5E5E0] ${sidebarCollapsed ? 'px-2 py-3' : 'px-4 py-4'}`}>
          <NavItem id="nav-settings" icon={<Settings size={18}/>} label="Settings" active={activeTab === 'settings'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('settings')} />
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            title={sidebarCollapsed ? 'Sign Out' : undefined}
            className={`group mt-2 flex w-full items-center rounded-xl text-[#6B6B6B] transition-all hover:bg-white/50 hover:text-[#1C1C1E] ${
              sidebarCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
            }`}
          >
            <LogOut size={18} className="opacity-70 transition-opacity group-hover:opacity-100" />
            {!sidebarCollapsed && <span className="text-sm font-bold">Sign Out</span>}
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            className={`mt-2 flex w-full items-center justify-center rounded-xl border border-[#E5E5E0] bg-white py-2.5 text-[#6B6B6B] transition-all hover:border-[#D4D4CE] hover:text-[#1C1C1E] ${
              sidebarCollapsed ? 'px-0' : 'px-4'
            }`}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#FAFAF8] p-5 sm:p-6 lg:p-8">
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4"
            >
              <div className="flex items-center gap-3 bg-[#FAFAF8] border border-[#E5E5E0] rounded-2xl px-4 py-3">
                <Search size={16} className="text-[#9CA3AF]" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pipeline, applications, docs..."
                  className="flex-1 bg-transparent outline-none text-sm font-medium text-[#1C1C1E] placeholder:text-[#9CA3AF]"
                />
                {searchQuery.trim() && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-3 py-1.5 rounded-xl border border-[#E5E5E0] text-[10px] font-bold uppercase tracking-widest text-[#1C1C1E] hover:bg-white transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-2 text-[10px] font-mono text-[#9CA3AF] uppercase tracking-[0.2em]">
                Results: {filteredPipeline.length} pipeline · {filteredApplications.length} applications · {filteredDocs.length} docs
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dash" className="space-y-8">
              <PageSectionHeader
                title="Dashboard"
                welcomeName={displayName}
                actions={searchActions}
              />
              {showBetaBanner ? (
                <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                        Beta
                      </span>
                      <span className="text-sm font-bold text-[#1C1C1E]">Aug 1 preview — try this path</span>
                    </div>
                    <p className="text-xs text-[#6B6B6B] font-medium leading-relaxed">
                      1) Resume Studio → pick a template · 2) Select a pipeline job for JD match + ATS · 3) Tailor → Generated Docs. PDF uses deep tailor when your GitHub PAT is set.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('resume-studio')}
                      className="rounded-xl bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-white hover:bg-[#27272a]"
                    >
                      Open Studio
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBetaBannerDismissed(true);
                        try {
                          localStorage.setItem('career-ops-beta-banner-dismissed', '1');
                        } catch {
                          // ignore
                        }
                      }}
                      className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-[#6B6B6B] hover:text-[#1C1C1E]"
                      aria-label="Dismiss beta banner"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : null}
               {/* Onboarding Checklist */}
               {(() => {
                 const checklistSteps = [
                   {
                     id: 'profile',
                     label: 'Complete Profile Identity',
                     hint: 'Name, contact, and headline in Settings or Resume Studio',
                     done: profileDone,
                     onClick: () => setActiveTab('resume-studio'),
                   },
                   {
                     id: 'studio',
                     label: 'Try Resume Studio',
                     hint: 'Pick a template, then match a pipeline JD for real ATS',
                     done: studioDone,
                     onClick: () => setActiveTab('resume-studio'),
                   },
                   {
                     id: 'targeting',
                     label: 'Set target roles & keywords',
                     hint: 'Positive keywords drive AI scoring',
                     done: targetingDone,
                     onClick: () => setActiveTab('settings'),
                   },
                   {
                     id: 'github',
                     label: 'Connect GitHub automation',
                     hint: 'PAT (workflow scope) unlocks deep scan & tailor',
                     done: githubDone,
                     onClick: () => setActiveTab('settings'),
                   },
                   {
                     id: 'scan',
                     label: 'Run first job scan',
                     hint: 'Discover roles across your portals',
                     done: scanDone,
                     onClick: () => { setActiveTab('terminal'); runCommand('scan --deep'); },
                   },
                   {
                     id: 'tailor',
                     label: 'Tailor a top match',
                     hint: 'Generate an ATS-optimized resume from Studio or Pipeline',
                     done: tailorDone,
                     onClick: () => setActiveTab('pipeline'),
                   },
                 ];
                 const doneCount = checklistSteps.filter((s) => s.done).length;
                 const incomplete = doneCount < checklistSteps.length;
                 if (!incomplete) return null;

                 return (
                 <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#F5F5F0] border border-[#E5E5E0] p-8 md:p-10 rounded-[2.5rem] relative overflow-hidden"
                 >
                   <div className="relative z-10 max-w-2xl">
                      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                        <div>
                          <h3 className="text-2xl font-bold mb-2 flex items-center gap-3 text-[#1C1C1E]">
                            <Zap className="text-[#1C1C1E]" size={22} />
                            Launch Checklist
                          </h3>
                          <p className="text-[#6B6B6B] font-medium">Complete these steps to activate your AI discovery engine.</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-[#1C1C1E]">{doneCount}/{checklistSteps.length} done</div>
                          <div className="mt-2 h-1.5 w-32 rounded-full bg-white border border-[#E5E5E0] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#1C1C1E] transition-all"
                              style={{ width: `${(doneCount / checklistSteps.length) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      
                       <div className="grid grid-cols-1 gap-3">
                         {checklistSteps.map((step) => (
                           <button 
                             key={step.id}
                             type="button"
                             onClick={step.onClick}
                             className={`flex items-center justify-between gap-4 p-4 md:p-5 rounded-2xl border transition-all text-left ${
                               step.done
                                 ? 'bg-white/70 border-[#E5E5E0] text-[#6B6B6B]'
                                 : 'bg-white border-[#E5E5E0] hover:bg-[#FAFAF8] hover:border-[#1C1C1E]/30'
                             }`}
                           >
                             <div className="min-w-0">
                               <span className={`text-sm font-bold block ${step.done ? 'line-through decoration-[#9CA3AF]' : 'text-[#1C1C1E]'}`}>
                                 {step.label}
                               </span>
                               <span className="text-xs text-[#9CA3AF] font-medium">{step.hint}</span>
                             </div>
                             {step.done ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <ChevronRight size={16} className="shrink-0 text-[#9CA3AF]" />}
                           </button>
                         ))}
                       </div>
                   </div>
                 </motion.div>
                 );
               })()}

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                  <div className="bg-[#F5F5F0] p-8 md:p-10 rounded-[2.5rem] border border-[#E5E5E0] flex flex-col justify-between min-h-[280px]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-2xl font-bold mb-1 text-[#1C1C1E]">Application Funnel</h3>
                          <p className="text-[#9CA3AF] font-medium text-xs flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Click a stage to jump in
                          </p>
                        </div>
                        <div className="text-[10px] font-mono text-[#6B6B6B] uppercase tracking-wider bg-white/60 px-2.5 py-1 rounded-full border border-[#E5E5E0]/50">
                          Auto-Refresh
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-1 sm:gap-2 h-44 mt-4 px-2">
                        {funnelStages.map((stage, i) => (
                          <div key={stage.key} className="flex-1 flex items-stretch gap-1 sm:gap-2 h-full">
                            <button
                              type="button"
                              onClick={() => openFunnelStage(stage.key)}
                              className="flex-1 flex flex-col justify-end items-center group relative h-full cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1C1C1E] focus-visible:ring-offset-2"
                              title={`Open ${stage.label}`}
                            >
                              {/* Custom Interactive Tooltip */}
                              <div className="absolute bottom-full mb-3 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0 bg-[#1C1C1E] text-[#FAFAF8] text-[10px] font-bold px-3 py-2 rounded-xl shadow-xl whitespace-nowrap z-30 flex flex-col items-center border border-[#44403c]">
                                <span>{stage.tooltipTitle}</span>
                                <span className="text-[#9CA3AF] text-[9px] font-medium mt-0.5">{stage.tooltipDesc}</span>
                                <div className="w-2 h-2 bg-[#1C1C1E] rotate-45 mt-1 -mb-2 border-r border-b border-[#44403c]"></div>
                              </div>

                              {/* Value badge */}
                              <div className={`mb-1.5 text-lg font-extrabold tracking-tight ${stage.textColor}`}>
                                {stage.count}
                              </div>

                              {/* Interactive dynamic bar */}
                              <div className="w-full bg-white border border-[#E5E5E0] rounded-2xl overflow-hidden flex items-end h-24 shadow-inner relative group-hover:border-[#1C1C1E]/40 transition-colors">
                                <motion.div
                                  initial={{ height: 0 }}
                                  animate={{ height: stage.height }}
                                  transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                                  className={`w-full rounded-2xl bg-gradient-to-t ${stage.gradient} shadow-lg`}
                                />
                                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                              </div>

                              {/* Label */}
                              <div className="mt-2 text-[10px] font-extrabold text-[#6B6B6B] uppercase tracking-widest text-center group-hover:text-[#1C1C1E] transition-colors">
                                {stage.label}
                              </div>
                            </button>
                            
                            {/* Visual directional arrow to indicate progression */}
                            {i < 3 && (
                              <div className="flex items-center justify-center text-[#d6d3d1] self-center pb-6">
                                <ChevronRight size={14} className="opacity-60 shrink-0" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {interviewCount === 0 && appliedCount > 0 && (
                        <p className="mt-4 text-xs font-medium text-[#6B6B6B]">
                          No interviews yet — move an Applied role forward on the Applications board.
                        </p>
                      )}
                   </div>
                  <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-[#E5E5E0]">
                     <div className="flex items-center justify-between gap-3 mb-6">
                       <h3 className="text-2xl font-bold text-[#1C1C1E]">Recent Activity</h3>
                       {(data?.applications?.length ?? 0) > 0 && (
                         <button
                           type="button"
                           onClick={() => { setAppsStageFocus(null); setActiveTab('apps'); }}
                           className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors"
                         >
                           View all
                         </button>
                       )}
                     </div>
                     <div className="space-y-0 divide-y divide-[#E5E5E0] text-sm">
                       {data?.applications?.length > 0 ? data.applications.slice(0, 4).map((app: any, i: number) => {
                         const statusLabel = String(app.status || 'EVALUATED').toUpperCase();
                         const tailorId = app.job_id || app.pipeline_id;
                         return (
                         <div key={app.app_id || i} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                           <div className="flex min-w-0 items-start gap-3">
                              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9CA3AF]" />
                              <div className="min-w-0">
                                <div className="truncate font-bold text-[#1C1C1E]">
                                  {app.company}{app.role ? ` — ${app.role}` : ''}
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusChipClass(statusLabel)}`}>
                                    {statusLabel}
                                  </span>
                                  <AiScoreBadge score={app.score} />
                                  <span className="text-xs text-[#9CA3AF]">
                                    {formatRelativeTime(app.applied_at)}
                                  </span>
                                </div>
                              </div>
                           </div>
                           <div className="flex shrink-0 items-center gap-2 pl-4 sm:pl-0">
                             {app?.job_id && (
                               <button
                                 type="button"
                                 onClick={() => openJobDetails(Number(app.job_id))}
                                 className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-1.5 text-[11px] font-bold text-[#1C1C1E] hover:bg-[#FAFAF8] transition-colors"
                               >
                                 Open
                               </button>
                             )}
                             {tailorId && (
                               <button
                                 type="button"
                                 onClick={() => { setActiveTab('terminal'); void requestTailor(tailorId); }}
                                 className="rounded-xl bg-[#1C1C1E] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#27272a] transition-colors"
                               >
                                 Tailor
                               </button>
                             )}
                             {app?.url && !app?.job_id && (
                               <a
                                 href={app.url}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-1.5 text-[11px] font-bold text-[#1C1C1E] hover:bg-[#FAFAF8] transition-colors"
                               >
                                 Open
                               </a>
                             )}
                           </div>
                         </div>
                         );
                       }) : (
                         <p className="text-[#9CA3AF] italic font-medium">No recent activity detected.</p>
                       )}
                     </div>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'apps' && (() => {
            const kanbanColumns = [
              { id: 'EVALUATED', label: 'Evaluated', bar: 'bg-amber-400', statuses: ['PENDING', 'EVALUATED'], color: 'border-t-amber-500 bg-amber-50/5' },
              { id: 'APPLIED', label: 'Applied', bar: 'bg-sky-500', statuses: ['APPLIED', 'RESPONDED', 'SENT'], color: 'border-t-sky-500 bg-sky-50/5' },
              { id: 'INTERVIEWING', label: 'Interviewing', bar: 'bg-emerald-500', statuses: ['INTERVIEW', 'ENTREVISTA'], color: 'border-t-emerald-500 bg-emerald-50/5' },
              { id: 'OFFER', label: 'Offer', bar: 'bg-purple-500', statuses: ['OFFER', 'OFERTA'], color: 'border-t-purple-500 bg-purple-50/5' },
              { id: 'REJECTED', label: 'Rejected', bar: 'bg-stone-400', statuses: ['REJECTED', 'DISCARDED', 'SKIP', 'RECHAZADO', 'DESCARTADO'], color: 'border-t-stone-400 bg-stone-50/5' }
            ];

            const followUpReminders = (data?.applications || []).filter((app: any) => {
              const statusUpper = String(app.status || '').toUpperCase();
              return statusUpper === 'APPLIED' && app.applied_at && 
                Math.floor((Date.now() - new Date(app.applied_at).getTime()) / (1000 * 60 * 60 * 24)) >= 7;
            });

            return (
              <motion.div key="apps" className="space-y-4">
                <PageSectionHeader
                  title="Application Pipeline"
                  subtitle={`${activeApplicationCount} active application${activeApplicationCount === 1 ? '' : 's'} across 5 stages`}
                  actions={appsHeaderActions}
                />
              {appsStageFocus && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E5E0] bg-[#F5F5F0] px-4 py-3">
                  <p className="text-sm font-medium text-[#1C1C1E]">
                    Showing focus: <span className="font-bold">{appsStageFocus}</span>
                    <span className="text-[#6B6B6B]"> — from Application Funnel</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setAppsStageFocus(null)}
                    className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#1C1C1E] hover:bg-[#FAFAF8] transition-colors"
                  >
                    Clear focus
                  </button>
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white shadow-sm">
                {/* Reminders Panel */}
                {followUpReminders.length > 0 && (
                  <div className="mx-4 mt-4 p-4 bg-amber-50/85 border border-amber-200/80 rounded-xl flex items-start gap-3">
                    <AlertCircle className="text-amber-600 mt-0.5 shrink-0" size={18} />
                    <div>
                      <h3 className="text-sm font-bold text-amber-900">Follow-Up Reminders</h3>
                      <p className="text-xs text-amber-700 mt-1 font-medium">
                        You applied to these roles more than 7 days ago. Consider checking in or sending a follow-up email:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {followUpReminders.map((app: any, idx: number) => {
                          const days = Math.floor((Date.now() - new Date(app.applied_at).getTime()) / (1000 * 60 * 60 * 24));
                          return (
                            <div key={idx} className="bg-white border border-amber-200 px-3 py-1.5 rounded-full text-xs font-semibold text-stone-700 flex items-center gap-2 shadow-sm">
                              <span className="font-bold text-[#1C1C1E]">{app.company}</span>
                              <span className="text-stone-300">|</span>
                              <span className="text-stone-500 font-medium">{app.role}</span>
                              <span className="bg-amber-100 text-amber-800 caps-mono px-2 py-0.5 rounded-full">{days}d ago</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {appsViewMode === 'table' ? (
                  <div className="p-4">
                    <div className="h-[min(560px,calc(100vh-13rem))] min-h-[420px] overflow-auto rounded-xl border border-[#E5E5E0] bg-white">
                      <table className="w-full min-w-[56rem] text-left">
                        <thead className="sticky top-0 z-10 bg-[#F5F5F0] border-b border-[#E5E5E0] shadow-[0_1px_0_#E5E5E0]">
                          <tr className="caps-mono text-[#9CA3AF] tracking-[0.2em]">
                            <th className="px-5 py-4">Company</th>
                            <th className="px-5 py-4">Role</th>
                            <th className="px-5 py-4">Status</th>
                            <th className="px-5 py-4">Date</th>
                            <th className="px-5 py-4">AI Score</th>
                            <th className="px-5 py-4">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F5F5F0]">
                          {sortedApplications.map((app: any, i: number) => (
                            <tr key={i} className="hover:bg-[#FAFAF8] transition-colors group">
                              <td className="px-5 py-4 font-bold text-[#1C1C1E] max-w-[12rem] break-words">{app.company}</td>
                              <td className="px-5 py-4 text-[#6B6B6B] font-medium max-w-[14rem] break-words">{app.role}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full caps-mono tracking-wider ${
                                ['APPLIED', 'SENT'].includes(String(app.status || '').toUpperCase()) ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                                ['INTERVIEW', 'ENTREVISTA'].includes(String(app.status || '').toUpperCase()) ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                ['OFFER', 'OFERTA'].includes(String(app.status || '').toUpperCase()) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                ['REJECTED', 'DESCARTADO', 'SKIP', 'DISCARDED'].includes(String(app.status || '').toUpperCase()) ? 'bg-stone-100 text-stone-600' :
                                'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 font-mono text-xs text-[#9CA3AF]">
                              {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-5 py-4">
                               <AiScoreBadge score={app.score} />
                            </td>
                            <td className="px-5 py-4 text-[#1C1C1E]">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => { setActiveTab('terminal'); runCommand(`apply ${app.job_id} --deep`); }}
                                  className="p-2 border border-[#E5E5E0] rounded-lg hover:bg-[#1C1C1E] hover:text-white transition-all"
                                  title="Run tailor/apply"
                                >
                                  <Play size={14} />
                                </button>
                                {app?.url && (
                                  <a
                                    href={app.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 border border-[#E5E5E0] rounded-lg hover:bg-[#F5F5F0] transition-all"
                                    title="Open posting"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                                {app?.job_id && (
                                  <button
                                    onClick={() => openJobDetails(Number(app.job_id))}
                                    className="p-2 border border-[#E5E5E0] rounded-lg hover:bg-[#F5F5F0] transition-all"
                                    title="Details"
                                  >
                                    <FileText size={14} />
                                  </button>
                                )}
                                {app?.job_id && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openDeleteConfirm(
                                        Number(app.job_id),
                                        String(app.company || 'Job'),
                                        String(app.role || 'Unknown role')
                                      )
                                    }
                                    className="p-2 border border-[#E5E5E0] rounded-lg text-[#9CA3AF] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                                    title="Delete application and job record"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {sortedApplications.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-5 py-12 text-center caps-mono tracking-widest text-[#9CA3AF]">
                              No applications yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="h-[min(560px,calc(100vh-13rem))] min-h-[420px] overflow-x-auto">
                      <div className="grid h-full min-w-[900px] grid-cols-5 gap-3 min-h-0">
                    {kanbanColumns.map((col) => {
                      const colApps = sortedApplications.filter((app: any) =>
                        col.statuses.includes(String(app.status || '').toUpperCase())
                      );

                      return (
                        <div
                          key={col.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const appIdStr = e.dataTransfer.getData('text/plain');
                            const appId = parseInt(appIdStr, 10);
                            if (Number.isFinite(appId)) {
                              updateApplicationStatus(appId, col.statuses[0]);
                            }
                          }}
                          className={`flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white transition-all ${
                            appsStageFocus === col.id
                              ? 'border-[#1C1C1E] ring-2 ring-[#1C1C1E]/15 shadow-md'
                              : appsStageFocus
                                ? 'border-[#E5E5E0] opacity-40'
                                : 'border-[#E5E5E0]'
                          }`}
                        >
                          <div className={`h-1 shrink-0 ${col.bar}`} />
                          <div className="flex shrink-0 items-center justify-between border-b border-[#F5F5F0] px-3 py-2.5">
                            <span className="caps-mono text-[#9CA3AF]">{col.id}</span>
                            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#1C1C1E] px-1.5 font-mono text-[10px] text-white">{colApps.length}</span>
                          </div>

                          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                            {colApps.map((app: any) => {
                              const days = app.applied_at 
                                ? Math.floor((Date.now() - new Date(app.applied_at).getTime()) / (1000 * 60 * 60 * 24)) 
                                : null;
                              const showOverdue = col.id === 'APPLIED' && days !== null && days >= 14;
                              const showWarning = col.id === 'APPLIED' && days !== null && days >= 7 && days < 14;

                              return (
                                <div
                                  key={app.app_id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', String(app.app_id));
                                  }}
                                  className="group relative shrink-0 cursor-grab rounded-lg border border-[#E5E5E0] bg-white p-3 transition-all hover:shadow-sm active:cursor-grabbing"
                                >
                                  <div className="mb-2 flex items-start justify-between gap-1.5">
                                    <CompanyAvatar name={app.company} />
                                    <AiScoreBadge score={app.score} />
                                  </div>
                                  <h4 className="mb-0.5 line-clamp-2 break-words text-sm font-bold leading-snug text-[#1C1C1E]">{app.company}</h4>
                                  <p className="mb-2 line-clamp-2 break-words text-xs text-[#6B6B6B]">{app.role}</p>

                                  {showOverdue && (
                                    <div className="bg-rose-50 border border-rose-100 rounded-md p-1.5 mb-2 flex items-center gap-1.5 text-[10px] font-bold text-rose-700">
                                      <AlertCircle size={11} className="shrink-0" />
                                      <span>Overdue ({days}d)</span>
                                    </div>
                                  )}
                                  {showWarning && (
                                    <div className="bg-amber-50 border border-amber-100 rounded-md p-1.5 mb-2 flex items-center gap-1.5 text-[10px] font-bold text-amber-700">
                                      <AlertCircle size={11} className="shrink-0" />
                                      <span>Follow up ({days}d)</span>
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between pt-2">
                                    <span className="font-mono text-[11px] text-[#9CA3AF]">
                                      {app.applied_at
                                        ? new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                        : '—'}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                      {app?.url && (
                                        <a
                                          href={app.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-1 border border-[#E5E5E0] rounded hover:bg-[#F5F5F0] text-[#6B6B6B] transition-all"
                                          title="Open posting"
                                        >
                                          <ExternalLink size={10} />
                                        </a>
                                      )}
                                      {app?.job_id && (
                                        <button
                                          onClick={() => openJobDetails(Number(app.job_id))}
                                          className="p-1 border border-[#E5E5E0] rounded hover:bg-[#F5F5F0] text-[#6B6B6B] transition-all"
                                          title="Details"
                                        >
                                          <FileText size={10} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            {colApps.length === 0 && (
                              <div className="flex flex-1 min-h-[80px] items-center justify-center rounded-lg border border-dashed border-[#E5E5E0]">
                                <span className="caps-mono tracking-widest text-[#9CA3AF]">Empty</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </motion.div>
            );
          })()}

          {activeTab === 'pipeline' && (
            <motion.div key="pipeline" className="space-y-6">
              <PageSectionHeader
                title="Job Pipeline"
                subtitle={`AI-ranked opportunities · ${pipelineTotal} job${pipelineTotal === 1 ? '' : 's'} in pipeline`}
                actions={searchActions}
              />
            <div className="overflow-hidden rounded-[1.5rem] border border-[#E5E5E0] bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[#E5E5E0] bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-[#1C1C1E]">Live Job Pipeline</h2>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('terminal'); runCommand('scan --deep'); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#27272a]"
                  >
                    <Zap size={14} />
                    Scan
                  </button>
                  {pipelineTotal > 0 && (
                    <button
                      type="button"
                      onClick={openClearPipelineModal}
                      className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-rose-700 transition-colors hover:bg-rose-50"
                    >
                      Clear…
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[640px] overflow-x-auto text-sm">
                <table className="w-full text-left">
                  <thead className="sticky top-0 border-b border-[#E5E5E0] bg-[#FAFAF8]">
                    <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF]">
                      <th className="px-6 py-4">Target / Company</th>
                      <th className="px-6 py-4">Job Title</th>
                      <th className="px-6 py-4">AI Score</th>
                      <th className="px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F0]">
                    {filteredPipeline.map((job: any, i: number) => (
                      <tr key={i} className="transition-colors hover:bg-[#FAFAF8]">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <CompanyAvatar name={job.company} />
                            <div className="min-w-0 flex items-center gap-2">
                              <div className="truncate font-bold text-[#1C1C1E]">{job.company}</div>
                              {job.company_type === 'GCC' && (
                                <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md">
                                  GCC
                                </span>
                              )}
                              {job.gcc_signal_score != null && job.company_type === 'GCC' && (
                                <span className="px-1.5 py-0.5 text-[8px] font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
                                  {job.gcc_signal_score}/5
                                </span>
                              )}
                              {job.gcc_high_value && (
                                <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider bg-violet-100 text-violet-800 border border-violet-200 rounded-md">
                                  High Value
                                </span>
                              )}
                              {job.company_type === 'Services' && (
                                <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 rounded-md">
                                  Services
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-medium text-[#6B6B6B]">{job.title || 'Unknown Role'}</div>
                          <div className="mt-1 text-[10px] font-mono text-[#9CA3AF]">
                            {job.posted_at
                              ? `Posted ${formatRelativeTime(job.posted_at)}`
                              : `Added ${formatRelativeTime(job.created_at)}`}
                            {job.posted_confidence ? ` · ${job.posted_confidence}` : ''}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <AiScoreBadge score={job.score} />
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openJobDetails(Number(job.pipeline_id))}
                              className="rounded-xl border border-[#E5E5E0] bg-white px-4 py-2 text-xs font-bold text-[#1C1C1E] transition-all hover:bg-[#FAFAF8]"
                            >
                              Evaluate
                            </button>
                            <button
                              onClick={() => { setActiveTab('terminal'); void requestTailor(job.pipeline_id); }}
                              className="rounded-xl border border-[#E5E5E0] bg-white px-4 py-2 text-xs font-bold text-[#1C1C1E] transition-all hover:bg-[#FAFAF8]"
                            >
                              Tailor
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openInStudio({
                                  jobId: Number(job.pipeline_id),
                                  company: job.company,
                                  title: job.title,
                                  score: job.score,
                                  ats_content_score: job.ats_content_score ?? null,
                                })
                              }
                              className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-xs font-bold text-[#1C1C1E] transition-all hover:bg-[#FAFAF8]"
                              title="Open in Resume Studio"
                            >
                              <Sparkles size={14} className="inline" />
                            </button>
                            {(job.company_type === 'GCC' || job.gcc_high_value) && (
                              <button
                                type="button"
                                onClick={() => addToGccCampaign(String(job.company || ''), String(job.title || ''))}
                                className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 transition-all hover:bg-violet-100"
                                title="Add to GCC Campaign tracker"
                              >
                                <Target size={14} className="inline" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                openDeleteConfirm(
                                  Number(job.pipeline_id),
                                  String(job.company || 'Job'),
                                  String(job.title || 'Unknown role')
                                )
                              }
                              className="rounded-xl p-2 text-[#9CA3AF] transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                              title="Remove from pipeline"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredPipeline.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center">
                          <p className="text-sm font-semibold text-[#1C1C1E]">No jobs in pipeline yet</p>
                          <p className="mt-2 text-xs font-medium text-[#6B6B6B]">
                            Run a scan to discover roles, then open Resume Studio to match a JD.
                          </p>
                          <button
                            type="button"
                            onClick={() => { setActiveTab('terminal'); runCommand('scan --deep'); }}
                            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1C1C1E] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#27272a]"
                          >
                            <Zap size={14} />
                            Scan jobs
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </motion.div>
          )}

          {activeTab === 'resume-studio' && (
            <motion.div key="resume-studio" className="space-y-4">
              <PageSectionHeader
                title="Resume Studio"
                subtitle="Master resume editor with live ATS preview — same profile that powers tailor"
              />
              <ResumeStudio
                initialProfile={
                  profileFormData?.candidate?.full_name || (profileFormData?.experience || []).length
                    ? profileFormData
                    : data?.profile || profileFormData || null
                }
                pipeline={(data?.pipeline || []).slice(0, 40)}
                initialJobId={studioInitialJobId}
                reviewJob={studioReviewJob}
                onClearReviewJob={() => {
                  setStudioReviewJob(null);
                  setStudioInitialJobId(null);
                }}
                onTailorJob={(jobId) => {
                  setActiveTab('terminal');
                  void requestTailor(jobId);
                }}
                onProfileSaved={(ctx) => {
                  setProfileFormData((prev: any) => ({
                    ...prev,
                    ...ctx,
                    candidate: { ...(prev?.candidate || {}), ...(ctx.candidate || {}) },
                    narrative: { ...(prev?.narrative || {}), ...(ctx.narrative || {}) },
                    experience: ctx.experience ?? prev?.experience,
                    education: ctx.education ?? prev?.education,
                    studio: ctx.studio || prev?.studio,
                  }));
                  setData((prev: any) =>
                    prev
                      ? {
                          ...prev,
                          profile: {
                            ...(prev.profile || {}),
                            candidate: ctx.candidate,
                            narrative: ctx.narrative,
                            experience: ctx.experience,
                            education: ctx.education,
                            studio: ctx.studio,
                          },
                        }
                      : prev
                  );
                }}
                onOpenGeneratedDocs={() => setActiveTab('generated-docs')}
              />
            </motion.div>
          )}

          {activeTab === 'generated-docs' && (
            <div className="space-y-6">
              <PageSectionHeader
                title="Generated Docs"
                subtitle={`${filteredDocs.length} tailored resume${filteredDocs.length === 1 ? '' : 's'} and cover letters`}
                actions={searchActions}
              />
            <GeneratedDocsPanel
              docs={data?.pdfs || []}
              onDelete={openDeleteConfirm}
              onOpenPipeline={() => setActiveTab('pipeline')}
              onOpenInStudio={(doc) =>
                openInStudio({
                  jobId: Number(doc.id),
                  company: doc.company,
                  title: doc.title,
                  score: null,
                  ats_content_score: doc.ats_content_score ?? null,
                })
              }
            />
            </div>
          )}

          {activeTab === 'cv' && (
            <motion.div key="cv" className="grid grid-cols-3 gap-10">
               <div className="col-span-2 space-y-10">
                <div className="bg-[#F5F5F0] p-10 border border-[#E5E5E0] rounded-[2.5rem]">
                   <h3 className="text-xl font-bold mb-6 text-[#1C1C1E] border-b border-[#E5E5E0] pb-4">Profile Narrative</h3>
                   {data?.profile?.narrative?.exit_story ? (
                     <p className="text-[#1C1C1E] leading-relaxed font-medium italic pl-6 border-l-4 border-emerald-500/30">
                        "{data?.profile?.narrative?.exit_story}"
                     </p>
                   ) : (
                     <div className="py-4">
                       <p className="text-[#9CA3AF] font-medium italic">No narrative defined yet.</p>
                       <button onClick={() => setActiveTab('settings')} className="mt-4 text-[#1C1C1E] text-xs font-bold uppercase tracking-widest hover:underline underline-offset-4">Configure Story →</button>
                     </div>
                   )}
                </div>
                <div className="grid grid-cols-2 gap-6">
                  {data?.profile?.narrative?.superpowers?.length > 0 ? (
                    data.profile.narrative.superpowers.map((s: any, i: number) => (
                      <div key={i} className="p-6 bg-white border border-[#E5E5E0] rounded-2xl text-xs font-bold uppercase tracking-widest text-[#9CA3AF] hover:text-[#1C1C1E] transition-colors">
                         {s}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-6 bg-white/50 border border-dashed border-[#E5E5E0] rounded-2xl text-center">
                       <p className="text-[#9CA3AF] text-xs font-bold uppercase tracking-widest">Awaiting Superpower Sync</p>
                    </div>
                  )}
                </div>
               </div>
               <div className="bg-[#FAFAF8] border border-[#E5E5E0] rounded-[2rem] sm:rounded-[2.5rem] p-3 sm:p-6 lg:p-8 flex flex-col shadow-sm">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-[#1C1C1E] rounded-xl">
                        <FileText size={16} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1C1C1E] text-sm sm:text-base">Generated Documents</h3>
                        <p className="text-[10px] text-[#9CA3AF] hidden sm:block">Tailored resumes and cover letters</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-white border border-[#E5E5E0] rounded-full text-[10px] sm:text-xs font-bold text-[#6B6B6B]">
                      {filteredDocs.length} {filteredDocs.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  <div className="space-y-3 overflow-y-auto flex-1">
                    {filteredDocs.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <div className="w-16 h-16 mx-auto mb-4 bg-[#F5F5F0] rounded-2xl flex items-center justify-center">
                          <FileText size={24} className="text-[#9CA3AF]" />
                        </div>
                        <p className="text-sm font-medium text-[#6B6B6B]">No documents yet</p>
                        <p className="text-xs text-[#9CA3AF] mt-1">Run tailor to generate resumes</p>
                      </div>
                    ) : (
                      filteredDocs.map((doc: any, i: number) => (
                        <div
                          key={i}
                          className="group bg-white rounded-2xl border border-[#E5E5E0] hover:border-[#1C1C1E] hover:shadow-lg transition-all duration-200 overflow-hidden"
                        >
                          {/* Card Header */}
                          <div className="p-3 sm:p-4 border-b border-[#F5F5F0] bg-gradient-to-r from-white to-[#FAFAF8]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                  <span className="truncate text-sm font-bold text-[#1C1C1E]">
                                    {doc.company}
                                  </span>
                                </div>
                                <div className="truncate text-xs text-[#6B6B6B] pl-4">
                                  {doc.title}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {doc?.url && (
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg hover:bg-[#F5F5F0] transition-all text-[#6B6B6B] hover:text-[#1C1C1E]"
                                    title="Open job posting"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                                <button
                                  onClick={() => openDeleteConfirm(Number(doc.id), doc.company, doc.title)}
                                  className="p-2 rounded-lg hover:bg-rose-50 transition-all text-[#9CA3AF] hover:text-rose-600"
                                  title="Delete job and documents"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="p-2 sm:p-3">
                            <div className="grid grid-cols-2 gap-2">
                              {/* Resume PDF */}
                              {doc.has_resume_pdf ? (
                                <a
                                  href={`/api/view/${doc.id}?format=pdf&download=1`}
                                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#1C1C1E] text-white text-xs font-bold hover:bg-[#27272a] hover:shadow-md transition-all"
                                >
                                  <FileText size={14} />
                                  <span>Resume</span>
                                </a>
                              ) : (
                                <span className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#F5F5F0] text-[#9CA3AF] text-xs font-bold cursor-not-allowed">
                                  <FileText size={14} />
                                  <span>—</span>
                                </span>
                              )}

                              {/* Cover Letter PDF */}
                              {doc.has_cover_letter_pdf ? (
                                <a
                                  href={`/api/view/${doc.id}?type=cl&format=pdf&download=1`}
                                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#1C1C1E] text-white text-xs font-bold hover:bg-[#27272a] hover:shadow-md transition-all"
                                >
                                  <FileText size={14} />
                                  <span>Cover</span>
                                </a>
                              ) : (
                                <span className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#F5F5F0] text-[#9CA3AF] text-xs font-bold cursor-not-allowed">
                                  <FileText size={14} />
                                  <span>—</span>
                                </span>
                              )}

                              {/* HTML */}
                              <a
                                href={`/api/view/${doc.id}?download=1`}
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#E5E5E0] text-[#1C1C1E] text-xs font-bold hover:bg-[#F5F5F0] hover:border-[#1C1C1E] transition-all"
                              >
                                <FileText size={14} />
                                <span>HTML</span>
                              </a>

                              {/* View */}
                              <a
                                href={`/api/view/${doc.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#E5E5E0] text-[#6B6B6B] text-xs font-bold hover:bg-[#F5F5F0] hover:text-[#1C1C1E] hover:border-[#1C1C1E] transition-all"
                              >
                                <ExternalLink size={14} />
                                <span>View</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div key="analytics" className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-2 text-[#1C1C1E]">Visitor Analytics</h2>
                <p className="text-[#9CA3AF] font-medium">Track unique visitors to your Career-Ops dashboard</p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label: 'Today', views: visitorStats?.today?.total_views, unique: visitorStats?.today?.unique_visitors },
                  { label: 'Last 7 Days', views: visitorStats?.week?.total_views, unique: visitorStats?.week?.unique_visitors },
                  { label: 'Last 30 Days', views: visitorStats?.month?.total_views, unique: visitorStats?.month?.unique_visitors },
                  { label: 'All Time', views: visitorStats?.allTime?.total_views, unique: visitorStats?.allTime?.unique_visitors },
                ].map((s) => (
                  <div key={s.label} className="p-6 bg-white border border-[#E5E5E0] rounded-2xl hover:border-[#1C1C1E] hover:shadow-lg transition-all">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">{s.label}</div>
                    <div className="text-3xl font-bold text-[#1C1C1E]">{s.unique ?? '—'}</div>
                    <div className="text-xs text-[#9CA3AF] mt-1">{s.views ?? 0} total views</div>
                  </div>
                ))}
              </div>

              {/* Daily Chart */}
              {visitorStats?.daily && visitorStats.daily.length > 0 && (
                <div className="bg-white border border-[#E5E5E0] rounded-[2rem] p-8">
                  <h3 className="text-lg font-bold text-[#1C1C1E] mb-6 flex items-center gap-2"><TrendingUp size={18} /> Daily Visitors (Last 14 Days)</h3>
                  <div className="flex items-end gap-2 h-48">
                    {[...visitorStats.daily].reverse().map((d: any) => {
                      const maxVisitors = Math.max(...visitorStats.daily.map((dd: any) => dd.unique_visitors || 1));
                      const heightPct = Math.max(((d.unique_visitors || 0) / maxVisitors) * 100, 4);
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                          <span className="text-[10px] font-bold text-[#1C1C1E]">{d.unique_visitors}</span>
                          <div
                            className="w-full bg-purple-500 rounded-t-lg transition-all hover:bg-purple-600"
                            style={{ height: `${heightPct}%` }}
                            title={`${d.date}: ${d.unique_visitors} unique, ${d.views} total`}
                          />
                          <span className="text-[9px] text-[#9CA3AF] font-mono">{String(d.date).slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Pages */}
                {visitorStats?.topPages && visitorStats.topPages.length > 0 && (
                  <div className="bg-white border border-[#E5E5E0] rounded-[2rem] p-8">
                    <h3 className="text-lg font-bold text-[#1C1C1E] mb-6 flex items-center gap-2"><FileText size={18} /> Top Pages</h3>
                    <div className="space-y-3">
                      {visitorStats.topPages.map((p: any, i: number) => (
                        <div key={p.path} className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAF8]">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-[#9CA3AF] w-5">{i + 1}.</span>
                            <span className="text-sm font-bold text-[#1C1C1E] font-mono">{p.path}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-[#1C1C1E]">{p.unique_visitors}</span>
                            <span className="text-xs text-[#9CA3AF] ml-1">unique</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Countries */}
                {visitorStats?.topCountries && visitorStats.topCountries.length > 0 && (
                  <div className="bg-white border border-[#E5E5E0] rounded-[2rem] p-8">
                    <h3 className="text-lg font-bold text-[#1C1C1E] mb-6 flex items-center gap-2"><Globe size={18} /> Top Countries</h3>
                    <div className="space-y-3">
                      {visitorStats.topCountries.map((c: any, i: number) => (
                        <div key={c.country} className="flex items-center justify-between p-3 rounded-xl bg-[#FAFAF8]">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-[#9CA3AF] w-5">{i + 1}.</span>
                            <span className="text-sm font-bold text-[#1C1C1E]">{c.country}</span>
                          </div>
                          <span className="text-sm font-bold text-[#1C1C1E]">{c.unique_visitors}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!visitorStats && (
                <div className="text-center py-20 text-[#9CA3AF]">
                  <Eye size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold">Loading analytics...</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'docs' && (
            <motion.div key="docs" className="space-y-10">
              <PageSectionHeader
                title="Tutorial & Docs"
                subtitle="Master Career-Ops: auto-discover, rank, tailor, and apply to jobs"
              />

              {/* Grid Layout: Intro and Deep Flag */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Intro Card */}
                <div className="bg-[#F5F5F0] p-8 border border-[#E5E5E0] rounded-[2rem] space-y-6">
                  <h3 className="text-xl font-bold text-[#1C1C1E] flex items-center gap-2">
                    <Zap size={20} className="text-amber-500" />
                    How Career-Ops Works
                  </h3>
                  <p className="text-sm text-[#6B6B6B] leading-relaxed font-medium">
                    Career-Ops is a fully automated, agentic job search, evaluation, and application pipeline. 
                    It continuously works in the background to scan job boards, rank them against your profile, 
                    tailor your materials, and help you apply.
                  </p>
                  <div className="space-y-4">
                    {[
                      { step: '1', title: 'Identity Setup', text: 'Go to Settings, define your candidate details, previous experiences, education, and target keywords.' },
                      { step: '2', title: 'Job Discovery', text: 'Scan platforms automatically or add specific job URLs manually via the Terminal.' },
                      { step: '3', title: 'Dynamic Tailoring', text: 'Tailor your resume and cover letter with extreme semantic accuracy for a specific job.' },
                      { step: '4', title: 'Form Application', text: 'Record your application details and let the system assist with automated draft filing.' },
                    ].map((s) => (
                      <div key={s.step} className="flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-white border border-[#E5E5E0] text-[#1C1C1E] flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                          {s.step}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#1C1C1E]">{s.title}</h4>
                          <p className="text-xs text-[#9CA3AF] font-medium mt-0.5">{s.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deep Flag Card */}
                <div className="bg-white p-8 border border-[#E5E5E0] rounded-[2rem] space-y-6 shadow-sm">
                  <h3 className="text-xl font-bold text-[#1C1C1E] flex items-center gap-2">
                    <ShieldCheck size={20} className="text-emerald-600" />
                    Understanding the <code className="bg-[#F5F5F0] px-2 py-0.5 rounded text-xs font-mono font-bold text-emerald-700">--deep</code> Flag
                  </h3>
                  <p className="text-sm text-[#6B6B6B] leading-relaxed font-medium">
                    The <code className="bg-[#F5F5F0] px-1.5 py-0.5 rounded text-xs font-mono font-bold">--deep</code> flag overrides the default, fast heuristic mode to run intensive, highly accurate agent workflows.
                  </p>
                  
                  <div className="space-y-4 text-xs font-medium">
                    <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/80 space-y-2">
                      <h4 className="font-bold text-emerald-800 flex items-center gap-2">
                        <Code size={14} /> Multi-Role Tailoring (Resumes & CL)
                      </h4>
                      <p className="text-emerald-700/80 leading-relaxed">
                        Instead of flat, legacy tailoring, deep tailoring rewrites experience bullets for the <strong>top 3 roles</strong> in your profile, perfectly adapts the professional summary, and ensures <strong>60%+ verbatim technical terminology matching</strong> from the JD.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-2">
                      <h4 className="font-bold text-amber-800 flex items-center gap-2">
                        <Search size={14} /> Broad Scraping & Discovery
                      </h4>
                      <p className="text-amber-700/80 leading-relaxed">
                        Standard scan checks recent lists. Deep scanning searches comprehensively across all major portals (LinkedIn, Naukri, Indeed, Instahyre) and scrapes subpages.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2">
                      <h4 className="font-bold text-blue-800 flex items-center gap-2">
                        <TerminalIcon size={14} /> Comprehensive Model Context
                      </h4>
                      <p className="text-blue-700/80 leading-relaxed">
                        Deep mode feeds a larger context to high-fidelity LLMs, ensuring detailed applications answers and precise ATS alignments.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Command Cheat Sheet */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-[#1C1C1E] flex items-center gap-2">
                  <TerminalIcon size={20} />
                  Interactive Command Reference
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[
                    {
                      cmd: 'scan --deep',
                      desc: 'Auto-discover new job postings matching target keywords across all major boards.',
                      usage: 'Run this to kick off background scraper tasks and crawl job boards.',
                      badge: 'Scraper',
                      badgeColor: 'amber'
                    },
                    {
                      cmd: 'rank --deep',
                      desc: 'Compare recent jobs in the pipeline against your profile keywords using LLM-scoring.',
                      usage: 'Updates all matching scores (0-10) to bubble up the best matches.',
                      badge: 'Ranker',
                      badgeColor: 'blue'
                    },
                    {
                      cmd: 'tailor <job_id> --deep',
                      desc: 'Generate a highly-tailored, ATS-optimized PDF Resume and Cover Letter.',
                      usage: 'Creates your tailored materials inside the Resume Manager instantly.',
                      badge: 'Tailor',
                      badgeColor: 'emerald'
                    },
                    {
                      cmd: 'apply <job_id> --deep',
                      desc: 'Initiate automated form filling and record your application details.',
                      usage: 'Prepares draft application details and submits them to the active funnel.',
                      badge: 'Apply',
                      badgeColor: 'purple'
                    },
                    {
                      cmd: 'add <url>',
                      desc: 'Directly scrape and add a single, public job URL to your pipeline.',
                      usage: 'Example: add https://linkedin.com/jobs/view/12345',
                      badge: 'Direct Scrape',
                      badgeColor: 'stone'
                    },
                    {
                      cmd: 'help',
                      desc: 'Print out the full terminal helper menu and list of available scripts.',
                      usage: 'Shows manual commands and configurations.',
                      badge: 'Help',
                      badgeColor: 'stone'
                    }
                  ].map((c) => (
                    <div key={c.cmd} className="bg-white border border-[#E5E5E0] rounded-[2rem] p-6 hover:shadow-lg transition-all flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <code className="text-sm font-mono font-bold text-[#1C1C1E] bg-[#F5F5F0] px-2.5 py-1 rounded-xl">
                            {c.cmd}
                          </code>
                          <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-${c.badgeColor}-50 text-${c.badgeColor}-700 border border-${c.badgeColor}-200`}>
                            {c.badge}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-[#6B6B6B]">{c.desc}</p>
                        <p className="text-xs text-[#9CA3AF] italic font-medium">Usage: {c.usage}</p>
                      </div>

                      <div className="flex items-center gap-3 border-t border-[#F5F5F0] pt-4">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.cmd);
                            setToast({ show: true, message: `[OK] ✔ Copied: "${c.cmd}"` });
                            setTimeout(() => setToast({ show: false, message: '' }), 2000);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-[#E5E5E0] hover:bg-[#F5F5F0] transition-colors rounded-xl text-xs font-bold text-[#1C1C1E]"
                        >
                          <Copy size={13} />
                          <span>Copy</span>
                        </button>
                        <button
                          onClick={() => {
                            setCmdInput(c.cmd);
                            setActiveTab('terminal');
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-[#E5E5E0] hover:bg-[#F5F5F0] transition-colors rounded-xl text-xs font-bold text-[#1C1C1E]"
                        >
                          <TerminalIcon size={13} />
                          <span>Populate</span>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab('terminal');
                            runCommand(c.cmd.replace(' <job_id>', '').replace(' <url>', ''));
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-[#1C1C1E] text-white hover:bg-[#27272a] transition-all rounded-xl text-xs font-bold"
                        >
                          <Play size={13} />
                          <span>Execute</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'terminal' && (
            <motion.div key="terminal" className="space-y-6">
              <PageSectionHeader
                title="Terminal"
                subtitle="Run scan, rank, tailor, and apply commands"
              />
            <div className="relative flex h-[600px] flex-col overflow-hidden rounded-[1.5rem] border border-[#E5E5E0] bg-white shadow-sm">
              <div className="p-5 border-b border-[#E5E5E0] flex justify-between items-center bg-[#F5F5F0]">
                 <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-[#f59e0b] rounded-full" />
                    <span className="text-[10px] font-mono text-[#57534e] uppercase tracking-[0.2em] font-bold">Career-Ops Output Console</span>
                 </div>
                 <button onClick={() => setLogs([])} className="text-[10px] text-[#6B6B6B] hover:text-[#1C1C1E] transition-colors uppercase tracking-widest font-bold">Flush Buffers</button>
              </div>
              <div id="terminal-logs" className="flex-1 p-8 font-mono text-sm overflow-y-auto whitespace-pre-wrap bg-white text-[#292524] scroll-smooth leading-relaxed select-text cursor-text">
                 {logs.length === 0 && !isExecuting ? (
                   <div className="select-text">
                     <pre className="font-mono text-[10px] sm:text-xs text-[#1C1C1E] mb-6 leading-tight font-bold">
{`   _____                           ____            
  / ___/___ _________  ___  _____ / __ \\____  _____
 / /__ / __ \`/ ___/ _ \\/ _ \\/ ___// / / / __ \\/ ___/
/ /___/ /_/ / /  /  __/  __/ /   / /_/ / /_/ (__  ) 
\\____/\\__,_/_/   \\___/\\___/_/    \\____/ .___/____/  
                                     /_/            
System Initialized — v2.0`}
                     </pre>
                     <div className="text-[#6B6B6B] space-y-2 mb-4">
                       <p><strong className="text-[#57534e]">1. scan --deep</strong> <span className="text-[#9CA3AF]">→</span> Auto-discover new job matches</p>
                       <p><strong className="text-[#57534e]">2. rank --deep</strong> <span className="text-[#9CA3AF]">→</span> Score and rank discovered roles</p>
                       <p><strong className="text-[#57534e]">3. tailor &lt;id&gt; --deep</strong> <span className="text-[#9CA3AF]">→</span> Generate hyper-custom Resumes & Cover Letters</p>
                       <p><strong className="text-[#57534e]">4. apply &lt;id&gt; --deep</strong> <span className="text-[#9CA3AF]">→</span> Automatically apply to role</p>
                       <p><strong className="text-[#57534e]">5. add &lt;url&gt;</strong> <span className="text-[#9CA3AF]">→</span> Scrape & add job to pipeline</p>
                       <br/>
                       <p><strong className="text-[#57534e]">help</strong>        <span className="text-[#9CA3AF]">→</span> View full command reference</p>
                       <br/>
                       <p className="text-[#9CA3AF]"><kbd className="px-1 py-0.5 bg-[#F5F5F0] border border-[#E5E5E0] rounded text-[9px]">↑</kbd> <kbd className="px-1 py-0.5 bg-[#F5F5F0] border border-[#E5E5E0] rounded text-[9px]">↓</kbd> History • <kbd className="px-1 py-0.5 bg-[#F5F5F0] border border-[#E5E5E0] rounded text-[9px]">Ctrl+C</kbd> Clear line</p>
                     </div>
                     <div className="text-[#9CA3AF] italic mt-4">Awaiting input...</div>
                   </div>
                 ) : (
                   <div className="space-y-1">
                     {logs.map((log, i) => (
                      <div key={i} className={`select-text ${log.type === 'stderr' ? 'text-rose-700' : 'text-[#1C1C1E]'}`}>
                          {log.content}
                       </div>
                     ))}
                     {isExecuting && (
                        <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} className="inline-block w-2 h-5 bg-[#1C1C1E] ml-1" />
                     )}
                   </div>
                 )}
              </div>

              <div className="p-5 bg-[#F5F5F0] border-t border-[#E5E5E0]">
                 <div className="flex items-center gap-3">
                    <span className="text-[#1C1C1E] font-bold font-mono">auth@career-ops:~$</span>
                    <form onSubmit={handleCommandSubmit} className="flex-1">
                       <input 
                         type="text"
                         value={cmdInput}
                         onChange={(e) => setCmdInput(e.target.value)}
                         onKeyDown={handleKeyDown}
                         placeholder="scan / apply <id> / help (Ctrl+C to clear)"
                         disabled={isExecuting}
                         className="w-full bg-transparent outline-none border-none text-[#1C1C1E] font-mono placeholder:text-[#6B6B6B] caret-[#1C1C1E] select-text"
                         autoFocus
                       />
                    </form>
                 </div>
              </div>
            </div>
            </motion.div>
          )}

          {activeTab === 'gcc' && (
            <GccCampaignPanel
              campaign={gccCampaign}
              onChange={setGccCampaign}
              onSave={handleSaveGccCampaign}
              onImportHighValue={importHighValueGccFromPipeline}
              highValueCount={(data?.pipeline || []).filter((j: any) => j.gcc_high_value).length}
              isSaving={isSaving}
              saveStatus={saveStatus}
            />
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" className="w-full max-w-5xl space-y-8">
               <PageSectionHeader
                 title="Settings"
                 subtitle="Profile, targeting keywords, resume import, and GitHub automation"
                 actions={
                 <div className="flex items-center gap-3">
                   <button
                     onClick={() => {
                       localStorage.removeItem(`career_ops_onboarding_v2:${session?.user?.email || session?.user?.id || 'default'}`);
                       setWalkthroughStep(0);
                     }}
                     className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-[#6B6B6B] transition-all hover:bg-[#F5F5F0] hover:text-[#1C1C1E]"
                   >
                     <Play size={14} />
                     Restart Tour
                   </button>
                   <button
                     onClick={handleSaveSettings}
                     disabled={isSaving}
                     className={`flex items-center gap-3 rounded-xl px-6 py-3 text-sm font-bold transition-all shadow-sm ${saveStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-[#1C1C1E] text-white hover:bg-[#27272a]'}`}
                   >
                     {saveStatus === 'saving' ? 'Syncing...' : saveStatus === 'success' ? <><CheckCircle2 size={18} /> Profile Locked</> : 'Save Changes'}
                   </button>
                 </div>
                 }
               />

              {/* Masonry layout: prevents tall-right/short-left whitespace gaps */}
              <div className="columns-1 xl:columns-2 gap-5 [column-fill:_balance]">
                 <ConfigSection id="config-security" title="Account Security" icon={<Shield size={18} className="text-[#1C1C1E]" />}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input label="Login Email" value={accountInfo.email} onChange={(v) => setAccountInfo({...accountInfo, email: v})} />
                     <div className="hidden md:block" />
                     <Input label="New Password" type="password" placeholder="Leave empty to keep current" value={accountInfo.password} onChange={(v) => setAccountInfo({...accountInfo, password: v})} />
                     <Input label="Confirm New Password" type="password" value={accountInfo.confirmPassword} onChange={(v) => setAccountInfo({...accountInfo, confirmPassword: v})} />
                   </div>
                 </ConfigSection>

                 <ConfigSection title="Candidate Identity" icon={<LayoutDashboard size={18} className="text-[#1C1C1E]" />}>
                   {/* Profile Completion Indicator */}
                   {(() => {
                     const fields = ['full_name', 'email', 'location', 'phone', 'linkedin'];
                     const filled = fields.filter(f => profileFormData.candidate?.[f]?.trim()).length;
                     const percent = Math.round((filled / fields.length) * 100);
                     return (
                       <div className="mb-5 bg-[#FAFAF8] rounded-2xl p-4 border border-[#E5E5E0]">
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-xs font-bold text-[#1C1C1E] uppercase tracking-wider">Profile Completion</span>
                           <span className={`text-xs font-bold ${percent === 100 ? 'text-emerald-600' : 'text-[#6B6B6B]'}`}>{percent}%</span>
                         </div>
                         <div className="h-2 bg-[#E5E5E0] rounded-full overflow-hidden">
                           <div
                             className={`h-full rounded-full transition-all duration-500 ${percent === 100 ? 'bg-emerald-500' : 'bg-[#1C1C1E]'}`}
                             style={{ width: `${percent}%` }}
                           />
                         </div>
                         <p className="text-[10px] text-[#9CA3AF] mt-2">
                           {percent === 100 ? '✓ All essential fields completed' : `${5 - filled} field${5 - filled === 1 ? '' : 's'} remaining for a complete profile`}
                         </p>
                       </div>
                     );
                   })()}

                   {/* Essential Info Card */}
                   <div className="bg-white rounded-2xl border border-[#E5E5E0] p-4 mb-4">
                     <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F5F5F0]">
                       <div className="w-8 h-8 bg-[#1C1C1E] rounded-lg flex items-center justify-center">
                         <span className="text-white text-xs font-bold">01</span>
                       </div>
                       <span className="text-sm font-bold text-[#1C1C1E]">Essential Information</span>
                       <span className="text-[10px] text-rose-500 font-medium ml-auto">Required</span>
                     </div>

                     <div className="space-y-4">
                       <Input
                         label="Full Name"
                         value={profileFormData.candidate.full_name}
                         onChange={(v) => setProfileFormData({...profileFormData, candidate: {...profileFormData.candidate, full_name: v}})}
                         placeholder="John Doe"
                         required
                       />
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <Input
                           label="Email Address"
                           type="email"
                           value={profileFormData.candidate.email}
                           onChange={(v) => setProfileFormData({...profileFormData, candidate: {...profileFormData.candidate, email: v}})}
                           placeholder="john@example.com"
                           required
                         />
                         <Input
                           label="Phone Number"
                           type="tel"
                           value={profileFormData.candidate.phone}
                           onChange={(v) => setProfileFormData({...profileFormData, candidate: {...profileFormData.candidate, phone: v}})}
                           placeholder="+1 (555) 123-4567"
                         />
                       </div>
                       <Input
                         label="Location"
                         value={profileFormData.candidate.location}
                         onChange={(v) => setProfileFormData({...profileFormData, candidate: {...profileFormData.candidate, location: v}})}
                         placeholder="San Francisco, CA"
                         hint="City, State/Country format"
                       />
                     </div>
                   </div>

                   {/* Online Presence Card */}
                   <div className="bg-white rounded-2xl border border-[#E5E5E0] p-4">
                     <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F5F5F0]">
                       <div className="w-8 h-8 bg-[#6B6B6B] rounded-lg flex items-center justify-center">
                         <span className="text-white text-xs font-bold">02</span>
                       </div>
                       <span className="text-sm font-bold text-[#1C1C1E]">Online Presence</span>
                       <span className="text-[10px] text-[#9CA3AF] font-medium ml-auto">Recommended</span>
                     </div>

                     <div className="space-y-4">
                       <Input
                         label="LinkedIn Profile"
                         value={profileFormData.candidate.linkedin}
                         onChange={(v) => setProfileFormData({...profileFormData, candidate: {...profileFormData.candidate, linkedin: v}})}
                         placeholder="linkedin.com/in/johndoe"
                         hint="Just the path: linkedin.com/in/username"
                       />
                       <Input
                         label="GitHub / Portfolio"
                         value={profileFormData.candidate.github}
                         onChange={(v) => setProfileFormData({...profileFormData, candidate: {...profileFormData.candidate, github: v}})}
                         placeholder="github.com/johndoe or johndoe.com"
                         hint="Used as portfolio link on resume"
                       />
                     </div>
                   </div>

                   {/* Quick Preview */}
                   {profileFormData.candidate.full_name && (
                     <div className="mt-4 bg-[#FAFAF8] rounded-2xl p-4 border border-[#E5E5E0]">
                       <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">Resume Header Preview</p>
                       <div className="text-sm font-bold text-[#1C1C1E]">{profileFormData.candidate.full_name}</div>
                       <div className="text-xs text-[#6B6B6B] mt-1">
                         {[
                           profileFormData.candidate.location,
                           profileFormData.candidate.email,
                           profileFormData.candidate.phone
                         ].filter(Boolean).join(' • ') || 'Add location, email, and phone'}
                       </div>
                       {(profileFormData.candidate.linkedin || profileFormData.candidate.github) && (
                         <div className="text-[10px] text-[#9CA3AF] mt-2">
                           {[
                             profileFormData.candidate.linkedin && `linkedin.com/in/${profileFormData.candidate.linkedin.replace(/^.*\//, '')}`,
                             profileFormData.candidate.github && (profileFormData.candidate.github.includes('/') ? profileFormData.candidate.github : `github.com/${profileFormData.candidate.github}`)
                           ].filter(Boolean).join(' • ')}
                         </div>
                       )}
                     </div>
                   )}
                 </ConfigSection>

                 <ConfigSection title="Resume Import" icon={<Upload size={18} className="text-[#1C1C1E]" />}>
                   <div className="space-y-5">
                     {/* Upload Area - Drop Zone Style */}
                     <div
                       className={`relative border-2 border-dashed rounded-2xl p-6 transition-all duration-200 ${
                         resumeImportStatus === 'uploading'
                           ? 'border-emerald-400 bg-emerald-50'
                           : resumeImportStatus === 'error'
                             ? 'border-rose-400 bg-rose-50'
                             : resumeImportStatus === 'ready'
                               ? 'border-emerald-500 bg-emerald-50'
                               : 'border-[#E5E5E0] hover:border-[#1C1C1E] hover:bg-[#FAFAF8]'
                       }`}
                     >
                       <div className="text-center">
                         <div className={`w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center transition-colors ${
                           resumeImportStatus === 'ready'
                             ? 'bg-emerald-100'
                             : resumeImportStatus === 'error'
                               ? 'bg-rose-100'
                               : 'bg-[#F5F5F0]'
                         }`}>
                           {resumeImportStatus === 'uploading' ? (
                             <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                           ) : resumeImportStatus === 'ready' ? (
                             <CheckCircle2 size={24} className="text-emerald-600" />
                           ) : resumeImportStatus === 'error' ? (
                             <AlertTriangle size={24} className="text-rose-600" />
                           ) : (
                             <Upload size={24} className="text-[#6B6B6B]" />
                           )}
                         </div>

                         <p className="text-sm font-bold text-[#1C1C1E] mb-1">
                           {resumeImportStatus === 'uploading' && 'Analyzing resume...'}
                           {resumeImportStatus === 'ready' && 'Resume analyzed successfully'}
                           {resumeImportStatus === 'error' && 'Import failed'}
                           {resumeImportStatus === 'idle' && 'Upload your resume (PDF or DOCX)'}
                         </p>
                         <p className="text-xs text-[#6B6B6B] mb-4">
                           {resumeImportStatus === 'idle' && 'We\'ll extract name, contact, Experience, and Education — then auto-save (Merge)'}
                           {resumeImportStatus === 'ready' && (
                             <>
                               Found {(resumeImport?.experience || []).length} roles
                               {(resumeImport?.education || []).length
                                 ? `, ${(resumeImport?.education || []).length} education`
                                 : ''}
                               {resumeImport?.candidate?.full_name
                                 ? ` · ${resumeImport.candidate.full_name}`
                                 : ''}
                               {resumeImportMode === 'replace'
                                 ? ' — review preview, then Replace & Save'
                                 : ''}
                             </>
                           )}
                           {resumeImportStatus === 'error' && (resumeImport?.error || 'Unknown error')}
                         </p>

                         {resumeImportStatus !== 'uploading' && (
                           <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1C1C1E] text-white text-xs font-bold rounded-xl hover:bg-[#27272a] transition-colors cursor-pointer">
                             <Upload size={14} />
                             <span>{resumeImportStatus === 'ready' ? 'Upload different resume' : 'Choose file'}</span>
                             <input
                               type="file"
                               accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                               onChange={(e) => {
                                 const f = e.target.files?.[0];
                                if (f) handleResumeImportFile(f);
                                // Allow selecting the same file again (otherwise no change event → no network request)
                                e.currentTarget.value = '';
                               }}
                               className="hidden"
                             />
                           </label>
                         )}
                       </div>
                     </div>

                     {/* Import Mode Selection */}
                     <div className="bg-[#FAFAF8] rounded-2xl p-4 border border-[#E5E5E0]">
                       <div className="flex items-center justify-between mb-3">
                         <span className="text-xs font-bold text-[#1C1C1E] uppercase tracking-wider">Import Mode</span>
                         <span className="text-[10px] text-[#9CA3AF] bg-white px-2 py-1 rounded-lg border border-[#E5E5E0]">
                           {resumeImportMode === 'merge' ? 'Add to existing' : 'Replace all'}
                         </span>
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                         {/* Merge Option */}
                         <button
                           type="button"
                           onClick={() => setResumeImportMode('merge')}
                           className={`p-4 rounded-xl border text-left transition-all ${
                             resumeImportMode === 'merge'
                               ? 'bg-white border-[#1C1C1E] shadow-sm'
                               : 'bg-white border-[#E5E5E0] hover:border-[#1C1C1E]'
                           }`}
                         >
                           <div className="flex items-center gap-2 mb-2">
                             <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                               resumeImportMode === 'merge' ? 'border-[#1C1C1E] bg-[#1C1C1E]' : 'border-[#E5E5E0]'
                             }`}>
                               {resumeImportMode === 'merge' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                             </div>
                             <span className="text-sm font-bold text-[#1C1C1E]">Merge</span>
                           </div>
                           <p className="text-[10px] text-[#6B6B6B] leading-relaxed">
                             Keep existing entries and add new ones from resume. No duplicates. Default — safer.
                           </p>
                         </button>

                         {/* Replace Option */}
                         <button
                           type="button"
                           onClick={() => setResumeImportMode('replace')}
                           className={`p-4 rounded-xl border text-left transition-all ${
                             resumeImportMode === 'replace'
                               ? 'bg-white border-rose-500 shadow-sm'
                               : 'bg-white border-[#E5E5E0] hover:border-rose-400'
                           }`}
                         >
                           <div className="flex items-center gap-2 mb-2">
                             <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                               resumeImportMode === 'replace' ? 'border-rose-500 bg-rose-500' : 'border-[#E5E5E0]'
                             }`}>
                               {resumeImportMode === 'replace' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                             </div>
                             <span className="text-sm font-bold text-[#1C1C1E]">Replace</span>
                           </div>
                           <p className="text-[10px] text-[#6B6B6B] leading-relaxed">
                             Delete all existing entries. Blocked if the parse looks incomplete vs your current profile.
                           </p>
                         </button>
                       </div>
                     </div>

                     {/* Action Button */}
                    {resumeImportStatus === 'ready' && (
                      <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                            <CheckCircle2 size={16} className="text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-emerald-800">Resume parsed — review before replace</p>
                            <p className="text-xs text-emerald-600 mt-0.5">
                              {(resumeImport?.experience || []).length} roles
                              {(resumeImport?.education || []).length
                                ? ` · ${(resumeImport?.education || []).length} education`
                                : ''}
                              {resumeImport?.candidate?.full_name
                                ? ` · ${resumeImport.candidate.full_name}`
                                : ''}
                              . Merge auto-saves on upload; Replace requires confirmation below.
                            </p>
                            {(resumeImport?.experience || []).length > 0 && (
                              <ul className="mt-2 text-[10px] text-emerald-800 space-y-0.5 max-h-24 overflow-y-auto">
                                {(resumeImport.experience || []).slice(0, 8).map((job: any, idx: number) => (
                                  <li key={idx}>
                                    {(job.role || 'Role') + (job.company ? ` @ ${job.company}` : '')}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* Replace/Merge Toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-1 mb-3">
                          <button
                            type="button"
                            onClick={() => setResumeImportMode('merge')}
                            className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${
                              resumeImportMode === 'merge'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Merge/Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setResumeImportMode('replace')}
                            className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${
                              resumeImportMode === 'replace'
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            Replace All
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={applyResumeImport}
                          disabled={isSaving}
                          className={`w-full px-4 py-3 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 ${
                            resumeImportMode === 'replace'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                        >
                          <Upload size={16} />
                          {resumeImportMode === 'replace' ? 'Replace & Save' : 'Merge & Save'}
                        </button>
                         {!!resumeImport?.raw_text_preview && (
                           <details className="mt-3 border-t border-emerald-200 pt-3">
                             <summary className="cursor-pointer text-xs font-bold text-emerald-700 flex items-center gap-2">
                               <FileText size={12} />
                               Preview extracted text
                             </summary>
                             <pre className="mt-3 text-[10px] whitespace-pre-wrap text-emerald-800 font-mono bg-emerald-100/50 rounded-xl p-3 max-h-40 overflow-y-auto">
                               {resumeImport.raw_text_preview}
                             </pre>
                           </details>
                         )}
                       </div>
                     )}
                   </div>
                 </ConfigSection>

                 <ConfigSection title="Experience" icon={<Briefcase size={18} className="text-[#1C1C1E]" />}>
                   <div className="space-y-4">
                     <div className="max-h-[min(560px,calc(100vh-18rem))] overflow-y-auto pr-2 space-y-4">
                     {(profileFormData.experience || []).map((exp: any, idx: number) => (
                       <div key={idx} className="p-5 bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl">
                         <div className="flex items-start justify-between gap-4 mb-4">
                           <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                             Role {idx + 1}
                           </div>
                           <button
                             onClick={() =>
                               setProfileFormData({
                                 ...profileFormData,
                                 experience: (profileFormData.experience || []).filter((_: any, i: number) => i !== idx),
                               })
                             }
                             className="text-[10px] font-bold uppercase tracking-widest text-rose-700 hover:underline underline-offset-4"
                           >
                             Remove
                           </button>
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                           <Input
                             label="Company"
                             value={exp.company || ''}
                             onChange={(v) => {
                               const next = [...(profileFormData.experience || [])];
                               next[idx] = { ...(next[idx] || {}), company: v };
                               setProfileFormData({ ...profileFormData, experience: next });
                             }}
                           />
                           <Input
                             label="Role"
                             value={exp.role || ''}
                             onChange={(v) => {
                               const next = [...(profileFormData.experience || [])];
                               next[idx] = { ...(next[idx] || {}), role: v };
                               setProfileFormData({ ...profileFormData, experience: next });
                             }}
                           />
                         </div>
                         <div className="grid grid-cols-2 gap-4 mt-4">
                           <Input
                             label="Period (e.g., 2022–Present)"
                             value={exp.period || ''}
                             onChange={(v) => {
                               const next = [...(profileFormData.experience || [])];
                               next[idx] = { ...(next[idx] || {}), period: v };
                               setProfileFormData({ ...profileFormData, experience: next });
                             }}
                           />
                           <Input
                             label="Location (optional)"
                             value={exp.location || ''}
                             onChange={(v) => {
                               const next = [...(profileFormData.experience || [])];
                               next[idx] = { ...(next[idx] || {}), location: v };
                               setProfileFormData({ ...profileFormData, experience: next });
                             }}
                           />
                         </div>

                         <div className="mt-4">
                           <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 block">
                             Bullets (one per line)
                           </label>
                           <textarea
                             rows={5}
                             value={(Array.isArray(exp.bullets) ? exp.bullets : []).join('\n')}
                             onChange={(e) => {
                               const next = [...(profileFormData.experience || [])];
                               const bullets = e.target.value
                                 .split('\n')
                                 .map((s) => s.trim())
                                 .filter(Boolean);
                               next[idx] = { ...(next[idx] || {}), bullets };
                               setProfileFormData({ ...profileFormData, experience: next });
                             }}
                             className="w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl p-4 outline-none focus:border-[#1C1C1E] transition-all text-sm font-medium leading-relaxed"
                           />
                         </div>
                       </div>
                     ))}
                     </div>

                     <button
                       onClick={() =>
                         setProfileFormData({
                           ...profileFormData,
                           experience: [
                             ...(profileFormData.experience || []),
                             { company: '', role: '', period: '', bullets: [] },
                           ],
                         })
                       }
                       className="w-full px-6 py-3 rounded-2xl border border-[#E5E5E0] bg-white hover:bg-[#F5F5F0] transition-colors text-sm font-bold text-[#1C1C1E]"
                     >
                       Add Experience
                     </button>
                   </div>
                 </ConfigSection>

                 <ConfigSection title="Education" icon={<FileText size={18} className="text-[#1C1C1E]" />}>
                   <div className="space-y-4">
                     <div className="max-h-[min(480px,calc(100vh-20rem))] overflow-y-auto pr-2 space-y-4">
                     {(profileFormData.education || []).map((edu: any, idx: number) => (
                       <div key={idx} className="p-5 bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl">
                         <div className="flex items-start justify-between gap-4 mb-4">
                           <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
                             Entry {idx + 1}
                           </div>
                           <button
                             onClick={() =>
                               setProfileFormData({
                                 ...profileFormData,
                                 education: (profileFormData.education || []).filter((_: any, i: number) => i !== idx),
                               })
                             }
                             className="text-[10px] font-bold uppercase tracking-widest text-rose-700 hover:underline underline-offset-4"
                           >
                             Remove
                           </button>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                           <Input
                             label="School"
                             value={edu.school || ''}
                             onChange={(v) => {
                               const next = [...(profileFormData.education || [])];
                               next[idx] = { ...(next[idx] || {}), school: v };
                               setProfileFormData({ ...profileFormData, education: next });
                             }}
                           />
                           <Input
                             label="Degree"
                             value={edu.degree || ''}
                             onChange={(v) => {
                               const next = [...(profileFormData.education || [])];
                               next[idx] = { ...(next[idx] || {}), degree: v };
                               setProfileFormData({ ...profileFormData, education: next });
                             }}
                           />
                         </div>
                         <div className="grid grid-cols-2 gap-4 mt-4">
                           <Input
                             label="Period (e.g., 2016–2020)"
                             value={edu.period || ''}
                             onChange={(v) => {
                               const next = [...(profileFormData.education || [])];
                               next[idx] = { ...(next[idx] || {}), period: v };
                               setProfileFormData({ ...profileFormData, education: next });
                             }}
                           />
                           <Input
                             label="Location (optional)"
                             value={edu.location || ''}
                             onChange={(v) => {
                               const next = [...(profileFormData.education || [])];
                               next[idx] = { ...(next[idx] || {}), location: v };
                               setProfileFormData({ ...profileFormData, education: next });
                             }}
                           />
                         </div>
                       </div>
                     ))}
                     </div>
                     <button
                       onClick={() =>
                         setProfileFormData({
                           ...profileFormData,
                           education: [...(profileFormData.education || []), { school: '', degree: '', period: '' }],
                         })
                       }
                       className="w-full px-6 py-3 rounded-2xl border border-[#E5E5E0] bg-white hover:bg-[#F5F5F0] transition-colors text-sm font-bold text-[#1C1C1E]"
                     >
                       Add Education
                     </button>
                   </div>
                 </ConfigSection>

                 <ConfigSection id="config-narrative" title="Core Narrative" icon={<FileText size={18} className="text-[#1C1C1E]" />}>
                    <Input label="Strategic Headline" value={profileFormData.narrative.headline} onChange={(v) => setProfileFormData({...profileFormData, narrative: {...profileFormData.narrative, headline: v}})} />
                    <div>
                       <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2 block">Executive Story</label>
                       <textarea
                         rows={4}
                         value={profileFormData.narrative.exit_story}
                         onChange={(e) => setProfileFormData({...profileFormData, narrative: {...profileFormData.narrative, exit_story: e.target.value}})}
                         className="w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl p-4 outline-none focus:border-[#1C1C1E] transition-all text-sm font-medium leading-relaxed"
                       />
                    </div>
                 </ConfigSection>

                 <ConfigSection id="config-targeting" title="Targeting Parameters" icon={<Search size={18} className="text-[#1C1C1E]" />}>
                    <div className="space-y-6">
                      <TagInput
                        label="Targeted Roles & Skills"
                        placeholder="Type a role or skill, press Enter..."
                        tags={profileFormData.targeting_keywords?.positive ?? []}
                        inputValue={tagInputPositive}
                        onInputChange={setTagInputPositive}
                        onAdd={(tag) => setProfileFormData({...profileFormData, targeting_keywords: {...profileFormData.targeting_keywords, positive: [...(profileFormData.targeting_keywords?.positive ?? []), tag]}})}
                        onRemove={(i) => setProfileFormData({...profileFormData, targeting_keywords: {...profileFormData.targeting_keywords, positive: (profileFormData.targeting_keywords?.positive ?? []).filter((_: string, idx: number) => idx !== i)}})}
                        color="emerald"
                      />
                      <div className="pt-6 border-t border-[#E5E5E0]">
                        <TagInput
                          label="Exclusion Keywords"
                          placeholder="Type a keyword to exclude, press Enter..."
                          tags={profileFormData.targeting_keywords?.negative ?? []}
                          inputValue={tagInputNegative}
                          onInputChange={setTagInputNegative}
                          onAdd={(tag) => setProfileFormData({...profileFormData, targeting_keywords: {...profileFormData.targeting_keywords, negative: [...(profileFormData.targeting_keywords?.negative ?? []), tag]}})}
                          onRemove={(i) => setProfileFormData({...profileFormData, targeting_keywords: {...profileFormData.targeting_keywords, negative: (profileFormData.targeting_keywords?.negative ?? []).filter((_: string, idx: number) => idx !== i)}})}
                          color="rose"
                        />
                      </div>
                    </div>
                 </ConfigSection>

                 <ConfigSection title="Portal Sources (Per User)" icon={<TerminalIcon size={18} className="text-[#1C1C1E]" />}>
                    <TagInput
                      label="Enabled Portals"
                      placeholder="linkedin, naukri, indeed, instahyre, flexiple..."
                      tags={profileFormData.search?.portals || []}
                      inputValue={tagInputPortals}
                      onInputChange={setTagInputPortals}
                      onAdd={(tag) => setProfileFormData({
                        ...profileFormData,
                        search: {
                          ...(profileFormData.search || {}),
                          portals: [...(profileFormData.search?.portals || []), tag.toLowerCase()]
                        }
                      })}
                      onRemove={(i) => setProfileFormData({
                        ...profileFormData,
                        search: {
                          ...(profileFormData.search || {}),
                          portals: (profileFormData.search?.portals || []).filter((_: string, idx: number) => idx !== i)
                        }
                      })}
                      color="stone"
                    />
                    <p className="text-xs text-[#6B6B6B] font-medium">
                      Multi-tenant: every user should configure their own basics once in Settings.
                    </p>
                 </ConfigSection>

                 <ConfigSection title="GitHub Automation Integration" icon={<TerminalIcon size={18} className="text-[#1C1C1E]" />}>
                    <div className="space-y-4">
                      <Input
                        label="GitHub Personal Access Token (PAT)"
                        type="password"
                        value={profileFormData.github_settings?.pat || ''}
                        onChange={(v) => setProfileFormData({
                          ...profileFormData,
                          github_settings: { ...(profileFormData.github_settings || {}), pat: v }
                        })}
                        placeholder="ghp_..."
                        hint="Create a classic PAT with workflow scope, paste it here, then retry scan/tailor --deep. Missing PAT shows a clear toast — not a raw stderr dump."
                      />
                      <Input
                        label="GitHub Repository Name"
                        value={profileFormData.github_settings?.repo || ''}
                        onChange={(v) => setProfileFormData({
                          ...profileFormData,
                          github_settings: { ...(profileFormData.github_settings || {}), repo: v }
                        })}
                        placeholder="username/repository"
                        hint="E.g., UGilfoyle/career-ops"
                      />
                    </div>
                 </ConfigSection>
               </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col h-[calc(100vh-8rem)] w-full max-w-5xl bg-white border border-[#E5E5E0] rounded-[2rem] overflow-hidden shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#E5E5E0] px-6 py-4 bg-[#FAFAF8]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1C1C1E] flex items-center justify-center text-white">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#1C1C1E]">Career Copilot</h2>
                    <p className="text-[11px] font-medium text-[#6B6B6B]">Always synced with your profile & target goals</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider">Ready to assist</span>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-[#FAFAF8]/30">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#1C1C1E] text-white shadow-sm font-medium'
                          : 'bg-white text-[#1C1C1E] border border-[#E5E5E0] shadow-sm whitespace-pre-wrap'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white text-[#1C1C1E] border border-[#E5E5E0] rounded-2xl px-4 py-3 shadow-sm flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-[#1C1C1E] animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="flex h-2 w-2 rounded-full bg-[#1C1C1E] animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="flex h-2 w-2 rounded-full bg-[#1C1C1E] animate-bounce"></span>
                    </div>
                  </div>
                )}
                
                <div ref={chatBottomRef} />
              </div>

              {/* Suggestions Panel */}
              {chatMessages.length === 1 && (
                <div className="px-6 py-3 border-t border-[#E5E5E0]/60 bg-[#FAFAF8]/50">
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">Suggested Prompts</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Draft a LinkedIn message to a recruiter at Microsoft",
                      "Give me a mock interview question for my target roles",
                      "Identify potential skill gaps based on my profile",
                      "Suggest improvements for my resume exit story"
                    ].map((promptText) => (
                      <button
                        key={promptText}
                        type="button"
                        onClick={() => handleSendChatMessage(promptText)}
                        className="text-xs font-bold text-[#1C1C1E] bg-white border border-[#E5E5E0] hover:border-[#1C1C1E] hover:bg-[#FAFAF8] px-3 py-2 rounded-xl transition-all shadow-sm"
                      >
                        {promptText}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Form */}
              <div className="border-t border-[#E5E5E0] px-6 py-4 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChatMessage();
                  }}
                  className="flex items-center gap-3"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Career Copilot anything about your career..."
                    disabled={chatLoading}
                    className="flex-1 bg-[#FAFAF8] border border-[#E5E5E0] rounded-xl px-4 py-3 text-sm text-[#1C1C1E] placeholder:text-[#9CA3AF] outline-none focus:border-[#1C1C1E] transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="h-11 w-11 shrink-0 rounded-xl bg-[#1C1C1E] hover:bg-[#27272a] text-white flex items-center justify-center transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Job Details Modal */}
      <AnimatePresence>
        {jobDetailsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[90] flex items-center justify-center p-6"
            onClick={() => setJobDetailsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="w-full max-w-4xl bg-white rounded-[2rem] border border-[#E5E5E0] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[#E5E5E0] flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-mono text-[#9CA3AF] uppercase tracking-[0.2em]">Job details</div>
                  <div className="text-xl font-bold text-[#1C1C1E] mt-1 truncate">
                    {jobDetails?.company ? `${jobDetails.company} · ${jobDetails.title}` : 'Loading…'}
                  </div>
                  {jobDetails?.url && (
                    <a
                      href={jobDetails.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[#1C1C1E] underline underline-offset-4"
                    >
                      <ExternalLink size={14} />
                      Open posting
                    </a>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-[#9CA3AF]">
                    {jobDetails?.posted_at ? (
                      <span>
                        Posted {formatRelativeTime(jobDetails.posted_at)}
                        {jobDetails.posted_confidence ? ` (${jobDetails.posted_confidence})` : ''}
                      </span>
                    ) : jobDetails && !jobDetailsLoading ? (
                      <span>Posted date unknown{jobDetails.posted_reason ? ` · ${jobDetails.posted_reason}` : ''}</span>
                    ) : null}
                    {jobDetails?.created_at && (
                      <span>Added {formatRelativeTime(jobDetails.created_at)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setJobDetailsOpen(false)}
                  className="p-2 rounded-xl hover:bg-[#F5F5F0] transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {jobDetailsLoading && (
                  <div className="text-sm font-medium text-[#6B6B6B]">Loading job description…</div>
                )}
                {jobDetailsError && (
                  <div className="text-sm font-bold text-rose-700">Error: {jobDetailsError}</div>
                )}
                {!jobDetailsLoading && !jobDetailsError && (
                  <>
                    <div className="text-[10px] font-mono text-[#9CA3AF] uppercase tracking-[0.2em] mb-3">
                      Job description
                    </div>
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#1C1C1E]">
                      {jobDetails?.jd_text || 'No JD captured yet. Run Tailor to scrape and persist it.'}
                    </pre>
                  </>
                )}
              </div>

              {!jobDetailsLoading && !jobDetailsError && jobDetails && (
                <div className="p-6 bg-[#FAFAF8] border-t border-[#E5E5E0] flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setJobDetailsOpen(false);
                      openInStudio({
                        jobId: Number(jobDetails.id),
                        company: jobDetails.company,
                        title: jobDetails.title,
                        score: jobDetails.score,
                        ats_content_score: jobDetails.ats_content_score ?? null,
                      });
                    }}
                    className="px-5 py-2.5 bg-white border border-[#E5E5E0] text-[#1C1C1E] rounded-xl font-bold text-xs hover:bg-[#F5F5F0] transition-all inline-flex items-center gap-2"
                  >
                    <Sparkles size={14} />
                    Open in Studio
                  </button>
                  <button
                    onClick={() => { setJobDetailsOpen(false); setActiveTab('terminal'); void requestTailor(jobDetails.id); }}
                    className="px-5 py-2.5 bg-[#1C1C1E] text-white rounded-xl font-bold text-xs hover:bg-[#27272a] transition-all"
                  >
                    Tailor
                  </button>
                  <button
                    onClick={() => { setJobDetailsOpen(false); setActiveTab('terminal'); runCommand(`apply ${jobDetails.id} --deep`); }}
                    className="px-5 py-2.5 bg-white border border-[#E5E5E0] text-[#1C1C1E] rounded-xl font-bold text-xs hover:bg-[#F5F5F0] transition-all"
                  >
                    Apply (Auto)
                  </button>
                  <button
                    onClick={() => { setJobDetailsOpen(false); handleMarkApplied(Number(jobDetails.id)); }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all"
                  >
                    Mark Applied
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmOpen && deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[95] flex items-center justify-center p-4 sm:p-6"
            onClick={() => !deleteLoading && setDeleteConfirmOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-3xl border border-rose-200 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 bg-gradient-to-r from-rose-50 to-white border-b border-rose-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
                    <AlertTriangle size={24} className="text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1C1C1E] text-lg">Delete Job?</h3>
                    <p className="text-xs text-[#6B6B6B]">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-sm text-[#6B6B6B] mb-4">
                  You are about to delete:
                </p>
                <div className="bg-[#FAFAF8] rounded-2xl p-4 border border-[#E5E5E0]">
                  <div className="font-bold text-[#1C1C1E] mb-1">{deleteTarget.company}</div>
                  <div className="text-xs text-[#6B6B6B]">{deleteTarget.title}</div>
                </div>
                <p className="text-xs text-[#9CA3AF] mt-4">
                  This deletes the job record (and application row, if present) plus any stored resumes, cover letters, and job description for this posting.
                </p>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-[#E5E5E0] flex gap-3">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-3 rounded-xl border border-[#E5E5E0] text-[#6B6B6B] font-bold text-sm hover:bg-[#F5F5F0] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteJob}
                  disabled={deleteLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stale / repost / ancient posting confirm before tailor */}
      <AnimatePresence>
        {staleTailorOpen && staleTailorTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[95] flex items-center justify-center p-4 sm:p-6"
            onClick={cancelStaleTailor}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-3xl border border-amber-200 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                    <Clock size={24} className="text-amber-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1C1C1E] text-lg">
                      {staleTailorTarget.analysis?.severity === 'ancient'
                        ? 'Job posting looks ~1 year old'
                        : staleTailorTarget.analysis?.possible_repost
                          ? 'Possible repost — check history'
                          : 'Job posting is 1 month or older'}
                    </h3>
                    <p className="text-xs text-[#6B6B6B]">
                      {staleTailorTarget.ageDays != null
                        ? `Posted ${staleTailorTarget.ageDays} day${staleTailorTarget.ageDays === 1 ? '' : 's'} ago`
                        : 'Posting age unclear'}
                      {staleTailorTarget.ageDays != null && staleTailorTarget.ageDays >= STALE_POSTING_DAYS
                        ? ` (≥ ${STALE_POSTING_DAYS} days)`
                        : ''}
                      {staleTailorTarget.ageDays != null && staleTailorTarget.ageDays >= ANCIENT_POSTING_DAYS
                        ? ` · ~${(staleTailorTarget.ageDays / 365).toFixed(1)} years`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm text-[#6B6B6B] mb-4">
                  {staleTailorTarget.analysis?.possible_repost
                    ? 'History suggests this role may have been live much longer (or reposted). Generate resume & cover letter anyway?'
                    : 'This job looks old. Do you still want to create the resume and cover letter?'}
                </p>
                <div className="bg-[#FAFAF8] rounded-2xl p-4 border border-[#E5E5E0]">
                  <div className="font-bold text-[#1C1C1E] mb-1">{staleTailorTarget.company}</div>
                  <div className="text-xs text-[#6B6B6B]">{staleTailorTarget.title}</div>
                  <div className="text-[10px] text-[#9CA3AF] mt-2 uppercase tracking-wider font-bold">
                    {staleTailorTarget.posted_at
                      ? `Posted ${formatRelativeTime(staleTailorTarget.posted_at)}`
                      : 'Posted date unknown'}
                  </div>
                  {staleTailorTarget.analysis?.first_seen_at
                    && staleTailorTarget.analysis.first_seen_at !== staleTailorTarget.posted_at && (
                    <div className="text-[10px] text-amber-700 mt-1 font-semibold">
                      First seen {formatRelativeTime(staleTailorTarget.analysis.first_seen_at)}
                      {staleTailorTarget.analysis.first_seen_days != null
                        ? ` (${staleTailorTarget.analysis.first_seen_days}d history)`
                        : ''}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-[#9CA3AF] mt-3">
                  Full check is also printed in the Terminal tab.
                </p>
              </div>

              <div className="p-4 border-t border-[#E5E5E0] flex gap-3">
                <button
                  type="button"
                  onClick={cancelStaleTailor}
                  className="flex-1 px-4 py-3 rounded-xl border border-[#E5E5E0] text-[#6B6B6B] font-bold text-sm hover:bg-[#F5F5F0] transition-colors"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={confirmStaleTailor}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#1C1C1E] text-white font-bold text-sm hover:bg-[#27272a] transition-colors flex items-center justify-center gap-2"
                >
                  <FileText size={16} />
                  <span>Yes — generate resume</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clear entire pipeline (bulk delete) */}
      <AnimatePresence>
        {clearPipelineOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[95] flex items-center justify-center p-4 sm:p-6"
            onClick={() => !clearPipelineLoading && setClearPipelineOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-3xl border border-rose-200 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 bg-gradient-to-r from-rose-50 to-white border-b border-rose-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
                    <Trash2 size={22} className="text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#1C1C1E] text-lg">Clear pipeline</h3>
                    <p className="text-xs text-[#6B6B6B]">One request — removes jobs from the database</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-[#6B6B6B]">
                  Choose what to remove. Application-tracked jobs are never included.
                </p>
                {pipelineFilterActive ? (
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer rounded-2xl border border-[#E5E5E0] p-4 hover:bg-[#FAFAF8] has-[:checked]:border-rose-300 has-[:checked]:bg-rose-50/40">
                      <input
                        type="radio"
                        name="clear-pipeline-scope"
                        className="mt-1"
                        checked={clearPipelineScope === 'visible'}
                        onChange={() => setClearPipelineScope('visible')}
                      />
                      <span>
                        <span className="font-bold text-[#1C1C1E]">Visible rows only</span>
                        <span className="block text-xs text-[#6B6B6B] mt-1">
                          Delete {pipelineFiltered} job{pipelineFiltered === 1 ? '' : 's'} matching your search ({pipelineTotal} total in pipeline).
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer rounded-2xl border border-[#E5E5E0] p-4 hover:bg-[#FAFAF8] has-[:checked]:border-rose-300 has-[:checked]:bg-rose-50/40">
                      <input
                        type="radio"
                        name="clear-pipeline-scope"
                        className="mt-1"
                        checked={clearPipelineScope === 'all'}
                        onChange={() => setClearPipelineScope('all')}
                      />
                      <span>
                        <span className="font-bold text-[#1C1C1E]">Entire pipeline</span>
                        <span className="block text-xs text-[#6B6B6B] mt-1">
                          Delete all {pipelineTotal} job{pipelineTotal === 1 ? '' : 's'} (ignores search).
                        </span>
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="bg-[#FAFAF8] rounded-2xl p-4 border border-[#E5E5E0] text-sm text-[#57534e]">
                    This will delete <strong className="text-[#1C1C1E]">{pipelineTotal}</strong> pipeline job
                    {pipelineTotal === 1 ? '' : 's'} and any stored JDs / tailored assets for those rows.
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-[#E5E5E0] flex gap-3">
                <button
                  type="button"
                  onClick={() => setClearPipelineOpen(false)}
                  disabled={clearPipelineLoading}
                  className="flex-1 px-4 py-3 rounded-xl border border-[#E5E5E0] text-[#6B6B6B] font-bold text-sm hover:bg-[#F5F5F0] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearPipeline}
                  disabled={
                    clearPipelineLoading ||
                    (clearPipelineScope === 'visible' && pipelineFiltered === 0) ||
                    (clearPipelineScope === 'all' && pipelineTotal === 0)
                  }
                  className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clearPipelineLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Deleting…</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[100] bg-[#1C1C1E] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10"
          >
            <CheckCircle2 size={20} className="text-[#f59e0b]" />
            <span className="text-sm font-bold tracking-wide">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Walkthrough Overlay */}
      <AnimatePresence>
        {walkthroughStep !== null && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
            {/* Spotlight Hole */}
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-all duration-500"
              style={{
                clipPath: spotlightRect 
                  ? `polygon(0% 0%, 0% 100%, ${spotlightRect.left - 10}px 100%, ${spotlightRect.left - 10}px ${spotlightRect.top - 10}px, ${spotlightRect.left + spotlightRect.width + 10}px ${spotlightRect.top - 10}px, ${spotlightRect.left + spotlightRect.width + 10}px ${spotlightRect.top + spotlightRect.height + 10}px, ${spotlightRect.left - 10}px ${spotlightRect.top + spotlightRect.height + 10}px, ${spotlightRect.left - 10}px 100%, 100% 100%, 100% 0%)`
                  : 'none'
              }}
            />

            <div className="absolute inset-0 flex items-center justify-center p-6">
              <motion.div
                key={walkthroughStep}
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[2rem] border border-[#E5E5E0] shadow-2xl max-w-md w-full p-8 relative pointer-events-auto transition-all duration-500 max-h-[calc(100vh-2rem)] overflow-y-auto"
                style={spotlightRect ? {
                    position: 'absolute',
                    top: Math.min(window.innerHeight - 480, Math.max(20, spotlightRect.top + spotlightRect.height + 20)),
                    left: Math.min(window.innerWidth - 440, Math.max(20, spotlightRect.left))
                } : {}}
              >
                <div className="absolute top-0 right-0 p-5">
                  <button onClick={completeOnboarding} className="text-[#9CA3AF] hover:text-[#1C1C1E] transition-colors">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Skip Tour</span>
                  </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                    Step {walkthroughStep + 1} of {steps.length}
                  </span>
                  <div className="flex-1 h-1 bg-[#F5F5F0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1C1C1E] transition-all duration-300"
                      style={{ width: `${((walkthroughStep + 1) / steps.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <div className="h-12 w-12 bg-gradient-to-br from-[#1C1C1E] to-[#44403c] rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-black/10">
                    <div className="text-white">{steps[walkthroughStep].icon}</div>
                  </div>

                  <h2 className="text-xl font-bold text-[#1C1C1E] mb-3 tracking-tight leading-tight">{steps[walkthroughStep].title}</h2>
                  <p className="text-[#6B6B6B] leading-relaxed text-sm">{steps[walkthroughStep].content}</p>
                </div>

                <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#F5F5F0]">
                  <div className="flex gap-1.5">
                    {steps.map((_, s) => (
                      <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${walkthroughStep === s ? 'bg-[#1C1C1E] w-6' : 'bg-[#E5E5E0] w-1.5'}`} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {walkthroughStep > 0 && (
                      <button
                        onClick={() => setWalkthroughStep(walkthroughStep - 1)}
                        className="px-4 py-2.5 text-[#6B6B6B] hover:text-[#1C1C1E] rounded-xl font-bold text-xs transition-colors"
                      >
                        Back
                      </button>
                    )}
                    <button
                      onClick={() => walkthroughStep < steps.length - 1 ? setWalkthroughStep(walkthroughStep + 1) : completeOnboarding()}
                      className="px-5 py-2.5 bg-[#1C1C1E] text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-[#27272a] transition-all shadow-lg shadow-black/10"
                    >
                      {walkthroughStep === steps.length - 1 ? 'Get Started' : 'Next'}
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({
  id,
  icon,
  label,
  active,
  collapsed,
  onClick,
  badge,
}: {
  id?: string;
  icon: any;
  label: string;
  active: boolean;
  collapsed?: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      title={collapsed ? (badge ? `${label} (${badge})` : label) : undefined}
      onClick={onClick}
      className={`w-full flex items-center rounded-xl transition-all ${
        collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
      } ${active ? 'bg-[#1C1C1E] text-white font-bold shadow-md' : 'text-[#6B6B6B] hover:text-[#1C1C1E] hover:bg-white/50'}`}
    >
      <span className="relative shrink-0">
        {icon}
        {collapsed && badge && !active ? (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#F5F5F0]" aria-hidden />
        ) : null}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-sm text-left">{label}</span>
          {badge ? (
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                active
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {badge}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
}

function NavItemSoon({ id, icon, label, active, collapsed, onClick }: { id?: string, icon: any, label: string, active: boolean, collapsed?: boolean, onClick: () => void }) {
  return (
    <button
      id={id}
      type="button"
      title={collapsed ? `${label} (coming soon)` : undefined}
      onClick={onClick}
      className={`relative w-full flex items-center rounded-xl transition-all ${
        collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
      } ${active ? 'bg-[#1C1C1E] text-white font-bold shadow-md' : 'text-[#6B6B6B] hover:text-[#1C1C1E] hover:bg-white/50'}`}
    >
      <span className="relative shrink-0">
        {icon}
        {collapsed && !active && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#F5F5F0]" aria-hidden />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left text-sm">{label}</span>
          {!active && (
            <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800">
              Soon
            </span>
          )}
        </>
      )}
    </button>
  );
}

function StatCard({ icon, label, value, color = 'stone' }: { icon: any, label: string, value: any, color?: 'stone' | 'emerald' | 'blue' | 'amber' | 'purple' }) {
  const colorClasses = {
    stone: '#1C1C1E',
    emerald: '#10B981',
    blue: '#3B82F6',
    amber: '#F59E0B',
    purple: '#8B5CF6'
  };

  return (
    <div className="bg-white border border-[#E5E5E0] rounded-2xl p-6 hover:shadow-md hover:border-[#D4D4CE] transition-all duration-200 cursor-default">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: colorClasses[color] }}>
          {icon}
        </div>
        <span className="text-[10px] font-semibold tracking-widest uppercase text-[#9CA3AF]">{label}</span>
      </div>
      <div className="mt-4">
        <span className="text-[36px] font-bold text-[#1A1A1A] leading-none">{value}</span>
      </div>
    </div>
  );
}

function ConfigSection({ id, title, icon, children }: { id?: string, title: string, icon: any, children: React.ReactNode }) {
  return (
    <div id={id} className="mb-5 break-inside-avoid h-fit bg-white border border-[#E5E5E0] rounded-[1.75rem] p-4 space-y-3 scroll-mt-10">
      <h3 className="font-bold text-lg flex items-center gap-3 text-[#1C1C1E] border-b border-[#F5F5F0] pb-3">{icon} {title}</h3>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
  required
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest block pl-1">
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {hint && <span className="text-[9px] text-[#9CA3AF] italic">{hint}</span>}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-[#FAFAF8]/50 border rounded-2xl p-4 outline-none focus:border-[#1C1C1E] transition-all text-sm font-bold text-[#1C1C1E] ${
          value?.trim() ? 'border-[#E5E5E0]' : required ? 'border-rose-200 focus:border-rose-400' : 'border-[#E5E5E0]'
        }`}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function TagInput({ label, tags, inputValue, onInputChange, onAdd, onRemove, placeholder, color = 'stone' }: {
  label: string;
  tags: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder?: string;
  color?: 'emerald' | 'rose' | 'stone';
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const tagColors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    stone: 'bg-stone-100 text-stone-700 border-stone-200',
  };

  const commit = () => {
    const val = inputValue.trim();
    if (val && !tags.includes(val)) {
      onAdd(val);
    }
    onInputChange('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest block pl-1">{label}</label>
      <div
        className="min-h-[52px] w-full bg-[#FAFAF8]/50 border border-[#E5E5E0] rounded-2xl p-3 flex flex-wrap gap-2 items-center cursor-text focus-within:border-[#1C1C1E] transition-all"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <motion.span
            key={tag + i}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${tagColors[color]}`}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={11} />
            </button>
          </motion.span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            // Support pasting comma-separated values
            const val = e.target.value;
            if (val.includes(',')) {
              val.split(',').map(s => s.trim()).filter(Boolean).forEach(t => {
                if (!tags.includes(t)) onAdd(t);
              });
              onInputChange('');
            } else {
              onInputChange(val);
            }
          }}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder={tags.length === 0 ? placeholder : '+ Add more'}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm font-bold text-[#1C1C1E] placeholder:text-[#9CA3AF]/60"
        />
      </div>
      <p className="text-[10px] text-[#9CA3AF] pl-1">Press <kbd className="px-1 py-0.5 bg-[#F5F5F0] border border-[#E5E5E0] rounded text-[9px]">Enter</kbd> or <kbd className="px-1 py-0.5 bg-[#F5F5F0] border border-[#E5E5E0] rounded text-[9px]">,</kbd> to add a tag</p>
    </div>
  );
}
