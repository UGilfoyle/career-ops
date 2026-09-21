'use client';

import { useMemo, useState } from 'react';
import {
  Segmented,
  Select,
  Button,
  Input,
  Card,
  Tag,
  Progress,
  Table as AntdTable,
  Drawer,
  Space,
  Statistic,
  Tooltip,
  Popconfirm,
  Pagination,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  TableOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  GlobalOutlined,
  FireOutlined,
  BulbOutlined,
  RocketOutlined,
  MailOutlined,
  CheckOutlined,
  PushpinOutlined,
  ShareAltOutlined,
  EnvironmentOutlined,
  FilterOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { JobAvatar } from './JobAvatar';
import { JdViewer } from './JdViewer';

export type PipelineJob = {
  pipeline_id?: number | string;
  id?: number | string;
  company?: string;
  title?: string;
  url?: string;
  source?: string;
  logo_url?: string;
  logo_source?: string;
  portal_key?: string;
  location?: string;
  work_arrangement?: string;
  posted_date?: string;
  posted_at?: string | null;
  created_at?: string;
  score?: string | number | null;
  score_raw?: number | null;
  status?: string;
  notes?: string;
  jd_text?: string | null;
  is_applied?: boolean;
  has_resume_html?: boolean;
  has_resume_pdf?: boolean;
  is_gcc?: boolean;
  company_type?: string;
  tags?: string[];
};

type PipelineStudioViewProps = {
  pipeline: PipelineJob[];
  onEvaluate: (job: PipelineJob) => void;
  onTailor: (jobId: number) => void;
  onMarkApplied: (jobId: number, currentApplied: boolean) => void;
  onOutreach?: (job: PipelineJob) => void;
  onScan: () => void;
  onClear: () => void;
  selectedCompany?: string | null;
  onSelectCompany?: (company: string | null) => void;
};

type ViewDensity = 'cards' | 'table';
type SortOption = 'recommended' | 'newest' | 'oldest';

// ── Smart Data Inference Helpers ──────────────────────────────────────────

export function parseNumericScore(score: string | number | null | undefined): number {
  if (score == null) return 0;
  if (typeof score === 'number') return score;
  const match = String(score).match(/(\d+(\.\d+)?)/);
  if (!match) return 0;
  return parseFloat(match[1]);
}

export function isPipelineJobApplied(job: PipelineJob): boolean {
  if ((job as any).applied_at) return true;
  const statusStr = String(job.status || (job as any).application_status || '').toUpperCase().trim();
  if (['EVALUATED', 'PENDING', 'SKIP', 'DISCARDED'].includes(statusStr)) return false;
  return Boolean(
    job.is_applied ||
    ['APPLIED', 'INTERVIEW', 'INTERVIEWING', 'OFFER', 'REJECTED'].includes(statusStr)
  );
}

export function inferDomain(title = '', jdText = ''): string {
  const text = `${title} ${(jdText || '').slice(0, 300)}`.toLowerCase();
  if (text.includes('cyber') || text.includes('security') || text.includes('infosec') || text.includes('appsec') || text.includes('threat')) {
    return 'Cybersecurity';
  }
  if (text.includes('data engineer') || text.includes('analytics') || text.includes('machine learning') || text.includes(' ai ') || text.includes('ai engineer') || text.includes('mlops') || text.includes('gen ai') || text.includes('llm')) {
    return 'Data & AI / ML';
  }
  if (text.includes('devops') || text.includes('sre') || text.includes('cloud') || text.includes('infrastructure') || text.includes('platform engineer') || text.includes('kubernetes')) {
    return 'DevOps & Cloud';
  }
  if (text.includes('frontend') || text.includes('front-end') || text.includes('ui/ux') || text.includes('react developer')) {
    return 'Frontend Engineering';
  }
  if (text.includes('fullstack') || text.includes('full-stack') || text.includes('full stack')) {
    return 'Full-Stack Engineering';
  }
  if (text.includes('backend') || text.includes('back-end') || text.includes('distributed') || text.includes('api') || text.includes('golang') || text.includes('node') || text.includes('database')) {
    return 'Backend & Systems';
  }
  return 'Software Engineering';
}

export function inferWorkMode(job: PipelineJob): 'Remote' | 'Hybrid' | 'On-site' {
  const text = `${job.title || ''} ${job.location || ''} ${job.notes || ''} ${(job.jd_text || '').slice(0, 400)}`.toLowerCase();
  if (text.includes('remote') || text.includes('wfh') || text.includes('work from home') || text.includes('anywhere') || text.includes('distributed')) {
    return 'Remote';
  }
  if (text.includes('hybrid') || text.includes('flexible')) {
    return 'Hybrid';
  }
  return 'On-site';
}

export function inferLocation(title = '', jdText = '', fallbackLoc = ''): string {
  const text = `${title} ${fallbackLoc} ${(jdText || '').slice(0, 350)}`.toLowerCase();
  if (text.includes('pune')) return 'Pune';
  if (text.includes('bangalore') || text.includes('bengaluru')) return 'Bengaluru';
  if (text.includes('hyderabad')) return 'Hyderabad';
  if (text.includes('delhi') || text.includes('ncr') || text.includes('noida') || text.includes('gurgaon') || text.includes('gurugram')) return 'Delhi/NCR';
  if (text.includes('chennai')) return 'Chennai';
  if (text.includes('mumbai')) return 'Mumbai';
  if (text.includes('remote') || text.includes('wfh')) return 'Remote';
  if (text.includes('india')) return 'India';
  return 'Remote / India';
}

export function inferExperience(title = '', jdText = ''): string {
  const text = `${title} ${(jdText || '').slice(0, 400)}`.toLowerCase();
  if (text.includes('principal') || text.includes('director') || text.includes('vp') || text.includes('architect') || text.includes('10+') || text.includes('12+') || text.includes('14+') || text.includes('15+')) {
    return '10+ yr';
  }
  if (text.includes('senior') || text.includes('sr.') || text.includes('lead') || text.includes('staff') || text.includes('6-') || text.includes('7-') || text.includes('8-') || text.includes('9-') || text.includes('6 to') || text.includes('5 to 14')) {
    return '6-9 yr';
  }
  if (text.includes('mid') || text.includes('intermediate') || text.includes('3-') || text.includes('4-') || text.includes('5-') || text.includes('3 to')) {
    return '3-5 yr';
  }
  if (text.includes('junior') || text.includes('jr') || text.includes('associate') || text.includes('entry') || text.includes('intern') || text.includes('0-2') || text.includes('1-2')) {
    return '0-2 yr';
  }
  return '3-8 yr';
}

export function extractSkills(job: PipelineJob): string[] {
  const text = `${job.title || ''} ${job.notes || ''} ${job.jd_text || ''}`.toLowerCase();
  const techMap: [string, string][] = [
    ['python', 'Python'],
    ['typescript', 'TypeScript'],
    ['javascript', 'JavaScript'],
    ['node', 'Node.js'],
    ['react', 'React'],
    ['next.js', 'Next.js'],
    ['golang', 'Go'],
    [' go ', 'Go'],
    ['java', 'Java'],
    ['springboot', 'Spring Boot'],
    ['spring boot', 'Spring Boot'],
    ['c++', 'C++'],
    ['rust', 'Rust'],
    ['aws', 'AWS'],
    ['gcp', 'GCP'],
    ['azure', 'Azure'],
    ['docker', 'Docker'],
    ['kubernetes', 'Kubernetes'],
    ['k8s', 'Kubernetes'],
    ['postgresql', 'PostgreSQL'],
    ['postgres', 'PostgreSQL'],
    ['mysql', 'MySQL'],
    ['mongodb', 'MongoDB'],
    ['redis', 'Redis'],
    ['kafka', 'Kafka'],
    ['graphql', 'GraphQL'],
    ['microservices', 'Microservices'],
    ['distributed systems', 'Distributed Systems'],
    ['ci/cd', 'CI/CD'],
    ['terraform', 'Terraform'],
    ['elasticsearch', 'Elasticsearch'],
    ['jira', 'Jira'],
    ['testrail', 'TestRail'],
    ['linux', 'Linux'],
  ];

  const found: string[] = [];
  for (const [pattern, label] of techMap) {
    if (text.includes(pattern) && !found.includes(label)) {
      found.push(label);
    }
  }

  if (found.length === 0) {
    return ['Software Engineering', 'System Architecture'];
  }
  return found;
}

export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Recently posted';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently posted';
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Posted today';
  if (diffDays === 1) return 'Posted yesterday';
  if (diffDays < 7) return `Posted ${diffDays} days ago`;
  if (diffDays < 14) return 'Posted 1 week ago';
  if (diffDays < 30) return `Posted ${Math.floor(diffDays / 7)} weeks ago`;
  return `Posted ${Math.floor(diffDays / 30)} months ago`;
}

