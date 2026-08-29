'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import dynamic from 'next/dynamic';
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
  Target,
  Mail,
  Loader2,
  Menu,
  GraduationCap,
  Link2,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut, useSession } from 'next-auth/react';
import {
  Modal as AntdModal,
  Drawer as AntdDrawer,
  Tag as AntdTag,
  Badge as AntdBadge,
  Button as AntdButton,
  Tooltip as AntdTooltip,
} from 'antd';
import { PageSectionHeader, AiScoreBadge } from './PageSectionHeader';
import { JobAvatar } from './JobAvatar';
import ProPaywall, { type PendingPayment } from './ProPaywall';
import { defaultGccCampaign, type GccCampaign } from './gcc-campaign';
import { OutreachDraftModal, type OutreachTarget } from './OutreachDraftModal';
import {
  EngagementIntelModal,
  type EngagementIntelTarget,
} from './EngagementIntelModal';
import { PipelineStudioView } from './PipelineStudioView';
import { CommandPaletteModal } from './CommandPaletteModal';
import { MultiTerminalPanel } from './MultiTerminalPanel';
import { MarkdownMessage } from './MarkdownMessage';
import { ONBOARDING_STORAGE_KEY, DASHBOARD_TOUR_STEPS } from '@/lib/onboarding-flow';
import {
  STALE_POSTING_DAYS,
  ANCIENT_POSTING_DAYS,
  daysSincePosted,
  type JobPostingAnalysis,
} from '@/lib/job-posting-date';

/** Hide legacy Resume Manager nav once Generated Docs is the primary library UI. */
const SHOW_RESUME_MANAGER_NAV = false;

/** Tabs that should fill leftover viewport height instead of using 13-inch vh math. */
const FILL_TABS = new Set(['chat', 'terminal', 'resume-studio', 'practice']);

const PANE_WIDTH = 'w-full min-w-0 max-w-5xl xl:max-w-6xl 2xl:max-w-7xl';

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-[#9CA3AF]">
      <Loader2 className="animate-spin" size={24} />
    </div>
  );
}

const ResumeStudio = dynamic(() => import('./resume-studio/ResumeStudio'), {
  ssr: false,
  loading: TabLoading,
});
const PracticePanel = dynamic(() => import('./practice/PracticePanel'), {
  ssr: false,
  loading: TabLoading,
});
const GeneratedDocsPanel = dynamic(() => import('./GeneratedDocsPanel'), {
  ssr: false,
  loading: TabLoading,
});
const AdminUsersPanel = dynamic(() => import('./AdminUsersPanel'), {
  ssr: false,
  loading: TabLoading,
});
const AdminProductAnalyticsPanel = dynamic(() => import('./AdminProductAnalyticsPanel'), {
  ssr: false,
  loading: TabLoading,
});
const AdminPaymentsPanel = dynamic(() => import('./AdminPaymentsPanel'), {
  ssr: false,
  loading: TabLoading,
});
const AdminSubscriptionsPanel = dynamic(() => import('./AdminSubscriptionsPanel'), {
  ssr: false,
  loading: TabLoading,
});
const AdminFeedbackPanel = dynamic(() => import('./AdminFeedbackPanel'), {
  ssr: false,
  loading: TabLoading,
});
const ProductFeedbackCard = dynamic(() => import('./ProductFeedbackCard'), {
  ssr: false,
  loading: TabLoading,
});
const ProductFeedbackNudge = dynamic(() => import('./ProductFeedbackNudge'), {
  ssr: false,
});
const GccCampaignPanel = dynamic(
  () => import('./GccCampaignPanel').then((m) => ({ default: m.GccCampaignPanel })),
  { ssr: false, loading: TabLoading }
);

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

function jobIsApplied(job: {
  is_applied?: boolean;
  application_status?: string | null;
  app_id?: number | null;
  applied_at?: string | null;
}) {
  if (job?.applied_at) return true;
  const raw = String(job?.application_status || '').toUpperCase().trim();
  if (['EVALUATED', 'PENDING', 'SKIP', 'DISCARDED'].includes(raw)) return false;
  return Boolean(job?.is_applied || ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(raw));
}

/** Normalize pipeline status — keep EVALUATED distinct from APPLIED */
function formatPipelineStatus(job: {
  application_status?: string | null;
  is_applied?: boolean;
  applied_at?: string | null;
}) {
  const raw = String(job?.application_status || '').toUpperCase().trim();
  if (job?.applied_at || raw === 'APPLIED') return 'APPLIED';
  if (['EVALUATED', 'PENDING'].includes(raw)) return 'EVALUATED';
  if (!raw) return 'OPEN';
  return raw;
}

function formatRowNumber(index: number, total?: number): string {
  const pad = total != null && total >= 100 ? 3 : 2;
  return String(index + 1).padStart(pad, '0');
}

function formatApplicationStatus(app: { status?: string | null; applied_at?: string | null }) {
  const raw = String(app.status || '').toUpperCase();
  if (app.applied_at && (raw === 'PENDING' || raw === 'EVALUATED' || !raw)) return 'APPLIED';
  return raw || 'EVALUATED';
}