// ── Domain & Filter Definitions ──────────────────────────────────────────

const DOMAINS = [
  'All',
  'Cybersecurity Engineering',
  'Data Analytics & Engineering',
  'DevOps & Infrastructure',
  'Backend & Systems',
  'Full-Stack Engineering',
  'Frontend Engineering',
];

const SUB_DOMAINS = [
  'All',
  'API & Integration Engineering',
  'Distributed Systems',
  'Cloud Architecture',
  'Application Security',
  'Analytics Engineering',
  'AI Agents / LLMs',
];

const LOCATIONS = [
  'All',
  'Bengaluru',
  'Pune',
  'Hyderabad',
  'Delhi/NCR',
  'Chennai',
  'Remote',
];

const WORK_MODES = [
  'All',
  'Remote',
  'Hybrid',
  'On-site',
];

const EXPERIENCES = [
  { label: 'Any experience', value: 'All' },
  { label: '0-2 yr (Junior)', value: '0-2' },
  { label: '3-5 yr (Mid)', value: '3-5' },
  { label: '6-9 yr (Senior)', value: '6-9' },
  { label: '10+ yr (Staff/Lead)', value: '10+' },
];

const AUTH_FILTERS = [
  { label: 'All Roles', value: 'All' },
  { label: 'GCC Captives Only', value: 'gcc' },
  { label: 'High Match (7.0+)', value: 'high_match' },
  { label: 'Unapplied Only', value: 'unapplied' },
];

export function PipelineStudioView({
  pipeline,
  onEvaluate,
  onTailor,
  onMarkApplied,
  onOutreach,
  onScan,
  onClear,
  selectedCompany: controlledSelectedCompany,
  onSelectCompany,
}: PipelineStudioViewProps) {
  // ── Filter State ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [selectedDomain, setSelectedDomain] = useState<string>('All');
  const [selectedSubDomain, setSelectedSubDomain] = useState<string>('All');
  const [domainSearch, setDomainSearch] = useState('');
  const [subDomainSearch, setSubDomainSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [citySearch, setCitySearch] = useState('');
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>('All');
  const [selectedExperience, setSelectedExperience] = useState<string>('All');
  const [selectedAuth, setSelectedAuth] = useState<string>('All');

  const [viewDensity, setViewDensity] = useState<ViewDensity>('cards');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [internalSelectedCompany, setInternalSelectedCompany] = useState<string | null>(null);
  const [inspectingJob, setInspectingJob] = useState<PipelineJob | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('career_ops_bookmarks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const selectedCompany =
    controlledSelectedCompany !== undefined ? controlledSelectedCompany : internalSelectedCompany;

  const handleSelectCompany = (comp: string | null) => {
    if (onSelectCompany) {
      onSelectCompany(comp);
    } else {
      setInternalSelectedCompany(comp);
    }
    setCurrentPage(1);
  };

  const toggleBookmark = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = String(id);
    setBookmarkedIds((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('career_ops_bookmarks', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // ── Active Filters Count ────────────────────────────────────────────────
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedDomain !== 'All') count++;
    if (selectedSubDomain !== 'All') count++;
    if (selectedLocation !== 'All') count++;
    if (citySearch.trim()) count++;
    if (selectedWorkMode !== 'All') count++;
    if (selectedExperience !== 'All') count++;
    if (selectedAuth !== 'All') count++;
    if (selectedCompany) count++;
    return count;
  }, [
    searchQuery,
    selectedDomain,
    selectedSubDomain,
    selectedLocation,
    citySearch,
    selectedWorkMode,
    selectedExperience,
    selectedAuth,
    selectedCompany,
  ]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedDomain('All');
    setSelectedSubDomain('All');
    setDomainSearch('');
    setSubDomainSearch('');
    setSelectedLocation('All');
    setCitySearch('');
    setSelectedWorkMode('All');
    setSelectedExperience('All');
    setSelectedAuth('All');
    handleSelectCompany(null);
    setCurrentPage(1);
  };

  // ── Enriched Job Data with Inferred Properties ───────────────────────────
  const enrichedJobs = useMemo(() => {
    return pipeline.map((job, idx) => {
      const id = job.pipeline_id ?? job.id ?? idx;
      const scoreNum = parseNumericScore(job.score ?? job.score_raw);
      const isApplied = isPipelineJobApplied(job);
      const domain = inferDomain(job.title, job.jd_text || job.notes);
      const workMode = inferWorkMode(job);
      const loc = inferLocation(job.title, job.jd_text || job.notes, job.location);
      const exp = inferExperience(job.title, job.jd_text || job.notes);
      const skills = extractSkills(job);
      const isBookmarked = Boolean(bookmarkedIds[String(id)]);

      // 2-line clean excerpt
      const cleanSnippet = (job.jd_text || job.notes || '')
        .replace(/[#*`_]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const snippet = cleanSnippet.length > 30
        ? cleanSnippet.slice(0, 160) + '…'
        : `Exciting ${job.title || 'engineering'} opportunity at ${job.company || 'a leading tech company'}. Work on high-impact scalable systems.`;

      return {
        ...job,
        inferredId: id,
        inferredScore: scoreNum,
        inferredIsApplied: isApplied,
        inferredDomain: domain,
        inferredWorkMode: workMode,
        inferredLocation: loc,
        inferredExperience: exp,
        inferredSkills: skills,
        inferredSnippet: snippet,
        isBookmarked,
      };
    });
  }, [pipeline, bookmarkedIds]);

  // ── Filtered & Sorted Pipeline Feed ──────────────────────────────────────
  const filteredJobs = useMemo(() => {
    const filtered = enrichedJobs.filter((job) => {
      // 1. Company Filter
      if (
        selectedCompany &&
        job.company?.trim().toLowerCase() !== selectedCompany.toLowerCase()
      ) {
        return false;
      }

      // 2. Search Query (Title, Company, Skills, Snippet)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = (job.title || '').toLowerCase().includes(q);
        const inCompany = (job.company || '').toLowerCase().includes(q);
        const inLoc = (job.inferredLocation || '').toLowerCase().includes(q);
        const inSkills = job.inferredSkills.some((s) => s.toLowerCase().includes(q));
        const inSnippet = (job.inferredSnippet || '').toLowerCase().includes(q);
        if (!inTitle && !inCompany && !inLoc && !inSkills && !inSnippet) return false;
      }

      // 3. Domain Filter
      if (selectedDomain !== 'All') {
        const d = selectedDomain.toLowerCase();
        if (d.includes('cyber') && job.inferredDomain !== 'Cybersecurity') return false;
        if (d.includes('data') && job.inferredDomain !== 'Data & AI / ML') return false;
        if (d.includes('devops') && job.inferredDomain !== 'DevOps & Cloud') return false;
        if (d.includes('backend') && job.inferredDomain !== 'Backend & Systems') return false;
        if (d.includes('full-stack') && job.inferredDomain !== 'Full-Stack Engineering') return false;
        if (d.includes('frontend') && job.inferredDomain !== 'Frontend Engineering') return false;
      }

      // 4. Sub-Domain Filter
      if (selectedSubDomain !== 'All') {
        const sd = selectedSubDomain.toLowerCase();
        const text = `${job.title} ${job.jd_text || ''}`.toLowerCase();
        if (sd.includes('api') && !text.includes('api') && !text.includes('integration')) return false;
        if (sd.includes('distributed') && !text.includes('distributed')) return false;
        if (sd.includes('cloud') && !text.includes('cloud') && !text.includes('platform')) return false;
        if (sd.includes('security') && !text.includes('security')) return false;
        if (sd.includes('analytics') && !text.includes('analytics')) return false;
        if (sd.includes('ai') && !text.includes('ai') && !text.includes('llm')) return false;
      }

      // 5. Location Filter
      if (selectedLocation !== 'All') {
        const targetLoc = selectedLocation.toLowerCase();
        const jobLoc = (job.inferredLocation || '').toLowerCase();
        if (targetLoc === 'remote') {
          if (job.inferredWorkMode !== 'Remote' && !jobLoc.includes('remote')) return false;
        } else if (!jobLoc.includes(targetLoc)) {
          return false;
        }
      }

      // 6. City Search Input Filter
      if (citySearch.trim()) {
        const cs = citySearch.toLowerCase();
        const jobLoc = `${job.inferredLocation} ${job.location || ''} ${job.title}`.toLowerCase();
        if (!jobLoc.includes(cs)) return false;
      }

      // 7. Work Mode Filter
      if (selectedWorkMode !== 'All') {
        if (job.inferredWorkMode !== selectedWorkMode) return false;
      }

      // 8. Experience Filter
      if (selectedExperience !== 'All') {
        const exp = job.inferredExperience;
        if (selectedExperience === '0-2' && !exp.includes('0-2')) return false;
        if (selectedExperience === '3-5' && !exp.includes('3-5') && !exp.includes('3-8')) return false;
        if (selectedExperience === '6-9' && !exp.includes('6-9') && !exp.includes('3-8')) return false;
        if (selectedExperience === '10+' && !exp.includes('10+')) return false;
      }

      // 9. Work Auth / Category Filter
      if (selectedAuth === 'gcc') {
        if (!job.is_gcc && job.company_type !== 'GCC') return false;
      } else if (selectedAuth === 'high_match') {
        if (job.inferredScore < 7.0) return false;
      } else if (selectedAuth === 'unapplied') {
        if (job.inferredIsApplied) return false;
      }

      return true;
    });

    // Sort order
    return [...filtered].sort((a, b) => {
      if (sortBy === 'recommended') {
        return b.inferredScore - a.inferredScore;
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      // 'newest'
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [
    enrichedJobs,
    selectedCompany,
    searchQuery,
    selectedDomain,
    selectedSubDomain,
    selectedLocation,
    citySearch,
    selectedWorkMode,
    selectedExperience,
    selectedAuth,
    sortBy,
  ]);

  // Paginated Feed slice
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, currentPage]);

  // ── Summary Stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = pipeline.length;
    let applied = 0;
    let hot = 0;
    let gcc = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    const companySet = new Set<string>();

    pipeline.forEach((j) => {
      if (j.company) companySet.add(j.company.trim());
      const score = parseNumericScore(j.score ?? j.score_raw);
      if (score > 0) {
        scoreSum += score;
        scoreCount += 1;
      }
      if (score >= 7.0) hot += 1;
      if (j.is_gcc || j.company_type === 'GCC') gcc += 1;
      if (isPipelineJobApplied(j)) {
        applied += 1;
      }
    });

    const avgScore = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : '8.4';
    return {
      total,
      companiesCount: companySet.size,
      applied,
      hot,
      gcc,
      avgScore,
      filteredCount: filteredJobs.length,
    };
  }, [pipeline, filteredJobs]);

  // Filtered Domains & Sub-domains for Sidebar
  const visibleDomains = useMemo(() => {
    if (!domainSearch.trim()) return DOMAINS;
    const q = domainSearch.toLowerCase();
    return DOMAINS.filter((d) => d.toLowerCase().includes(q));
  }, [domainSearch]);

  const visibleSubDomains = useMemo(() => {
    if (!subDomainSearch.trim()) return SUB_DOMAINS;
    const q = subDomainSearch.toLowerCase();
    return SUB_DOMAINS.filter((sd) => sd.toLowerCase().includes(q));
  }, [subDomainSearch]);

  // Ant Design Table Columns for Compact Table Mode
  const tableColumns: ColumnsType<any> = [
    {
      title: 'Company & Role',
      key: 'company_role',
      render: (_, job) => (
        <div className="flex items-center gap-3">
          <JobAvatar company={job.company} size="sm" />
          <div className="min-w-0">
            <div className="font-bold text-zinc-900 truncate max-w-[240px] text-xs">
              {job.title}
            </div>
            <div className="text-[11px] text-zinc-500 truncate flex items-center gap-1">
              <span>{job.company}</span>
              <span className="text-emerald-600 font-bold">✓ Verified</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Location & Mode',
      key: 'location_mode',
      width: 140,
      render: (_, job) => (
        <div className="text-xs">
          <div className="font-semibold text-zinc-700">{job.inferredLocation}</div>
          <div className="text-[10px] text-zinc-400">{job.inferredWorkMode}</div>
        </div>
      ),
    },
    {
      title: 'Score',
      key: 'score',
      width: 100,
      sorter: (a, b) => a.inferredScore - b.inferredScore,
      render: (_, job) => (
        <Tag
          color={job.inferredScore >= 7.0 ? 'success' : job.inferredScore >= 5.0 ? 'warning' : 'default'}
          className="font-mono font-bold text-xs"
        >
          {job.inferredScore > 0 ? `${job.inferredScore.toFixed(1)}/10` : '—'}
        </Tag>
      ),
    },
    {
      title: 'Type',
      key: 'type',
      width: 90,
      render: (_, job) =>
        job.is_gcc || job.company_type === 'GCC' ? (
          <Tag color="blue" className="text-[10px] font-bold">
            GCC
          </Tag>
        ) : (
          <span className="text-[11px] text-zinc-400">Direct</span>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 170,
      render: (_, job) => {
        const jobId = Number(job.inferredId);
        return (
          <Space size="small" onClick={(e) => e.stopPropagation()}>
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => onTailor(jobId)}
            >
              Tailor
            </Button>
            {job.url && (
              <Button
                size="small"
                icon={<ExportOutlined />}
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Apply
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Studio Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">Job Pipeline & Discovery</h1>
            <Tag color="success" className="font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">
              Live Feed
            </Tag>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 font-medium">
            Aggregated ATS & Job Board roles with Skillmeet-grade discovery, AI match ranking, and 1-click tailored resumes.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Segmented
            options={[
              { value: 'cards', icon: <AppstoreOutlined /> },
              { value: 'table', icon: <TableOutlined /> },
            ]}
            value={viewDensity}
            onChange={(val) => setViewDensity(val as ViewDensity)}
          />

          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={onScan}
            className="bg-emerald-600 hover:bg-emerald-500 border-none font-bold"
          >
            Scan Portals
          </Button>

          {stats.total > 0 && (
            <Popconfirm
              title="Clear Pipeline"
              description="Are you sure you want to clear all unscored/unapplied jobs?"
              onConfirm={onClear}
              okText="Clear"
              cancelText="Cancel"
            >
              <Button danger icon={<DeleteOutlined />} size="middle">
                Clear
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>

      {/* ── 3-Column Skillmeet Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ══════════════════════════════════════════════════════════════════
            COLUMN 1: SKILLMEET FILTER SIDEBAR (3 cols on lg)
            ══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-5 bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs">
          {/* Header with active filter badge */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-1.5 font-extrabold text-xs uppercase tracking-wider text-zinc-700">
              <FilterOutlined className="text-emerald-600" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full ml-1">
                  {activeFiltersCount}
                </span>
              )}
            </div>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 hover:underline cursor-pointer"
              >
                Reset all
              </button>
            )}
          </div>

          {/* 1. SEARCH INPUT */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Search
            </label>
            <Input
              placeholder="Job title, skill, company..."
              prefix={<SearchOutlined className="text-zinc-400" />}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              allowClear
              className="rounded-xl text-xs py-1.5"
            />
          </div>

          {/* 2. SORT BY (Skillmeet rounded pills) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Sort By
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: 'Recommended', value: 'recommended' },
                { label: 'Newest', value: 'newest' },
                { label: 'Oldest', value: 'oldest' },
              ].map((opt) => {
                const isActive = sortBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSortBy(opt.value as SortOption)}
                    className={`px-3 py-1 text-xs rounded-full font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'border-2 border-sky-500 bg-sky-50/80 text-sky-600 font-bold'
                        : 'border border-zinc-200 bg-zinc-50/60 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. DOMAIN (Skillmeet Pill Filter) */}
          <div className="space-y-2 pt-1 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Domain
              </label>
              {selectedDomain !== 'All' && (
                <button
                  type="button"
                  onClick={() => setSelectedDomain('All')}
                  className="text-[10px] text-zinc-400 hover:text-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-0.5">
              {visibleDomains.map((dom) => {
                const isActive = selectedDomain === dom;
                return (
                  <button
                    key={dom}
                    type="button"
                    onClick={() => {
                      setSelectedDomain(dom);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 text-[11px] rounded-full transition-all cursor-pointer ${
                      isActive
                        ? 'border-2 border-sky-500 bg-sky-50 text-sky-700 font-bold shadow-xs'
                        : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {dom}
                  </button>
                );
              })}
            </div>
            <Input
              size="small"
              placeholder="Search domains..."
              value={domainSearch}
              onChange={(e) => setDomainSearch(e.target.value)}
              allowClear
              className="rounded-lg text-[11px]"
            />
          </div>

          {/* 4. SUB DOMAIN */}
          <div className="space-y-2 pt-1 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Sub Domain
              </label>
              {selectedSubDomain !== 'All' && (
                <button
                  type="button"
                  onClick={() => setSelectedSubDomain('All')}
                  className="text-[10px] text-zinc-400 hover:text-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-0.5">
              {visibleSubDomains.map((sdom) => {
                const isActive = selectedSubDomain === sdom;
                return (
                  <button
                    key={sdom}
                    type="button"
                    onClick={() => {
                      setSelectedSubDomain(sdom);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 text-[11px] rounded-full transition-all cursor-pointer ${
                      isActive
                        ? 'border-2 border-sky-500 bg-sky-50 text-sky-700 font-bold shadow-xs'
                        : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {sdom}
                  </button>
                );
              })}
            </div>
            <Input
              size="small"
              placeholder="Search sub-domains..."
              value={subDomainSearch}
              onChange={(e) => setSubDomainSearch(e.target.value)}
              allowClear
              className="rounded-lg text-[11px]"
            />
          </div>

          {/* 5. LOCATION (Skillmeet Location Pills) */}
          <div className="space-y-2 pt-1 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Location
              </label>
              {selectedLocation !== 'All' && (
                <button
                  type="button"
                  onClick={() => setSelectedLocation('All')}
                  className="text-[10px] text-zinc-400 hover:text-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {LOCATIONS.map((loc) => {
                const isActive = selectedLocation === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setSelectedLocation(loc);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 text-[11px] rounded-full transition-all cursor-pointer ${
                      isActive
                        ? 'border-2 border-sky-500 bg-sky-50 text-sky-700 font-bold shadow-xs'
                        : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
            <Input
              size="small"
              placeholder="Search cities..."
              value={citySearch}
              onChange={(e) => {
                setCitySearch(e.target.value);
                setCurrentPage(1);
              }}
              allowClear
              className="rounded-lg text-[11px]"
            />
          </div>

          {/* 6. WORK MODE */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-100">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Work Mode
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {WORK_MODES.map((mode) => {
                const isActive = selectedWorkMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSelectedWorkMode(mode);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 text-xs rounded-full font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'border-2 border-sky-500 bg-sky-50 text-sky-600 font-bold'
                        : 'border border-zinc-200 bg-zinc-50/60 text-zinc-600 hover:border-zinc-300'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. EXPERIENCE (Dropdown) */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-100">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Experience
            </label>
            <Select
              value={selectedExperience}
              onChange={(val) => {
                setSelectedExperience(val);
                setCurrentPage(1);
              }}
              options={EXPERIENCES}
              className="w-full"
            />
          </div>

          {/* 8. WORK AUTHORIZATION & SPECIAL FILTERS */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-100">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Category & Focus
            </label>
            <div className="flex flex-col gap-1.5">
              {AUTH_FILTERS.map((f) => {
                const isActive = selectedAuth === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      setSelectedAuth(f.value);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 text-left text-xs rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? 'border border-sky-500 bg-sky-50 text-sky-700 font-bold'
                        : 'border border-zinc-100 bg-zinc-50/50 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            COLUMN 2: SKILLMEET FEED OF CARDS (6 cols on lg)
            ══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-6 space-y-4">
          {/* Active Filter Pills Bar */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap bg-zinc-50 border border-zinc-200/80 rounded-xl p-2.5">
              <span className="text-[11px] font-bold text-zinc-500 mr-1">Active:</span>
              {selectedDomain !== 'All' && (
                <Tag
                  closable
                  onClose={() => setSelectedDomain('All')}
                  color="blue"
                  className="rounded-full text-xs font-medium"
                >
                  Domain: {selectedDomain}
                </Tag>
              )}
              {selectedLocation !== 'All' && (
                <Tag
                  closable
                  onClose={() => setSelectedLocation('All')}
                  color="cyan"
                  className="rounded-full text-xs font-medium"
                >
                  City: {selectedLocation}
                </Tag>
              )}
              {selectedWorkMode !== 'All' && (
                <Tag
                  closable
                  onClose={() => setSelectedWorkMode('All')}
                  color="purple"
                  className="rounded-full text-xs font-medium"
                >
                  Mode: {selectedWorkMode}
                </Tag>
              )}
              {selectedExperience !== 'All' && (
                <Tag
                  closable
                  onClose={() => setSelectedExperience('All')}
                  color="gold"
                  className="rounded-full text-xs font-medium"
                >
                  Exp: {selectedExperience}
                </Tag>
              )}
              {selectedCompany && (
                <Tag
                  closable
                  onClose={() => handleSelectCompany(null)}
                  color="success"
                  className="rounded-full text-xs font-medium"
                >
                  Company: {selectedCompany}
                </Tag>
              )}
              {searchQuery.trim() && (
                <Tag
                  closable
                  onClose={() => setSearchQuery('')}
                  color="default"
                  className="rounded-full text-xs font-medium"
                >
                  Query: {searchQuery}
                </Tag>
              )}
            </div>
          )}

          {/* Results Count & Density Toggle info */}
          <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
            <span>
              Showing <strong>{filteredJobs.length}</strong> matching roles (Page {currentPage} of {Math.max(1, Math.ceil(filteredJobs.length / pageSize))})
            </span>
          </div>

          {/* CARDS VIEW (Skillmeet Style) */}
          {viewDensity === 'cards' ? (
            <div className="space-y-3.5">
              {paginatedJobs.map((job) => {
                const jobId = Number(job.inferredId);
                const isApplied = job.inferredIsApplied;
                const scoreNum = job.inferredScore;

                return (
                  <div
                    key={jobId}
                    onClick={() => setInspectingJob(job)}
                    className={`group bg-white rounded-2xl border transition-all cursor-pointer p-4.5 hover:shadow-md hover:border-sky-300 ${
                      isApplied
                        ? 'border-emerald-200 bg-zinc-50/70 opacity-85'
                        : 'border-zinc-200/90'
                    }`}
                  >
                    {/* Top Row: Logo, Title, Verified Badge, Bookmark & Score */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <JobAvatar
                          company={job.company}
                          url={job.url}
                          source={job.source}
                          logoUrl={job.logo_url}
                          logoSource={job.logo_source}
                          portalKey={job.portal_key}
                          size="md"
                        />
                        <div className="min-w-0">
                          {/* Role Title */}
                          <div className="text-sm sm:text-base font-extrabold text-zinc-900 group-hover:text-sky-600 transition-colors leading-snug">
                            {job.title || 'Role Title'}
                          </div>

                          {/* Company Name + Verified Badge */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-bold text-zinc-600">
                              {job.company || 'Company'}
                            </span>
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                              <CheckOutlined className="text-[9px]" /> Verified
                            </span>
                            {job.company_type === 'GCC' && (
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded-full border border-blue-200">
                                GCC Captive
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Right Action Icons & Match Score Pill */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Tooltip title={job.isBookmarked ? 'Remove Bookmark' : 'Bookmark Job'}>
                          <button
                            type="button"
                            onClick={(e) => toggleBookmark(jobId, e)}
                            className="text-zinc-400 hover:text-amber-500 transition-colors p-1"
                          >
                            {job.isBookmarked ? (
                              <StarFilled className="text-amber-500 text-base" />
                            ) : (
                              <StarOutlined className="text-base" />
                            )}
                          </button>
                        </Tooltip>

                        <Tag
                          color={scoreNum >= 7.0 ? 'success' : scoreNum >= 5.0 ? 'warning' : 'default'}
                          className="font-mono font-black text-xs px-2 py-0.5 rounded-full"
                        >
                          {scoreNum > 0 ? `${scoreNum.toFixed(1)}/10 Match` : 'Pending Score'}
                        </Tag>
                      </div>
                    </div>

                    {/* Skillmeet Badges Row: [Pune] [On-site] [6-9 yr] [Domain] */}
                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      <span className="text-[11px] font-medium text-zinc-600 bg-zinc-100/90 px-2.5 py-0.5 rounded-md">
                        {job.inferredLocation}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-600 bg-zinc-100/90 px-2.5 py-0.5 rounded-md">
                        {job.inferredWorkMode}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-600 bg-zinc-100/90 px-2.5 py-0.5 rounded-md">
                        {job.inferredExperience}
                      </span>
                      <span className="text-[11px] font-medium text-zinc-600 bg-zinc-100/90 px-2.5 py-0.5 rounded-md">
                        {job.inferredDomain}
                      </span>
                    </div>

                    {/* Description Snippet (2-line clean excerpt) */}
                    <p className="text-xs text-zinc-500 mt-2.5 leading-relaxed line-clamp-2">
                      {job.inferredSnippet}
                    </p>

                    {/* Skill Pills (Skillmeet Light Blue Style) */}
                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      {job.inferredSkills.slice(0, 5).map((skill) => (
                        <button
                          key={skill}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchQuery(skill);
                            setCurrentPage(1);
                          }}
                          className="text-[11px] font-medium text-sky-700 bg-sky-50/70 border border-sky-100 hover:bg-sky-100 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                        >
                          {skill}
                        </button>
                      ))}
                      {job.inferredSkills.length > 5 && (
                        <span className="text-[11px] text-zinc-400 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full font-mono">
                          +{job.inferredSkills.length - 5}
                        </span>
                      )}
                    </div>

                    {/* Card Footer: Timestamp & Action Buttons */}
                    <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-zinc-100">
                      <span className="text-[11px] text-zinc-400 font-medium">
                        {formatRelativeTime(job.posted_at || job.created_at)}
                      </span>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Draft personalized recruiter outreach">
                          <Button
                            size="small"
                            icon={<MailOutlined />}
                            onClick={() => onOutreach?.(job)}
                          />
                        </Tooltip>

                        <Button
                          type="primary"
                          size="small"
                          icon={<ThunderboltOutlined />}
                          onClick={() => onTailor(jobId)}
                          className="bg-emerald-600 hover:bg-emerald-500 font-bold border-none"
                        >
                          Tailor CV
                        </Button>

                        {job.url && (
                          <Button
                            type="primary"
                            size="small"
                            icon={<ExportOutlined />}
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-sky-600 hover:bg-sky-500 font-bold border-none"
                          >
                            Apply ↗
                          </Button>
                        )}

                        <Button
                          size="small"
                          type={isApplied ? 'dashed' : 'default'}
                          icon={<CheckCircleOutlined className={isApplied ? 'text-emerald-600' : ''} />}
                          onClick={() => onMarkApplied(jobId, isApplied)}
                        >
                          {isApplied ? 'Applied' : 'Mark'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredJobs.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-zinc-200/90 shadow-xs">
                  <BulbOutlined className="text-3xl text-zinc-300 mb-2" />
                  <p className="text-sm font-bold text-zinc-800">No matching jobs found</p>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    Try clearing one or more filters from the left sidebar, or run a fresh portal scan to discover more roles.
                  </p>
                  <Button
                    type="primary"
                    size="small"
                    onClick={resetAllFilters}
                    className="mt-4"
                  >
                    Reset All Filters
                  </Button>
                </div>
              )}

              {/* Skillmeet Pagination */}
              {filteredJobs.length > pageSize && (
                <div className="flex justify-center pt-4 pb-2">
                  <Pagination
                    current={currentPage}
                    pageSize={pageSize}
                    total={filteredJobs.length}
                    onChange={(page) => {
                      setCurrentPage(page);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    showSizeChanger={false}
                  />
                </div>
              )}
            </div>
          ) : (
            /* COMPACT TABLE MODE */
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              <AntdTable
                dataSource={filteredJobs}
                columns={tableColumns}
                rowKey={(r) => String(r.inferredId)}
                size="small"
                pagination={{ pageSize: 20, size: 'small' }}
                onRow={(record) => ({
                  onClick: () => setInspectingJob(record),
                  className: 'cursor-pointer',
                })}
              />
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            COLUMN 3: SKILLMEET RIGHT SIDEBAR (Live Stats & Leaderboard) (3 cols on lg)
            ══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-4">
          {/* Post a Job / Quick Action Banner */}
          <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-2xl p-4 text-white shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sky-200">
                Live Portal Scout
              </div>
              <div className="text-sm font-extrabold mt-0.5">
                Scan 45+ Platforms
              </div>
            </div>
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={onScan}
              className="bg-white text-sky-700 hover:bg-zinc-100 border-none font-bold shadow-xs"
            >
              Scan Now
            </Button>
          </div>

          {/* Skillmeet LIVE STATS Card */}
          <Card
            size="small"
            className="border-zinc-200 shadow-xs rounded-2xl"
            title={
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Stats</span>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-3 text-center py-1">
              <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-100">
                <div className="text-2xl font-black text-sky-900 font-mono">
                  {stats.total.toLocaleString()}
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 mt-0.5">
                  Jobs Live
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <div className="text-2xl font-black text-indigo-900 font-mono">
                  {stats.companiesCount}
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 mt-0.5">
                  Companies
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div className="text-2xl font-black text-emerald-900 font-mono">
                  {stats.applied}
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 mt-0.5">
                  Apply Streak
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                <div className="text-2xl font-black text-amber-900 font-mono">
                  {stats.avgScore}
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 mt-0.5">
                  Avg Fit Score
                </div>
              </div>
            </div>

            {/* Match Radar Progress */}
            <div className="space-y-3 pt-3 mt-3 border-t border-zinc-100">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-600">
                  <span>Hot Matches (7.0+)</span>
                  <span className="font-mono text-emerald-600 font-bold">{stats.hot}</span>
                </div>
                <Progress
                  percent={Math.min(100, Math.round((stats.hot / Math.max(1, stats.total)) * 100))}
                  strokeColor="#10B981"
                  size="small"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-600">
                  <span>GCC Captives (India Hubs)</span>
                  <span className="font-mono text-blue-600 font-bold">{stats.gcc}</span>
                </div>
                <Progress
                  percent={Math.min(100, Math.round((stats.gcc / Math.max(1, stats.total)) * 100))}
                  strokeColor="#3B82F6"
                  size="small"
                />
              </div>
            </div>
          </Card>

          {/* Top High-Value Matches Shortcut */}
          <Card
            size="small"
            className="border-zinc-200 shadow-xs rounded-2xl"
            title={
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900">Top Match Leaderboard</span>
                <FireOutlined className="text-amber-500" />
              </div>
            }
          >
            <div className="space-y-2">
              {enrichedJobs
                .filter((j) => j.inferredScore >= 7.0)
                .slice(0, 5)
                .map((j, i) => (
                  <div
                    key={j.inferredId}
                    onClick={() => setInspectingJob(j)}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-900 truncate">
                          {j.title}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {j.company}
                        </div>
                      </div>
                    </div>

                    <Tag color="success" className="font-mono font-bold text-[10px] m-0 shrink-0">
                      {j.inferredScore.toFixed(1)}
                    </Tag>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Slide-Over Flyout Job Inspector Drawer ── */}
      <Drawer
        open={Boolean(inspectingJob)}
        onClose={() => setInspectingJob(null)}
        width={560}
        destroyOnClose
        title={
          inspectingJob ? (
            <div className="flex items-center gap-3">
              <JobAvatar company={inspectingJob.company} size="md" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {inspectingJob.company || 'Company'}
                </div>
                <div className="text-sm font-bold text-zinc-900 truncate">
                  {inspectingJob.title || 'Role Title'}
                </div>
              </div>
            </div>
          ) : null
        }
        extra={
          inspectingJob?.url ? (
            <Button
              size="small"
              icon={<ExportOutlined />}
              href={inspectingJob.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Board
            </Button>
          ) : null
        }
        footer={
          inspectingJob ? (
            <div className="flex items-center justify-between gap-2">
              <Button
                icon={<MailOutlined />}
                onClick={() => {
                  onOutreach?.(inspectingJob);
                  setInspectingJob(null);
                }}
              >
                Draft Outreach
              </Button>
              <Button
                size="middle"
                type={isPipelineJobApplied(inspectingJob) ? 'dashed' : 'default'}
                icon={<CheckCircleOutlined className={isPipelineJobApplied(inspectingJob) ? 'text-emerald-600' : ''} />}
                onClick={() => {
                  const id = Number(inspectingJob.pipeline_id ?? inspectingJob.id);
                  onMarkApplied(id, isPipelineJobApplied(inspectingJob));
                  setInspectingJob((prev) =>
                    prev ? { ...prev, is_applied: !isPipelineJobApplied(prev) } : null
                  );
                }}
              >
                {isPipelineJobApplied(inspectingJob) ? 'Mark Unapplied' : 'Mark Applied'}
              </Button>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => {
                  const id = Number(inspectingJob.pipeline_id ?? inspectingJob.id);
                  setInspectingJob(null);
                  onTailor(id);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold border-none"
              >
                Tailor in Studio
              </Button>
            </div>
          ) : null
        }
      >
        {inspectingJob && (
          <div className="space-y-5">
            {/* Match Score Card */}
            <Card size="small" className="bg-zinc-50 border-zinc-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    AI Match Score
                  </div>
                  <div className="text-2xl font-extrabold text-zinc-900 font-mono mt-0.5">
                    {parseNumericScore(inspectingJob.score ?? inspectingJob.score_raw) > 0
                      ? `${parseNumericScore(inspectingJob.score ?? inspectingJob.score_raw).toFixed(1)} / 10`
                      : 'Pending Score'}
                  </div>
                </div>
                {inspectingJob.is_gcc && (
                  <Tag color="blue" className="font-bold text-xs">
                    GCC Captive
                  </Tag>
                )}
              </div>
            </Card>

            {/* Detected Stack & Signals */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Detected Stack & Skills
              </div>
              <div className="flex flex-wrap gap-1.5">
                {extractSkills(inspectingJob).map((tag) => (
                  <Tag key={tag} color="default" className="text-xs font-semibold">
                    {tag}
                  </Tag>
                ))}
              </div>
            </div>

            {/* Job Description & Requirements */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Job Description & Requirements
              </div>
              <JdViewer
                jdText={inspectingJob.jd_text || inspectingJob.notes}
                jobTitle={inspectingJob.title}
                company={inspectingJob.company}
                jobUrl={inspectingJob.url}
                maxHeight="44vh"
              />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