function terminalUsernameFromSession(session: { user?: { email?: string | null; name?: string | null } | null } | null): string {
  const fromEmail = session?.user?.email?.split('@')?.[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || '';
  const fromName = session?.user?.name?.trim()?.split(/\s+/)?.[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, '') || '';
  return fromEmail || fromName || 'user';
}

function isGccPipelineJob(job: { company_type?: string | null; source?: string | null }) {
  return job?.company_type === 'GCC' || String(job?.source || '').includes('GCC Scan');
}

function formatJdForDisplay(text: string | null | undefined): string {
  if (!text?.trim()) {
    return 'No JD captured yet. Run Tailor to scrape and persist it, or open the posting link.';
  }
  if (/access denied|edgesuite\.net|don't have permission to access/i.test(text)) {
    return [
      'This job board blocked automated access (common on Naukri / Indeed).',
      '',
      '• Open the posting link above to read the full description',
      '• Run Tailor — our worker may capture the JD another way',
    ].join('\n');
  }
  return text;
}

export default function Dashboard({ initialData }: { initialData?: any }) {
  const { data: session, status } = useSession();
  const isAdmin = Boolean(
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin
    || session?.user?.email === 'admin@career-ops.local'
  );
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
  const [externalTerminalCommand, setExternalTerminalCommand] = useState<{ command: string; id: number } | null>(null);
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
  const [accountInfo, setAccountInfo] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    newsletter_opt_in: true,
    referral_code: '',
    referral_url: '',
  });
  const [tagInputPositive, setTagInputPositive] = useState('');
  const [tagInputNegative, setTagInputNegative] = useState('');
  const [tagInputPortals, setTagInputPortals] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [stealthCopyAppId, setStealthCopyAppId] = useState<number | null>(null);
  const [stealthBusyAppId, setStealthBusyAppId] = useState<number | null>(null);
  const [stealthBusyJobId, setStealthBusyJobId] = useState<number | null>(null);
  const [stealthCopiedJobId, setStealthCopiedJobId] = useState<number | null>(null);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ show: false, message: '' });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show, toast.message]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lgUp, setLgUp] = useState(false);

  // Visitor analytics state
  const [visitorStats, setVisitorStats] = useState<any>(null);
  const [adminOverview, setAdminOverview] = useState<any>(null);
  const [productAnalytics, setProductAnalytics] = useState<any>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; company: string; title: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Shell-style Yes/No before tailor (like bash read -p) — no modal
  const [staleTailorChecking, setStaleTailorChecking] = useState(false);
  const [staleTailorTarget, setStaleTailorTarget] = useState<{
    /** Numeric pipeline id, or job URL when tailor <url> --deep */
    target: string;
    command: string;
    company: string;
    title: string;
    posted_at: string | null;
    ageDays: number | null;
    analysis: JobPostingAnalysis | null;
    gateMessage: string;
  } | null>(null);
  const cmdInputRef = useRef<HTMLInputElement | null>(null);
  const awaitingPostingConfirm = Boolean(staleTailorTarget);

  const [clearPipelineOpen, setClearPipelineOpen] = useState(false);
  const [clearPipelineScope, setClearPipelineScope] = useState<'all' | 'visible'>('all');
  const [clearPipelineLoading, setClearPipelineLoading] = useState(false);
  const [pipelineViewMode, setPipelineViewMode] = useState<'studio' | 'table'>('studio');
  const [gccCampaign, setGccCampaign] = useState<GccCampaign>(defaultGccCampaign);
  const [outreachTarget, setOutreachTarget] = useState<OutreachTarget | null>(null);
  const [engagementIntelTarget, setEngagementIntelTarget] =
    useState<EngagementIntelTarget>(null);
  const [studioReviewJob, setStudioReviewJob] = useState<{
    jobId: number;
    company?: string;
    title?: string;
    score?: string | number | null;
    ats_content_score?: number | null;
    jd_alignment_score?: number | null;
    has_resume_html?: boolean;
    has_resume_pdf?: boolean;
    has_cover_letter_html?: boolean;
    has_cover_letter_pdf?: boolean;
    docKind?: 'resume' | 'cover';
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
  const [copilotLimitHit, setCopilotLimitHit] = useState(false);
  const [billing, setBilling] = useState<{
    hasPro: boolean;
    plan: { display: string; subtitle: string };
    payment?: PendingPayment | null;
    copilot: { limit: number; remaining: number; windowHours: number; pro: boolean };
  } | null>(null);
  const hasPro = Boolean(billing?.hasPro || isAdmin);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const lastBgEventRef = useRef<number>(Number(initialData?.meta?.lastBackgroundEventId || 0));

  const terminalUser = terminalUsernameFromSession(session);
  const terminalPrompt = `${terminalUser}@career-ops:~$`;

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
  const pipelineAppliedCount = filteredPipeline.filter(jobIsApplied).length;
  const pipelineOpenCount = filteredPipeline.length - pipelineAppliedCount;
  const pipelineGccCount = filteredPipeline.filter(isGccPipelineJob).length;
  const pipelineGccJobs = (data?.pipeline || []).filter(isGccPipelineJob);

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
    profileFormData.github_settings?.has_pat ||
    data?.profile?.github_settings?.has_pat ||
    data?.resume_context?.github_settings?.has_pat
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

  const loadAdminData = async () => {
    setAdminLoading(true);
    setAdminError(null);
    try {
      const [usersRes, viewsRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/view'),
        fetch('/api/admin/analytics'),
      ]);
      const usersJson = await usersRes.json().catch(() => ({}));
      const viewsJson = await viewsRes.json().catch(() => ({}));
      const analyticsJson = await analyticsRes.json().catch(() => ({}));
      if (!usersRes.ok) {
        throw new Error(usersJson?.error || 'Failed to load user registry');
      }
      if (!analyticsRes.ok) {
        throw new Error(analyticsJson?.error || 'Failed to load product analytics');
      }
      setAdminOverview(usersJson);
      setProductAnalytics(analyticsJson);
      setVisitorStats(viewsJson);
    } catch (e: unknown) {
      setAdminError(e instanceof Error ? e.message : 'Admin load failed');
    } finally {
      setAdminLoading(false);
    }
  };

  const openInStudio = (job: {
    jobId: number;
    company?: string;
    title?: string;
    score?: string | number | null;
    ats_content_score?: number | null;
    jd_alignment_score?: number | null;
    has_resume_html?: boolean;
    has_resume_pdf?: boolean;
    has_cover_letter_html?: boolean;
    has_cover_letter_pdf?: boolean;
    docKind?: 'resume' | 'cover';
  }) => {
    setStudioReviewJob(job);
    setStudioInitialJobId(job.jobId);
    setActiveTab('resume-studio');
    setMobileNavOpen(false);
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
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'resume-studio' || tab === 'chat' || tab === 'practice') setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const res = await fetch('/api/billing/status');
        if (res.ok) setBilling(await res.json());
      } catch {
        // ignore
      }
    })();
  }, [status]);

  const refreshBilling = async () => {
    try {
      const res = await fetch('/api/billing/status');
      if (res.ok) setBilling(await res.json());
    } catch {
      // ignore
    }
  };

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
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      setLgUp(mq.matches);
      if (!mq.matches) setMobileNavOpen(false);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /** Icon rail only on desktop; phone drawer always shows full labels. */
  const navCollapsed = lgUp && sidebarCollapsed;

  const goTab = (tab: string, extra?: () => void) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
    extra?.();
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
        : script === 'gcc-scan.mjs'
          ? 'GCC Scan'
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

    if (script === 'gcc-scan.mjs' && status === 'success') {
      const added = meta?.lastGccScanAdded;
      const total = meta?.gccPipelineCount;
      if (added != null && added === 0) {
        const msg = `[OK] GCC Scan finished — 0 new roles matched your keywords. Try broadening positive keywords in Settings, then re-run.`;
        return { toast: msg, terminal: msg };
      }
      if (added != null && added > 0) {
        const msg = `[OK] ✔ GCC Scan — ${added} role(s) added${total != null ? ` (${total} total in pipeline)` : ''}`;
        return { toast: msg, terminal: `${msg}${hint}` };
      }
    }

    return { toast: `[OK] ✔ ${label} ${outcome}${hint}`, terminal: `[OK] ✔ ${label} ${outcome}${hint}` };
  };

  const tourIcons = [
    <Zap key="welcome" size={24} />,
    <Settings key="settings" size={24} />,
    <TerminalIcon key="terminal" size={24} />,
    <BarChart3 key="pipeline" size={24} />,
    <Sparkles key="studio" size={24} />,
    <Code key="practice" size={24} />,
    <MessageSquare key="chat" size={24} />,
    <CheckCircle2 key="done" size={24} />,
  ];

  const steps = DASHBOARD_TOUR_STEPS.map((step, index) => ({
    ...step,
    icon: tourIcons[index] ?? <Zap size={24} />,
  }));

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

  useEffect(() => {
    if (walkthroughStep === null) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        setWalkthroughStep((prev) => (prev !== null && prev < steps.length - 1 ? prev + 1 : (completeOnboarding(), null)));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setWalkthroughStep((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        completeOnboarding();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [walkthroughStep, steps.length]);

  // Global shortcut for Command Palette: ⌘K or Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
    const onboardingKey = `${ONBOARDING_STORAGE_KEY}:${userKey}`;
    const hasSeenOnboarding = localStorage.getItem(onboardingKey);

    if (!hasSeenOnboarding) {
      setTimeout(() => setWalkthroughStep(0), 1200);
    }
  }, [status, session?.user?.email, session?.user?.id]);

  // Mark the latest background event as already seen so a completed tailor/scan
  // from yesterday does not toast again on every page load.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const userKey = session?.user?.email || session?.user?.id || 'default';
    const key = `career_ops_last_seen_bg_event:${userKey}`;
    const currentId = Number(initialData?.meta?.lastBackgroundEventId || 0);
    try {
      const stored = Number(localStorage.getItem(key) || 0);
      const seen = Math.max(stored, currentId, lastBgEventRef.current);
      lastBgEventRef.current = seen;
      localStorage.setItem(key, String(seen));
    } catch {
      lastBgEventRef.current = Math.max(lastBgEventRef.current, currentId);
    }
  }, [status, session?.user?.email, session?.user?.id, initialData?.meta?.lastBackgroundEventId]);

  const completeOnboarding = () => {
    const userKey = session?.user?.email || session?.user?.id || 'default';
    localStorage.setItem(`${ONBOARDING_STORAGE_KEY}:${userKey}`, 'true');
    setWalkthroughStep(null);
  };

  const runCommand = (query: string) => {
    setLogs(prev => [...prev, { type: 'stdout', content: `\n${terminalPrompt} ${query}\n` }]);
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
   * Gate EVERY tailor (id or URL) behind posting-age/history check.
   * Prints check into Terminal; Yes/No (dialog or type yes/no) before Actions.
   */
  const requestTailor = async (targetRaw: number | string, command?: string) => {
    const target = String(targetRaw || '').trim();
    const isUrl = /^https?:\/\//i.test(target);
    const id = Number.parseInt(target, 10);
    const isId = Number.isFinite(id) && String(id) === target;
    if (!isUrl && !isId) {
      setToast({ show: true, message: 'Use: tailor <job_id|url> --deep' });
      return;
    }
    const cmd =
      (command && command.trim())
      || (isUrl ? `tailor ${target} --deep` : `tailor ${id} --deep`);

    setActiveTab('terminal');
    setExternalTerminalCommand({ command: cmd, id: Date.now() });
  };

  const confirmStaleTailor = () => {
    const cmd = staleTailorTarget?.command;
    setStaleTailorTarget(null);
    if (cmd) {
      setActiveTab('terminal');
      setLogs((prev) => [
        ...prev,
        { type: 'stdout', content: 'yes\n✓ Proceeding — generating resume & cover letter…\n' },
      ]);
      const withYes = /\s--yes\b/i.test(cmd) ? cmd : `${cmd} --yes`;
      runCommand(withYes);
    }
  };

  const cancelStaleTailor = () => {
    setLogs((prev) => [
      ...prev,
      { type: 'stdout', content: 'no\n✗ Cancelled — no resume generated.\n' },
    ]);
    setStaleTailorTarget(null);
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = cmdInput.trim();
    if (!q) return;

    // Shell-style Yes/No while posting gate is waiting (like read -p in bash)
    if (awaitingPostingConfirm && staleTailorTarget) {
      setHistory((prev) => [q, ...prev].slice(0, 50));
      setHistoryIndex(-1);
      setCmdInput('');
      setLogs((prev) => [
        ...prev,
        { type: 'stdout', content: `Continue with resume generation? [Yes/No]: ${q}\n` },
      ]);
      if (/^(y|yes)$/i.test(q)) {
        confirmStaleTailor();
        return;
      }
      if (/^(n|no)$/i.test(q)) {
        cancelStaleTailor();
        return;
      }
      setLogs((prev) => [
        ...prev,
        { type: 'stdout', content: `⚠ Please answer Yes or No (got "${q}").\nContinue with resume generation? [Yes/No]:\n` },
      ]);
      setTimeout(() => cmdInputRef.current?.focus(), 30);
      return;
    }

    if (isExecuting || staleTailorChecking) return;

    setHistory((prev) => [q, ...prev].slice(0, 50));
    setHistoryIndex(-1);

    // ANY tailor — id or URL — must hit posting gate first
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
        setLogs((prev) => [
          ...prev,
          { type: 'stderr', content: 'Usage: tailor <job_id|url> --deep\n' },
        ]);
        setCmdInput('');
        return;
      }
      // Dashboard terminal tailor always uses --deep (GitHub Actions path)
      const cmd = `tailor ${target} --deep${yes ? ' --yes' : ''}`.replace(/\s+/g, ' ').trim();
      setCmdInput('');
      // If user already passed --yes, still show check but auto-confirm after print
      void (async () => {
        if (yes) {
          setActiveTab('terminal');
          setLogs((prev) => [
            ...prev,
            { type: 'stdout', content: `\n${terminalPrompt} ${cmd}\n📅 Posting check (--yes provided)…\n` },
          ]);
          try {
            const isUrl = /^https?:\/\//i.test(target);
            const id = Number.parseInt(target, 10);
            const res = await fetch(
              isUrl
                ? `/api/job/posting-check?url=${encodeURIComponent(target)}`
                : `/api/job/${id}?refresh=1`,
            );
            if (res.ok) {
              const job = await res.json();
              const gateMessage = String(job?.posting_gate_message || '').trim();
              if (gateMessage) {
                setLogs((prev) => [...prev, { type: 'stdout', content: `\n${gateMessage}\n` }]);
              }
            }
          } catch {
            /* still proceed with --yes */
          }
          setLogs((prev) => [
            ...prev,
            { type: 'stdout', content: '✓ --yes set — starting tailor…\n' },
          ]);
          runCommand(cmd);
          return;
        }
        await requestTailor(target, cmd);
      })();
      return;
    }

    runCommand(q);
    setCmdInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+C to clear current line (terminal-style) — also aborts Yes/No wait
    if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      if (awaitingPostingConfirm) {
        appendTerminalLine('^C');
        appendTerminalLine('✗ Posting confirm cancelled (Ctrl+C).');
        setStaleTailorTarget(null);
        setCmdInput('');
        setHistoryIndex(-1);
        return;
      }
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
    const pollFingerprint = (meta: Record<string, unknown> | undefined) =>
      [
        meta?.lastBackgroundEventId,
        meta?.jobsTotal,
        meta?.jobsRanked,
        meta?.lastJobUpdatedAt,
        meta?.lastBackgroundStatus,
        meta?.gccPipelineCount,
      ].join('|');

    let lastFp = pollFingerprint(initialData?.meta);
    let allowDeltaToasts = false;

    const fetchData = () => {
      fetch('/api/data?t=' + Date.now(), { cache: 'no-store' })
        .then(res => res.json())
        .then(d => {
          setData((prevData: any) => {
            const userKey = session?.user?.email || session?.user?.id || 'default';
            const lastSeenKey = `career_ops_last_seen_bg_event:${userKey}`;

            // Background job completion — dedupe by event id (avoids double "GCC Scan completed")
            const notifyBackgroundCompletion = (meta: any, storageKey: string) => {
              const eventId = Number(meta?.lastBackgroundEventId || 0);
              if (eventId <= 0 || eventId <= lastBgEventRef.current) return false;
              lastBgEventRef.current = eventId;
              const msg = formatCompletionMessage(meta);
              setToast({ show: true, message: msg.toast });
              setTimeout(() => setToast({ show: false, message: '' }), 5000);
              appendTerminalLine(msg.terminal);
              const script = String(meta?.lastBackgroundActionScript || '');
              if (String(meta?.lastBackgroundStatus || '') === 'success' && script === 'gcc-scan.mjs') {
                const added = meta?.lastGccScanAdded;
                if (added != null && added > 0) {
                  appendTerminalLine(`[INFO] → ${added} GCC role(s) added — see Discovered GCC roles tab.`);
                } else if (added === 0) {
                  appendTerminalLine('[INFO] → 0 roles added. Broaden keywords in Settings or retry in a few minutes.');
                } else {
                  appendTerminalLine('[INFO] → Refreshing pipeline — check GCC Campaign in ~10s.');
                }
              }
              try {
                localStorage.setItem(storageKey, String(eventId));
              } catch {
                // ignore
              }
              return true;
            };

            try {
              const nextMeta = d?.meta || {};
              const nextEventId = Number(nextMeta.lastBackgroundEventId || 0);
              const lastSeen = Number(localStorage.getItem(lastSeenKey) || 0);
              if (nextEventId > lastSeen) {
                notifyBackgroundCompletion(nextMeta, lastSeenKey);
              }
            } catch {
              // ignore storage failures
            }

            if (allowDeltaToasts && prevData) {
              const prevMeta = prevData.meta || {};
              const nextMeta = d.meta || {};
              const bgNotified = notifyBackgroundCompletion(nextMeta, lastSeenKey);

              if (
                !bgNotified &&
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
              } else if (!bgNotified && prevData.pipeline && d.pipeline) {
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
          lastFp = pollFingerprint(d?.meta);
          allowDeltaToasts = true;
          setLoading(false);
        });
    };

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!initialData) fetchData();

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(tick, ms);
    };

    const tick = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        schedule(20_000);
        return;
      }
      fetch('/api/data?poll=1&t=' + Date.now(), { cache: 'no-store' })
        .then((res) => res.json())
        .then((lite) => {
          if (cancelled) return;
          const nextFp = pollFingerprint(lite?.meta);
          const running = String(lite?.meta?.lastBackgroundStatus || '').toLowerCase();
          if (nextFp !== lastFp) {
            lastFp = nextFp;
            fetchData();
          }
          schedule(running === 'running' || running === 'pending' ? 8_000 : 20_000);
        })
        .catch(() => schedule(20_000));
    };

    const onVisibility = () => {
      if (typeof document === 'undefined' || document.hidden) return;
      if (timer) clearTimeout(timer);
      tick();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    schedule(20_000);

    // Also fetch visitor stats for the stat card
    fetch('/api/view').then(r => r.json()).then(setVisitorStats).catch(() => {});
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
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
            github_settings: {
              pat: '',
              repo: d.resume_context?.github_settings?.repo || 'UGilfoyle/career-ops',
              has_pat: Boolean(d.resume_context?.github_settings?.has_pat),
            },
            studio: d.resume_context?.studio || { template_id: 'ats-professional' },
          });
          setGccCampaign(d.resume_context?.gcc_campaign || defaultGccCampaign());
          setAccountInfo(prev => ({
            ...prev,
            email: d.email || '',
            newsletter_opt_in: d.newsletter_opt_in !== false,
            referral_code: d.referral_code || '',
            referral_url: d.referral_url || '',
          }));
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
    setCopilotLimitHit(false);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const data = await res.json();
      if (res.status === 429 && data.error === 'copilot_rate_limit') {
        setCopilotLimitHit(true);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || 'Copilot limit reached. Upgrade to Pro for unlimited coaching.',
        }]);
        void refreshBilling();
      } else if (data.error) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error: ${data.error}` }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        void refreshBilling();
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
          password: accountInfo.password || undefined,
          newsletter_opt_in: accountInfo.newsletter_opt_in,
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

  const importGccFromPipeline = (mode: 'all' | 'high_value') => {
    const pool = (data?.pipeline || []).filter((j: any) =>
      mode === 'high_value' ? j.gcc_high_value : isGccPipelineJob(j)
    );
    if (pool.length === 0) {
      setToast({
        show: true,
        message: mode === 'high_value'
          ? 'No high-value GCC jobs yet. Run gcc-scan --deep first.'
          : 'No GCC roles in pipeline yet. Run gcc-scan --deep — results appear here and in Job Pipeline.',
      });
      return;
    }
    const existing = new Set(
      gccCampaign.targets.map((t) => `${t.company.toLowerCase()}|${(t.role || '').toLowerCase()}`)
    );
    const added = pool.filter((j: any) => {
      const key = `${String(j.company || '').toLowerCase()}|${String(j.title || '').toLowerCase()}`;
      return !existing.has(key);
    });
    if (added.length === 0) {
      setToast({ show: true, message: 'All GCC pipeline roles are already in outreach tracker' });
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
    setToast({ show: true, message: `Imported ${added.length} GCC role(s) — click Save Campaign` });
    setActiveTab('gcc');
  };

  const importHighValueGccFromPipeline = () => importGccFromPipeline('high_value');
  const importAllGccFromPipeline = () => importGccFromPipeline('all');

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
          newsletter_opt_in: accountInfo.newsletter_opt_in,
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

  const copyStealthLink = async (appId: number) => {
    if (!Number.isFinite(appId) || appId <= 0) return;
    setStealthBusyAppId(appId);
    try {
      const res = await fetch(`/api/applications/${appId}/stealth-link`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create stealth link');
      const url = String(json.url || '');
      if (!url) throw new Error('No URL returned');
      await navigator.clipboard.writeText(url);
      setStealthCopyAppId(appId);
      setTimeout(() => setStealthCopyAppId((cur) => (cur === appId ? null : cur)), 2000);
      setData((prev: any) => {
        if (!prev?.applications) return prev;
        return {
          ...prev,
          applications: prev.applications.map((a: any) =>
            Number(a.app_id) === appId
              ? {
                  ...a,
                  stealth_slug: json.slug,
                  stealth_views: json.view_count ?? a.stealth_views ?? 0,
                  stealth_clicks: json.click_count ?? a.stealth_clicks ?? 0,
                  stealth_dwell_sec: json.total_dwell_sec ?? a.stealth_dwell_sec ?? 0,
                  stealth_last_engaged_at: json.last_engaged_at ?? a.stealth_last_engaged_at ?? null,
                }
              : a
          ),
        };
      });
      setToast({ show: true, message: 'Stealth link copied — paste as Portfolio / Website' });
      setTimeout(() => setToast({ show: false, message: '' }), 3500);
    } catch (err: any) {
      setToast({ show: true, message: err?.message || 'Could not copy stealth link' });
      setTimeout(() => setToast({ show: false, message: '' }), 4000);
    } finally {
      setStealthBusyAppId(null);
    }
  };

  /** Pre-apply: create EVALUATED app + stealth link from Generated Docs (job id). */
  const copyStealthLinkForJob = async (jobId: number) => {
    if (!Number.isFinite(jobId) || jobId <= 0) return;
    setStealthBusyJobId(jobId);
    try {
      const res = await fetch(`/api/job/${jobId}/stealth-link`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create stealth link');
      const url = String(json.url || '');
      if (!url) throw new Error('No URL returned');
      await navigator.clipboard.writeText(url);
      setStealthCopiedJobId(jobId);
      setTimeout(() => setStealthCopiedJobId((cur) => (cur === jobId ? null : cur)), 2500);

      const refreshRes = await fetch('/api/data');
      if (refreshRes.ok) {
        const fresh = await refreshRes.json();
        setData(fresh);
      }

      setToast({
        show: true,
        message: 'Track link copied — paste as Portfolio/Website on the apply form (before you submit)',
      });
      setTimeout(() => setToast({ show: false, message: '' }), 4500);
    } catch (err: any) {
      setToast({ show: true, message: err?.message || 'Could not copy stealth link' });
      setTimeout(() => setToast({ show: false, message: '' }), 4000);
    } finally {
      setStealthBusyJobId(null);
    }
  };

  const openEngagementIntel = (app: any) => {
    const appId = Number(app?.app_id);
    if (!Number.isFinite(appId) || appId <= 0) return;
    setEngagementIntelTarget({
      appId,
      company: String(app.company || 'Company'),
      role: String(app.role || 'Role'),
    });
  };

  const renderEngagementBadge = (app: any) => {
    const views = Number(app.stealth_views || 0);
    const clicks = Number(app.stealth_clicks || 0);
    const engaged = views > 0 || clicks > 0 || Boolean(app.stealth_last_engaged_at);
    if (!app.stealth_slug && !engaged) return null;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openEngagementIntel(app);
        }}
        title={
          engaged
            ? `${views} view${views === 1 ? '' : 's'} · ${clicks} click${clicks === 1 ? '' : 's'} — open intel`
            : 'Stealth link ready — open intel'
        }
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
          engaged
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100'
            : 'bg-stone-50 text-stone-500 border border-stone-100 hover:bg-stone-100'
        }`}
      >
        <Activity size={10} />
        {engaged ? `Engaged · ${views}v/${clicks}c` : 'Link ready'}
      </button>
    );
  };

  const handleMarkApplied = async (jobId: number, options?: { keepModalOpen?: boolean }) => {
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

      if (options?.keepModalOpen || (jobDetailsOpen && Number(jobDetails?.id) === jobId)) {
        const detailRes = await fetch(`/api/job/${jobId}`);
        if (detailRes.ok) {
          setJobDetails(await detailRes.json());
        }
      }

      setToast({
        show: true,
        message: json.alreadyExists
          ? '[OK] ✔ Already applied — status shown on pipeline'
          : '[OK] ✔ Marked as applied — visible on pipeline & Applications board',
      });
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
    <div className="flex h-[100dvh] min-h-[100dvh] max-w-[100vw] overflow-x-hidden bg-[#FAFAF8] text-[#1C1C1E] font-[family-name:var(--font-inter)] selection:bg-[#1C1C1E]/10">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-[#1C1C1E]/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      {/* Sidebar: drawer on mobile, fixed rail on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(16rem,88vw)] flex-col overflow-hidden border-r border-[#E5E5E0] bg-[#F5F5F0] transition-[width,transform] duration-300 ease-in-out lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${navCollapsed ? 'lg:w-[4.5rem]' : 'lg:w-60'}`}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          className="absolute -right-3 top-[4.25rem] z-[60] hidden h-7 w-7 items-center justify-center rounded-full border border-[#E5E5E0] bg-white text-[#6B6B6B] shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-all hover:border-[#1C1C1E]/20 hover:text-[#1C1C1E] hover:shadow-md lg:flex"
        >
          {sidebarCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
        </button>
        <div className={`flex-1 overflow-y-auto overflow-x-hidden ${navCollapsed ? 'px-2 py-4' : 'px-4 py-6'}`}>
          <div
            className={`mb-6 flex items-center ${
              navCollapsed ? 'justify-center' : 'gap-2.5 px-1'
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1c1c1e]">
              <Zap size={14} className="text-white" strokeWidth={2} />
            </div>
            {!navCollapsed && (
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                <span className="truncate text-[15px] font-bold text-[#1C1C1E]">Career-Ops</span>
                <span className="shrink-0 rounded-full bg-emerald-50/70 px-1.5 py-0.5 text-[8px] font-semibold font-mono text-emerald-800 border border-emerald-200/80 uppercase tracking-tight leading-none">
                  v3
                </span>
              </div>
            )}
            {!lgUp && (
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E5E0] bg-white text-[#6B6B6B]"
                aria-label="Close navigation"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className={`mb-3.5 flex w-full items-center rounded-xl border border-[#E5E5E0] bg-white text-xs text-[#6B6B6B] shadow-2xs transition-all hover:border-[#1C1C1E]/30 hover:text-[#1C1C1E] cursor-pointer ${
              navCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
            }`}
            title="Command Palette (⌘K)"
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-[#9CA3AF]" />
              {!navCollapsed && <span className="font-medium">Quick search...</span>}
            </div>
            {!navCollapsed && (
              <kbd className="rounded bg-[#F5F5F0] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#9CA3AF] border border-[#E5E5E0]">
                ⌘K
              </kbd>
            )}
          </button>

          <nav className="space-y-0.5">
            <NavItem id="nav-dashboard" icon={<LayoutDashboard size={18}/>} label="Dashboard" active={activeTab === 'dashboard'} collapsed={navCollapsed} onClick={() => goTab('dashboard')} />
            <NavItem id="nav-pipeline" icon={<Search size={18}/>} label="Job Pipeline" active={activeTab === 'pipeline'} collapsed={navCollapsed} onClick={() => goTab('pipeline')} />
            <NavItem id="nav-apps" icon={<Briefcase size={18}/>} label="Applications" active={activeTab === 'apps'} collapsed={navCollapsed} onClick={() => goTab('apps')} />
            <NavItem id="nav-gcc" icon={<Target size={18}/>} label="GCC Campaign" active={activeTab === 'gcc'} collapsed={navCollapsed} onClick={() => goTab('gcc')} />
            <NavItem id="nav-resume-studio" icon={<Sparkles size={18}/>} label="Resume Studio" active={activeTab === 'resume-studio'} collapsed={navCollapsed} onClick={() => goTab('resume-studio')} badge={showBetaBanner || process.env.NEXT_PUBLIC_BETA_MODE === '1' ? 'Beta' : undefined} />
            <NavItem id="nav-generated-docs" icon={<Files size={18}/>} label="Generated Docs" active={activeTab === 'generated-docs'} collapsed={navCollapsed} onClick={() => goTab('generated-docs')} />
            <NavItem id="nav-terminal" icon={<TerminalIcon size={18}/>} label="Terminal" active={activeTab === 'terminal'} collapsed={navCollapsed} onClick={() => goTab('terminal')} />
            <NavItem id="nav-chat" icon={<MessageSquare size={18}/>} label="Career Copilot" active={activeTab === 'chat'} collapsed={navCollapsed} onClick={() => goTab('chat')} />
            <NavItem id="nav-practice" icon={<GraduationCap size={18}/>} label="Interview Practice" active={activeTab === 'practice'} collapsed={navCollapsed} onClick={() => goTab('practice')} />
            {SHOW_RESUME_MANAGER_NAV && (
            <NavItem id="nav-cv" icon={<FileText size={18}/>} label="Resume Manager" active={activeTab === 'cv'} collapsed={navCollapsed} onClick={() => goTab('cv')} />
            )}
            {isAdmin && (
              <NavItem id="nav-analytics" icon={<Shield size={18}/>} label="Admin" active={activeTab === 'analytics'} collapsed={navCollapsed} onClick={() => goTab('analytics', () => { if (!adminOverview || !productAnalytics) { void loadAdminData(); } })} />
            )}
            <NavItem id="nav-docs" icon={<BookOpen size={18}/>} label="Tutorial & Docs" active={activeTab === 'docs'} collapsed={navCollapsed} onClick={() => goTab('docs')} />
          </nav>
        </div>

        <div className={`mt-auto border-t border-[#E5E5E0] ${navCollapsed ? 'px-2 py-3' : 'px-4 py-4'}`}>
          <NavItem id="nav-settings" icon={<Settings size={18}/>} label="Settings" active={activeTab === 'settings'} collapsed={navCollapsed} onClick={() => goTab('settings')} />
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            title={navCollapsed ? 'Sign Out' : undefined}
            className={`group mt-2 flex w-full items-center rounded-xl text-[#6B6B6B] transition-all hover:bg-white/50 hover:text-[#1C1C1E] ${
              navCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3'
            }`}
          >
            <LogOut size={18} className="opacity-70 transition-opacity group-hover:opacity-100" />
            {!navCollapsed && <span className="text-sm font-bold">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#FAFAF8]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E5E0] bg-[#FAFAF8] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-[#E5E5E0] bg-white p-2.5 text-[#1C1C1E]"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-bold text-[#1C1C1E]">Career-Ops</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF]">
              {activeTab.replace('-', ' ')}
            </p>
          </div>
          <div className="w-10" aria-hidden />
        </div>
        <div
          className={`min-h-0 flex-1 ${
            FILL_TABS.has(activeTab)
              ? 'flex flex-col overflow-hidden'
              : 'overflow-x-hidden overflow-y-auto'
          } p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6 xl:p-8 2xl:px-10 2xl:py-8`}
        >
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

        <div className={FILL_TABS.has(activeTab) ? 'flex min-h-0 flex-1 flex-col' : undefined}>
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
                     hint: 'PAT (workflow scope) required for deep scan & tailor',
                     done: githubDone,
                     onClick: () => setActiveTab('settings'),
                   },
                   {
                     id: 'gcc-scan',
                     label: 'Run GCC scan (optional)',
                     hint: 'gcc-scan --deep — captive employers in India hubs',
                     done: (data?.pipeline || []).some((j: any) => j.company_type === 'GCC'),
                     onClick: () => { setActiveTab('terminal'); runCommand('gcc-scan --deep'); },
                   },
                   {
                     id: 'scan',
                     label: 'Run broad job scan',
                     hint: 'scan --deep — LinkedIn, Naukri, Indeed & more',
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
                         const statusLabel = formatApplicationStatus(app);
                         const tailorId = app.job_id || app.pipeline_id;
                         const tailorLocked = ['APPLIED', 'RESPONDED', 'SENT', 'INTERVIEW', 'ENTREVISTA', 'OFFER', 'OFERTA', 'REJECTED', 'DISCARDED', 'SKIP'].includes(statusLabel);
                         return (
                         <div key={app.app_id || i} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                           <div className="flex min-w-0 items-start gap-3">
                              <span className="mt-1 font-mono text-[10px] font-bold tabular-nums text-[#C4C4BE]">{formatRowNumber(i)}</span>
                              <JobAvatar company={app.company} url={app.url} source={app.source} logoUrl={app.logo_url} portalKey={app.portal_key} logoSource={app.logo_source} size="sm" />
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
                                 disabled={tailorLocked}
                                 onClick={() => {
                                   if (tailorLocked) return;
                                   setActiveTab('terminal');
                                   void requestTailor(tailorId);
                                 }}
                                 title={tailorLocked ? 'Already applied — Tailor disabled' : 'Tailor resume for this role'}
                                 className={`rounded-xl px-3 py-1.5 text-[11px] font-bold transition-colors ${
                                   tailorLocked
                                     ? 'bg-[#E5E5E0] text-[#9CA3AF] cursor-not-allowed'
                                     : 'bg-[#1C1C1E] text-white hover:bg-[#27272a]'
                                 }`}
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
                    <div className="h-[min(70dvh,calc(100dvh-12rem))] min-h-[16rem] sm:min-h-[22rem] overflow-auto rounded-xl border border-[#E5E5E0] bg-white">
                      <table className="w-full min-w-[56rem] text-left">
                        <thead className="sticky top-0 z-10 bg-[#FAFAF8] border-b border-[#E5E5E0] shadow-[0_1px_0_#E5E5E0]">
                          <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF]">
                            <th className="w-12 px-4 py-4">#</th>
                            <th className="px-5 py-4">Company</th>
                            <th className="px-5 py-4">Role</th>
                            <th className="px-5 py-4">Status</th>
                            <th className="px-5 py-4">Date</th>
                            <th className="px-5 py-4">AI Score</th>
                            <th className="px-5 py-4">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F5F5F0]">
                          {sortedApplications.map((app: any, i: number) => {
                            const displayStatus = formatApplicationStatus(app);
                            const isAppliedStage = ['APPLIED', 'RESPONDED', 'SENT', 'INTERVIEW', 'ENTREVISTA', 'OFFER', 'OFERTA', 'REJECTED', 'DISCARDED', 'SKIP'].includes(displayStatus);
                            return (
                            <tr key={i} className="hover:bg-[#FAFAF8] transition-colors group">
                              <td className="px-4 py-4 font-mono text-[11px] font-bold tabular-nums text-[#C4C4BE]">
                                {formatRowNumber(i, sortedApplications.length)}
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2.5">
                                  <JobAvatar company={app.company} url={app.url} source={app.source} logoUrl={app.logo_url} portalKey={app.portal_key} logoSource={app.logo_source} size="sm" />
                                  <span className="font-bold text-[#1C1C1E] max-w-[12rem] break-words">{app.company}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-[#6B6B6B] font-medium max-w-[14rem] break-words">{app.role}</td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-1.5 items-start">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  ['APPLIED', 'SENT', 'RESPONDED'].includes(displayStatus) ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                                  ['INTERVIEW', 'ENTREVISTA'].includes(displayStatus) ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                  ['OFFER', 'OFERTA'].includes(displayStatus) ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  ['REJECTED', 'DESCARTADO', 'SKIP', 'DISCARDED'].includes(displayStatus) ? 'bg-stone-100 text-stone-600' :
                                  'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {displayStatus}
                                </span>
                                {renderEngagementBadge(app)}
                              </div>
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
                                  type="button"
                                  disabled={stealthBusyAppId === Number(app.app_id)}
                                  onClick={() => copyStealthLink(Number(app.app_id))}
                                  title="Copy stealth companion link"
                                  className="p-2 border border-[#E5E5E0] rounded-lg hover:bg-[#F5F5F0] transition-all text-[#6B6B6B] hover:text-[#1C1C1E]"
                                >
                                  {stealthBusyAppId === Number(app.app_id) ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : stealthCopyAppId === Number(app.app_id) ? (
                                    <CheckCircle2 size={14} className="text-emerald-600" />
                                  ) : (
                                    <Link2 size={14} />
                                  )}
                                </button>
                                <button
                                  disabled={isAppliedStage}
                                  onClick={() => {
                                    if (isAppliedStage) return;
                                    setActiveTab('terminal');
                                    runCommand(`apply ${app.job_id} --deep`);
                                  }}
                                  title={isAppliedStage ? 'Already applied — tailor disabled' : 'Run tailor/apply'}
                                  className={`p-2 border rounded-lg transition-all ${
                                    isAppliedStage
                                      ? 'border-[#E5E5E0] bg-[#F5F5F0] text-[#9CA3AF] cursor-not-allowed'
                                      : 'border-[#E5E5E0] hover:bg-[#1C1C1E] hover:text-white'
                                  }`}
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
                          );
                          })}
                        {sortedApplications.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-5 py-12 text-center caps-mono tracking-widest text-[#9CA3AF]">
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
                    <div className="h-[min(70dvh,calc(100dvh-12rem))] min-h-[16rem] sm:min-h-[22rem] overflow-x-auto">
                      <div className="grid h-full min-w-[900px] grid-cols-5 gap-3 min-h-0">
                    {kanbanColumns.map((col) => {
                      const colApps = sortedApplications.filter((app: any) =>
                        col.statuses.includes(formatApplicationStatus(app))
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
                          className={`flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
                            appsStageFocus === col.id
                              ? 'border-[#1C1C1E] ring-2 ring-[#1C1C1E]/15 shadow-md'
                              : appsStageFocus
                                ? 'border-[#E5E5E0] opacity-40'
                                : 'border-[#E5E5E0]'
                          } ${col.color}`}
                        >
                          <div className={`h-1 shrink-0 ${col.bar}`} />
                          <div className="flex shrink-0 items-center justify-between border-b border-[#F5F5F0] px-3 py-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1C1C1E]">{col.label}</span>
                            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#1C1C1E] px-1.5 font-mono text-[10px] font-semibold text-white">{colApps.length}</span>
                          </div>

                          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
                            {colApps.map((app: any, cardIdx: number) => {
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
                                  className="group relative shrink-0 cursor-grab rounded-xl border border-[#E5E5E0] bg-white p-3.5 transition-all hover:border-[#1C1C1E]/20 hover:shadow-md active:cursor-grabbing"
                                >
                                  <div className="mb-2.5 flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-mono text-[10px] font-bold tabular-nums text-[#C4C4BE] shrink-0">
                                        {formatRowNumber(cardIdx)}
                                      </span>
                                      <JobAvatar company={app.company} url={app.url} source={app.source} logoUrl={app.logo_url} portalKey={app.portal_key} logoSource={app.logo_source} size="sm" />
                                    </div>
                                    <AiScoreBadge score={app.score} />
                                  </div>
                                  <h4 className="mb-0.5 line-clamp-2 break-words text-sm font-bold leading-snug text-[#1C1C1E]">{app.company}</h4>
                                  <p className="mb-2 line-clamp-2 break-words text-xs text-[#6B6B6B]">{app.role}</p>
                                  <div className="mb-2">{renderEngagementBadge(app)}</div>

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
                                      <button
                                        type="button"
                                        disabled={stealthBusyAppId === Number(app.app_id)}
                                        onClick={() => copyStealthLink(Number(app.app_id))}
                                        className="p-1 border border-[#E5E5E0] rounded hover:bg-[#F5F5F0] text-[#6B6B6B] transition-all"
                                        title="Copy stealth companion link"
                                      >
                                        {stealthBusyAppId === Number(app.app_id) ? (
                                          <Loader2 size={10} className="animate-spin" />
                                        ) : stealthCopyAppId === Number(app.app_id) ? (
                                          <CheckCircle2 size={10} className="text-emerald-600" />
                                        ) : (
                                          <Link2 size={10} />
                                        )}
                                      </button>
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
                actions={
                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] p-0.5">
                      <button
                        type="button"
                        onClick={() => setPipelineViewMode('studio')}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          pipelineViewMode === 'studio'
                            ? 'bg-[#1C1C1E] text-white shadow-sm'
                            : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
                        }`}
                      >
                        <Columns size={12} /> Studio 3-Col
                      </button>
                      <button
                        type="button"
                        onClick={() => setPipelineViewMode('table')}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                          pipelineViewMode === 'table'
                            ? 'bg-[#1C1C1E] text-white shadow-sm'
                            : 'text-[#6B6B6B] hover:text-[#1C1C1E]'
                        }`}
                      >
                        <List size={12} /> Table View
                      </button>
                    </div>
                    {searchActions}
                  </div>
                }
              />

              {pipelineViewMode === 'studio' ? (
                <PipelineStudioView
                  pipeline={data?.pipeline || []}
                  onEvaluate={(job) => {
                    const id = Number(job.pipeline_id ?? job.id);
                    if (Number.isFinite(id)) {
                      setActiveTab('terminal');
                      runCommand(`eval ${id}`);
                    }
                  }}
                  onTailor={(jobId) => {
                    setStudioInitialJobId(jobId);
                    setActiveTab('resume-studio');
                  }}
                  onMarkApplied={(jobId) => {
                    void handleMarkApplied(jobId);
                  }}
                  onOutreach={(job) => {
                    const id = Number(job.pipeline_id ?? job.id);
                    setOutreachTarget({
                      jobId: Number.isFinite(id) ? id : undefined,
                      company: job.company || 'Company',
                      role: job.title || 'Role',
                      url: job.url,
                    });
                  }}
                  onScan={() => {
                    setActiveTab('terminal');
                    runCommand('scan --deep');
                  }}
                  onClear={openClearPipelineModal}
                />
              ) : (
                <div className="overflow-hidden rounded-[1.5rem] border border-[#E5E5E0] bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-[#E5E5E0] bg-gradient-to-r from-[#FAFAF8] to-white p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#1C1C1E]">Live Job Pipeline</h2>
                  <p className="mt-0.5 text-xs font-medium text-[#6B6B6B]">CRM view · ranked by AI match score</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('terminal'); runCommand('scan --deep'); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1C1C1E] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#27272a]"
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
              <div className="grid grid-cols-2 gap-px border-b border-[#E5E5E0] bg-[#E5E5E0] sm:grid-cols-4">
                {[
                  { label: 'Total roles', value: filteredPipeline.length },
                  { label: 'Open', value: pipelineOpenCount },
                  { label: 'Applied', value: pipelineAppliedCount },
                  { label: 'GCC targets', value: pipelineGccCount },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white px-6 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">{stat.label}</p>
                    <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-[#1C1C1E]">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="max-h-[640px] overflow-x-auto text-sm">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 border-b border-[#E5E5E0] bg-[#FAFAF8] shadow-[0_1px_0_#E5E5E0]">
                    <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9CA3AF]">
                      <th className="w-12 px-4 py-4">#</th>
                      <th className="px-6 py-4">Target / Company</th>
                      <th className="px-6 py-4">Job Title</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">AI Score</th>
                      <th className="px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F0]">
                    {filteredPipeline.map((job: any, i: number) => {
                      const displayStatus = formatPipelineStatus(job);
                      return (
                      <tr
                        key={job.pipeline_id ?? i}
                        className={`transition-colors hover:bg-[#FAFAF8] ${jobIsApplied(job) ? 'bg-emerald-50/40' : ''}`}
                      >
                        <td className="px-4 py-5 font-mono text-[11px] font-bold tabular-nums text-[#C4C4BE]">
                          {formatRowNumber(i, filteredPipeline.length)}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <JobAvatar company={job.company} url={job.url} source={job.source} logoUrl={job.logo_url} portalKey={job.portal_key} logoSource={job.logo_source} />
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
                            {jobIsApplied(job) && job.applied_at
                              ? ` · Applied ${formatRelativeTime(job.applied_at)}`
                              : ''}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {jobIsApplied(job) ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusChipClass(displayStatus)}`}
                            >
                              <CheckCircle2 size={12} />
                              {displayStatus}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-[#E5E5E0] bg-[#FAFAF8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#6B6B6B]">Open</span>
                          )}
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
                            {jobIsApplied(job) ? (
                              <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                <CheckCircle2 size={12} />
                                Applied
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMarkApplied(Number(job.pipeline_id))}
                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-800 transition-all hover:bg-emerald-100"
                              >
                                Mark Applied
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={jobIsApplied(job)}
                              onClick={() => {
                                if (jobIsApplied(job)) return;
                                setActiveTab('terminal');
                                void requestTailor(job.pipeline_id);
                              }}
                              title={jobIsApplied(job) ? 'Already applied — Tailor disabled' : 'Tailor resume for this role'}
                              className={`rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
                                jobIsApplied(job)
                                  ? 'border-[#E5E5E0] bg-[#F5F5F0] text-[#9CA3AF] cursor-not-allowed'
                                  : 'border-[#E5E5E0] bg-white text-[#1C1C1E] hover:bg-[#FAFAF8]'
                              }`}
                            >
                              Tailor
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setOutreachTarget({
                                  jobId: Number(job.pipeline_id),
                                  company: String(job.company || ''),
                                  role: String(job.title || ''),
                                  url: String(job.url || ''),
                                })
                              }
                              className="rounded-xl border border-[#E5E5E0] bg-white px-3 py-2 text-xs font-bold text-[#1C1C1E] transition-all hover:bg-[#FAFAF8]"
                              title="Research company and draft outreach email"
                            >
                              <Mail size={14} className="inline" />
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
                                  jd_alignment_score: job.jd_alignment_score ?? null,
                                  has_resume_html: Boolean(job.has_resume_html),
                                  has_resume_pdf: Boolean(job.has_resume_pdf || job.is_tailored),
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
                      );
                    })}
                    {filteredPipeline.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center">
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
            )}
            </motion.div>
          )}

          {activeTab === 'resume-studio' && (
            <motion.div key="resume-studio" className="flex min-h-0 flex-1 flex-col">
              {billing === null ? (
                <div className="flex justify-center py-24">
                  <Loader2 className="animate-spin text-[#1C1C1E]" size={28} />
                </div>
              ) : hasPro ? (
              <div className="min-h-0 flex-1">
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
              </div>
              ) : (
                <ProPaywall
                  feature="resume-studio"
                  planDisplay={billing.plan.display}
                  planSubtitle={billing.plan.subtitle}
                  pendingPayment={billing.payment}
                />
              )}
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
              onCopyStealthLink={(jobId) => void copyStealthLinkForJob(jobId)}
              stealthBusyJobId={stealthBusyJobId}
              stealthCopiedJobId={stealthCopiedJobId}
              onOpenInStudio={(doc) =>
                openInStudio({
                  jobId: Number(doc.id),
                  company: doc.company,
                  title: doc.title,
                  score: null,
                  ats_content_score: doc.ats_content_score ?? null,
                  jd_alignment_score: doc.jd_alignment_score ?? null,
                  has_resume_html: doc.has_resume_html,
                  has_resume_pdf: doc.has_resume_pdf,
                  has_cover_letter_html: doc.has_cover_letter_html,
                  has_cover_letter_pdf: doc.has_cover_letter_pdf,
                  docKind: doc.kind === 'cover' ? 'cover' : 'resume',
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
                              {/* Resume PDF — only when tailor --deep already stored PDF (R2/BYTEA) */}
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

          {activeTab === 'analytics' && isAdmin && (
            <motion.div key="analytics" className="space-y-12">
              <AdminProductAnalyticsPanel
                data={productAnalytics}
                loading={adminLoading}
                error={adminError}
                onRefresh={() => { void loadAdminData(); }}
              />

              <AdminSubscriptionsPanel />

              <AdminFeedbackPanel />

              <AdminPaymentsPanel />

              <AdminUsersPanel
                data={adminOverview}
                loading={adminLoading}
                error={adminError}
                onRefresh={() => { void loadAdminData(); }}
              />

              <div className="border-t border-[#E5E5E0] pt-10 space-y-8">
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

              {!visitorStats && !adminLoading && (
                <div className="text-center py-20 text-[#9CA3AF]">
                  <Eye size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold">Loading analytics...</p>
                </div>
              )}
              </div>
            </motion.div>
          )}

          {activeTab === 'docs' && (
            <motion.div key="docs" className="space-y-10">
              <PageSectionHeader
                title="Tutorial & Docs"
                subtitle="Learn Career-Ops: discover jobs, score matches, tailor resumes, track applications"
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
                    Career-Ops helps you scan job boards, score roles against your profile, tailor resumes, and track where you&apos;ve applied.
                  </p>
                  <div className="space-y-4">
                    {[
                      { step: '1', title: 'Set up profile', text: 'Settings: profile, experience, education, and targeting keywords.' },
                      { step: '2', title: 'Job Discovery', text: 'gcc-scan --deep for GCC captives, or scan --deep for all boards. add <url> for a single posting.' },
                      { step: '3', title: 'Pipeline & Status', text: 'Review AI scores, Mark Applied when done, Tailor high matches.' },
                      { step: '4', title: 'GCC Outreach', text: 'GCC Campaign tab: import high-value jobs, log DMs — avoid blind Apply.' },
                      { step: '5', title: 'Tailor & Apply', text: 'Resume Studio or tailor <id> --deep for ATS PDFs; apply when ready.' },
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
                      cmd: 'gcc-scan --deep',
                      desc: 'Hunt GCC/captive employers (Stripe, Google, JPMorgan…) in Pune, Bengaluru & Hyderabad.',
                      usage: 'Separate from generic scan — only adds verified GCC employers with signal scoring.',
                      badge: 'GCC',
                      badgeColor: 'violet'
                    },
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
            <motion.div key="terminal" className="flex min-h-0 flex-1 flex-col">
              <MultiTerminalPanel
                terminalPrompt={terminalPrompt}
                onToast={(msg) => setToast({ show: true, message: msg })}
                externalCommand={externalTerminalCommand}
              />
            </motion.div>
          )}

          {activeTab === 'gcc' && (
            <GccCampaignPanel
              campaign={gccCampaign}
              onChange={setGccCampaign}
              onSave={handleSaveGccCampaign}
              onImportHighValue={importHighValueGccFromPipeline}
              onImportAllGcc={importAllGccFromPipeline}
              pipelineGccJobs={pipelineGccJobs}
              lastGccScanAdded={data?.meta?.lastGccScanAdded ?? null}
              lastGccScanAt={data?.meta?.lastGccScanAt ?? null}
              gccPipelineTotal={data?.meta?.gccPipelineCount ?? pipelineGccJobs.length}
              onOpenPipeline={() => setActiveTab('pipeline')}
              onTailorJob={(jobId: number) => {
                setActiveTab('terminal');
                void requestTailor(jobId);
              }}
              onAddToOutreach={(company: string, role: string) => addToGccCampaign(company, role)}
              onResearchDraft={(opts) => setOutreachTarget(opts)}
              highValueCount={(data?.pipeline || []).filter((j: any) => j.gcc_high_value).length}
              isSaving={isSaving}
              saveStatus={saveStatus}
            />
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" className={`${PANE_WIDTH} space-y-8`}>
               <PageSectionHeader
                 title="Settings"
                 subtitle="Profile, targeting keywords, resume import, and GitHub automation"
                 actions={
                 <div className="flex items-center gap-3">
                   <button
                     onClick={() => {
                       localStorage.removeItem(`${ONBOARDING_STORAGE_KEY}:${session?.user?.email || session?.user?.id || 'default'}`);
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

                 <ConfigSection title="Monthly Email & Referrals" icon={<Mail size={18} className="text-[#1C1C1E]" />}>
                   <div className="space-y-4">
                     <label className="flex items-start gap-3 cursor-pointer select-none">
                       <input
                         type="checkbox"
                         checked={accountInfo.newsletter_opt_in}
                         onChange={(e) => setAccountInfo({ ...accountInfo, newsletter_opt_in: e.target.checked })}
                         className="mt-1 h-4 w-4 rounded border-[#E5E5E0]"
                       />
                       <span>
                         <span className="block text-sm font-bold text-[#1C1C1E]">Monthly Career-Ops email</span>
                         <span className="block text-xs text-[#6B6B6B] mt-1 leading-relaxed">
                           One email per month with a check-in and your personal referral link. Turn off anytime.
                         </span>
                       </span>
                     </label>
                     <div className="rounded-2xl border border-[#E5E5E0] bg-[#FAFAF8] p-4 space-y-2">
                       <div className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">Your referral link</div>
                       <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                         <code className="text-xs font-semibold text-[#1C1C1E] break-all flex-1">
                           {accountInfo.referral_url || 'Save settings to generate your link'}
                         </code>
                         <button
                           type="button"
                           disabled={!accountInfo.referral_url}
                           onClick={async () => {
                             if (!accountInfo.referral_url) return;
                             try {
                               await navigator.clipboard.writeText(accountInfo.referral_url);
                               setToast({ show: true, message: 'Referral link copied' });
                             } catch {
                               setToast({ show: true, message: 'Could not copy — select the link manually' });
                             }
                           }}
                           className="shrink-0 rounded-xl bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                         >
                           Copy
                         </button>
                       </div>
                       {accountInfo.referral_code ? (
                         <p className="text-[10px] text-[#9CA3AF]">Code: {accountInfo.referral_code}</p>
                       ) : null}
                     </div>
                   </div>
                 </ConfigSection>

                 <ProductFeedbackCard context="settings" />

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
                     <div className="max-h-[min(60dvh,calc(100dvh-16rem))] overflow-y-auto pr-2 space-y-4">
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
                     <div className="max-h-[min(50dvh,calc(100dvh-18rem))] overflow-y-auto pr-2 space-y-4">
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
                        hint="Classic PAT with workflow scope. Leave blank to keep the saved token. Missing PAT shows a toast — not a raw stderr dump."
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
              className={`flex min-h-0 flex-1 flex-col ${PANE_WIDTH} mx-auto bg-white border border-[#E5E5E0] rounded-[1.25rem] sm:rounded-[2rem] overflow-hidden shadow-sm`}
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5E5E0] px-4 py-3 sm:px-6 sm:py-4 bg-[#FAFAF8]">
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
                  {billing && !hasPro && (
                    <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider">
                      {billing.copilot.remaining}/{billing.copilot.limit} free · 2hr
                    </span>
                  )}
                  {hasPro && (
                    <>
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider">Pro · Ready</span>
                    </>
                  )}
                  {!hasPro && !copilotLimitHit && (
                    <>
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider">Ready</span>
                    </>
                  )}
                </div>
              </div>

              {copilotLimitHit && !hasPro && billing && (
                <div className="border-b border-[#E5E5E0] bg-[#FAFAF8]">
                  <ProPaywall
                    feature="copilot"
                    planDisplay={billing.plan.display}
                    planSubtitle={billing.plan.subtitle}
                    copilotRemaining={billing.copilot.remaining}
                    pendingPayment={billing.payment}
                  />
                </div>
              )}

              {/* Message List */}
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 space-y-4 bg-[#FAFAF8]/40">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[80%] rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#1C1C1E] text-white shadow-sm font-medium whitespace-pre-wrap'
                          : 'bg-white text-[#1C1C1E] border border-[#E5E5E0] shadow-sm'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        msg.content
                      ) : (
                        <MarkdownMessage content={msg.content} />
                      )}
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
                <div className="px-4 py-3 sm:px-6 border-t border-[#E5E5E0]/60 bg-[#FAFAF8]/50">
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
              <div className="border-t border-[#E5E5E0] px-4 py-3 sm:px-6 sm:py-4 bg-white shrink-0">
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

          {activeTab === 'practice' && billing && (
            <motion.div
              key="practice"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.25 }}
              className={`${PANE_WIDTH} min-h-0 flex-1 overflow-x-hidden overflow-y-auto`}
            >
              <PracticePanel
                pipeline={data?.pipeline || []}
                applications={data?.applications || []}
                planDisplay={billing.plan.display}
                planSubtitle={billing.plan.subtitle}
                pendingPayment={billing.payment}
                onUpgrade={() => {
                  void fetch('/api/billing/status').then(async (r) => {
                    if (r.ok) setBilling(await r.json());
                  });
                }}
              />
            </motion.div>
          )}
          {activeTab === 'practice' && !billing && (
            <div className="flex items-center gap-2 text-sm text-[#6B6B6B]">
              <Loader2 className="animate-spin" size={16} /> Loading billing…
            </div>
          )}
        </AnimatePresence>
        </div>
        </div>
        <ProductFeedbackNudge onOpenSettings={() => goTab('settings')} />
      </main>

      {/* Job Details Modal */}
      <AntdModal
        open={jobDetailsOpen}
        onCancel={() => setJobDetailsOpen(false)}
        width={820}
        destroyOnClose
        centered
        title={
          <div>
            <div className="text-base font-bold text-zinc-900 truncate">
              {jobDetails?.company ? `${jobDetails.company} · ${jobDetails.title}` : 'Job Details'}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {jobDetails?.url && (
                <a
                  href={jobDetails.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900"
                >
                  <ExternalLink size={12} />
                  Open Posting
                </a>
              )}
              {jobIsApplied(jobDetails) && (
                <AntdTag color="success" className="text-[10px] font-bold uppercase">
                  {String(jobDetails.application_status || 'APPLIED')}
                  {jobDetails.applied_at ? ` · ${formatRelativeTime(jobDetails.applied_at)}` : ''}
                </AntdTag>
              )}
              {jobDetails?.posted_at && (
                <AntdTag color="default" className="text-[10px]">
                  Posted {formatRelativeTime(jobDetails.posted_at)}
                </AntdTag>
              )}
            </div>
          </div>
        }
        footer={
          !jobDetailsLoading && !jobDetailsError && jobDetails ? (
            <div className="flex items-center justify-end gap-2 pt-2">
              <AntdButton
                onClick={() => {
                  setJobDetailsOpen(false);
                  openInStudio({
                    jobId: Number(jobDetails.id),
                    company: jobDetails.company,
                    title: jobDetails.title,
                    score: jobDetails.score,
                    ats_content_score: jobDetails.ats_content_score ?? null,
                    jd_alignment_score: jobDetails.jd_alignment_score ?? null,
                    has_resume_html: Boolean(jobDetails.has_resume_html),
                    has_resume_pdf: Boolean(jobDetails.has_resume_pdf),
                  });
                }}
              >
                Open in Studio
              </AntdButton>
              <AntdButton
                disabled={jobIsApplied(jobDetails)}
                onClick={() => {
                  if (jobIsApplied(jobDetails)) return;
                  setJobDetailsOpen(false);
                  setActiveTab('terminal');
                  void requestTailor(jobDetails.id);
                }}
              >
                Tailor
              </AntdButton>
              <AntdButton
                disabled={jobIsApplied(jobDetails)}
                onClick={() => {
                  if (jobIsApplied(jobDetails)) return;
                  setJobDetailsOpen(false);
                  setActiveTab('terminal');
                  runCommand(`apply ${jobDetails.id} --deep`);
                }}
              >
                Apply (Auto)
              </AntdButton>
              {!jobIsApplied(jobDetails) && (
                <AntdButton
                  type="primary"
                  onClick={() => handleMarkApplied(Number(jobDetails.id), { keepModalOpen: true })}
                >
                  Mark Applied
                </AntdButton>
              )}
            </div>
          ) : null
        }
      >
        <div className="py-2 max-h-[60vh] overflow-y-auto">
          {jobDetailsLoading && (
            <div className="text-xs font-medium text-zinc-500 py-6 text-center">Loading job description…</div>
          )}
          {jobDetailsError && (
            <div className="text-xs font-bold text-red-600 py-4">Error: {jobDetailsError}</div>
          )}
          {!jobDetailsLoading && !jobDetailsError && (
            <div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                Job Description
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-800 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                {formatJdForDisplay(jobDetails?.jd_text)}
              </pre>
            </div>
          )}
        </div>
      </AntdModal>

      {/* Delete Confirmation Modal */}
      <AntdModal
        open={deleteConfirmOpen && Boolean(deleteTarget)}
        onCancel={() => !deleteLoading && setDeleteConfirmOpen(false)}
        title="Delete Job?"
        centered
        width={440}
        footer={[
          <AntdButton
            key="cancel"
            disabled={deleteLoading}
            onClick={() => setDeleteConfirmOpen(false)}
          >
            Cancel
          </AntdButton>,
          <AntdButton
            key="delete"
            danger
            type="primary"
            loading={deleteLoading}
            onClick={handleDeleteJob}
          >
            Delete
          </AntdButton>,
        ]}
      >
        {deleteTarget && (
          <div className="space-y-3 py-2">
            <p className="text-xs text-zinc-600 m-0">You are about to delete:</p>
            <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200">
              <div className="font-bold text-xs text-zinc-900">{deleteTarget.company}</div>
              <div className="text-[11px] text-zinc-500">{deleteTarget.title}</div>
            </div>
            <p className="text-[11px] text-zinc-400 m-0 leading-normal">
              This deletes the job record, application rows, and any stored tailored assets.
            </p>
          </div>
        )}
      </AntdModal>

      {/* Clear entire pipeline (bulk delete) */}
      <AntdModal
        open={clearPipelineOpen}
        onCancel={() => !clearPipelineLoading && setClearPipelineOpen(false)}
        title="Clear Job Pipeline"
        centered
        width={460}
        footer={[
          <AntdButton
            key="cancel"
            disabled={clearPipelineLoading}
            onClick={() => setClearPipelineOpen(false)}
          >
            Cancel
          </AntdButton>,
          <AntdButton
            key="clear"
            danger
            type="primary"
            loading={clearPipelineLoading}
            onClick={handleClearPipeline}
          >
            Clear Pipeline
          </AntdButton>,
        ]}
      >
        <div className="space-y-3 py-2">
          <p className="text-xs text-zinc-600 m-0">
            Choose what to remove. Application-tracked jobs will never be deleted.
          </p>
          {pipelineFilterActive ? (
            <div className="space-y-2 text-xs">
              <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50">
                <input
                  type="radio"
                  name="clear-pipeline-scope"
                  className="mt-0.5"
                  checked={clearPipelineScope === 'visible'}
                  onChange={() => setClearPipelineScope('visible')}
                />
                <div>
                  <span className="font-bold text-zinc-900">Visible rows only</span>
                  <span className="block text-[11px] text-zinc-500">
                    Delete {pipelineFiltered} job{pipelineFiltered === 1 ? '' : 's'} matching search.
                  </span>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded-lg border border-zinc-200 hover:bg-zinc-50">
                <input
                  type="radio"
                  name="clear-pipeline-scope"
                  className="mt-0.5"
                  checked={clearPipelineScope === 'all'}
                  onChange={() => setClearPipelineScope('all')}
                />
                <div>
                  <span className="font-bold text-zinc-900">Entire pipeline</span>
                  <span className="block text-[11px] text-zinc-500">
                    Delete all {pipelineTotal} job{pipelineTotal === 1 ? '' : 's'} in pipeline.
                  </span>
                </div>
              </label>
            </div>
          ) : (
            <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200 text-xs text-zinc-600">
              This will remove <strong className="text-zinc-900">{pipelineTotal}</strong> pipeline jobs and their cached descriptions.
            </div>
          )}
        </div>
      </AntdModal>

      <OutreachDraftModal target={outreachTarget} onClose={() => setOutreachTarget(null)} />
      <EngagementIntelModal
        target={engagementIntelTarget}
        onClose={() => setEngagementIntelTarget(null)}
        onCopyStealthLink={(appId) => {
          void copyStealthLink(appId);
        }}
      />

      {/* Command Palette */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigateTab={(tab) => goTab(tab)}
        onRunCommand={(cmd) => {
          goTab('terminal');
          runCommand(cmd);
        }}
        pipelineJobs={data?.pipeline || []}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-[100] max-w-[min(24rem,calc(100vw-1.5rem))] bg-[#1C1C1E] text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 border border-white/10"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CheckCircle2 size={18} className="text-[#f59e0b] shrink-0" />
              <span className="text-xs font-bold tracking-wide leading-snug">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast({ show: false, message: '' })}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
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
                  <div className="h-12 w-12 bg-gradient-to-br from-[#1C1C1E] to-[#44403c] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-black/10">
                    <div className="text-white">{steps[walkthroughStep].icon}</div>
                  </div>

                  {steps[walkthroughStep].actionHint && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-[#1C1C1E] text-[11px] font-semibold mb-3">
                      <Sparkles size={12} className="text-amber-600" />
                      <span>{steps[walkthroughStep].actionHint}</span>
                    </div>
                  )}

                  <h2 className="text-xl font-bold text-[#1C1C1E] mb-2.5 tracking-tight leading-tight">{steps[walkthroughStep].title}</h2>
                  <p className="text-[#6B6B6B] leading-relaxed text-sm">{steps[walkthroughStep].content}</p>
                </div>

                <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#F5F5F0]">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {steps.map((_, s) => (
                        <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${walkthroughStep === s ? 'bg-[#1C1C1E] w-6' : 'bg-[#E5E5E0] w-1.5'}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-stone-400 font-mono hidden sm:inline">Use ← → arrow keys</span>
                  </div>
                  <div className="flex gap-2">
                    {walkthroughStep > 0 && (
                      <button
                        onClick={() => setWalkthroughStep(walkthroughStep - 1)}
                        className="px-4 py-2.5 text-[#6B6B6B] hover:text-[#1C1C1E] rounded-xl font-bold text-xs transition-colors cursor-pointer"
                      >
                        Back
                      </button>
                    )}
                    <button
                      onClick={() => walkthroughStep < steps.length - 1 ? setWalkthroughStep(walkthroughStep + 1) : completeOnboarding()}
                      className="px-5 py-2.5 bg-[#1C1C1E] text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-[#27272a] transition-all shadow-lg shadow-black/10 cursor-pointer"
                    >
                      {walkthroughStep === steps.length - 1 ? 'Finish tour' : 'Next'}
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
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-[#FAFAF8]/50 border rounded-2xl p-4 outline-none focus:border-[#1C1C1E] transition-all text-sm font-bold text-[#1C1C1E] ${
          (value ?? '').trim() ? 'border-[#E5E5E0]' : required ? 'border-rose-200 focus:border-rose-400' : 'border-[#E5E5E0]'
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
          value={inputValue ?? ''}
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
