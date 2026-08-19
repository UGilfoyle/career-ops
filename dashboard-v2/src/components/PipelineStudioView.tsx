'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  Flame,
  Globe,
  Layers,
  Mail,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JobAvatar, CompanyAvatar } from './JobAvatar';
import { MatchProgressRing } from './resume-studio/MatchProgressRing';

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
  created_at?: string;
  score?: string | number | null;
  score_raw?: number | null;
  status?: string;
  notes?: string;
  is_applied?: boolean;
  has_resume_html?: boolean;
  has_resume_pdf?: boolean;
  is_gcc?: boolean;
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
  onSelectCompany?: (company: string | null) => void;
  selectedCompany?: string | null;
};

type FilterTab = 'all' | 'hot' | 'gcc' | 'applied';

function parseNumericScore(score: string | number | null | undefined): number {
  if (score == null) return 0;
  if (typeof score === 'number') return score;
  const match = String(score).match(/(\d+(\.\d+)?)/);
  if (!match) return 0;
  return parseFloat(match[1]);
}

function extractTechTags(title?: string, notes?: string): string[] {
  const text = `${title || ''} ${notes || ''}`.toLowerCase();
  const known = [
    'React', 'Node.js', 'TypeScript', 'Python', 'Go', 'AWS', 'Next.js',
    'Kubernetes', 'GraphQL', 'Backend', 'Frontend', 'Full Stack', 'Cloud AI',
    'Machine Learning', 'DevOps', 'Distributed Systems', 'PostgreSQL'
  ];
  const found = known.filter((k) => text.includes(k.toLowerCase()));
  if (found.length > 0) return found.slice(0, 3);
  if (text.includes('engineer') || text.includes('developer')) return ['Software Eng', 'System Architecture'];
  return ['Full Stack', 'Engineering'];
}

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
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [companySearch, setCompanySearch] = useState('');
  const [internalSelectedCompany, setInternalSelectedCompany] = useState<string | null>(null);
  const [followedCompanies, setFollowedCompanies] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('career_ops_followed_companies');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const selectedCompany = controlledSelectedCompany !== undefined ? controlledSelectedCompany : internalSelectedCompany;

  const toggleFollow = (company: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowedCompanies((prev) => {
      const next = { ...prev, [company]: !prev[company] };
      try {
        localStorage.setItem('career_ops_followed_companies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSelectCompany = (comp: string | null) => {
    if (onSelectCompany) onSelectCompany(comp);
    else setInternalSelectedCompany(comp);
  };

  // Company Watchlist aggregation
  const companiesList = useMemo(() => {
    const map = new Map<string, { count: number; maxScore: number; isGcc: boolean; sampleJob: PipelineJob }>();
    for (const job of pipeline) {
      const name = job.company?.trim() || 'Unknown';
      const score = parseNumericScore(job.score ?? job.score_raw);
      const existing = map.get(name);
      if (existing) {
        existing.count += 1;
        existing.maxScore = Math.max(existing.maxScore, score);
        if (job.is_gcc) existing.isGcc = true;
      } else {
        map.set(name, { count: 1, maxScore: score, isGcc: Boolean(job.is_gcc), sampleJob: job });
      }
    }
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      ...data,
      isFollowed: Boolean(followedCompanies[name]),
    })).sort((a, b) => {
      if (a.isFollowed && !b.isFollowed) return -1;
      if (!a.isFollowed && b.isFollowed) return 1;
      return b.maxScore - a.maxScore;
    });
  }, [pipeline, followedCompanies]);

  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companiesList;
    const q = companySearch.toLowerCase();
    return companiesList.filter((c) => c.name.toLowerCase().includes(q));
  }, [companiesList, companySearch]);

  // Filtered Job Pipeline
  const filteredJobs = useMemo(() => {
    return pipeline.filter((job) => {
      // Company filter
      if (selectedCompany && (job.company?.trim().toLowerCase() !== selectedCompany.toLowerCase())) {
        return false;
      }

      // Tab filter
      const score = parseNumericScore(job.score ?? job.score_raw);
      const isApplied = Boolean(job.is_applied || (typeof job.status === 'string' && job.status.toLowerCase().includes('applied')));

      if (filterTab === 'hot' && score < 7.0) return false;
      if (filterTab === 'gcc' && !job.is_gcc) return false;
      if (filterTab === 'applied' && !isApplied) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const comp = (job.company || '').toLowerCase();
        const title = (job.title || '').toLowerCase();
        const loc = (job.location || '').toLowerCase();
        if (!comp.includes(q) && !title.includes(q) && !loc.includes(q)) return false;
      }

      return true;
    });
  }, [pipeline, selectedCompany, filterTab, searchQuery]);

  // Analytics Metrics
  const stats = useMemo(() => {
    const total = pipeline.length;
    let applied = 0;
    let hot = 0;
    let gcc = 0;
    let scoreSum = 0;
    let scoreCount = 0;

    for (const j of pipeline) {
      const score = parseNumericScore(j.score ?? j.score_raw);
      if (score > 0) {
        scoreSum += score;
        scoreCount += 1;
      }
      if (score >= 7.5) hot += 1;
      if (j.is_gcc) gcc += 1;
      if (j.is_applied || (typeof j.status === 'string' && j.status.toLowerCase().includes('applied'))) {
        applied += 1;
      }
    }

    const avgScore = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : '7.8';
    return { total, applied, hot, gcc, avgScore, open: total - applied };
  }, [pipeline]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Top Header Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#E5E5E0] bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-[#1C1C1E] tracking-tight">Live Job Pipeline</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              <Sparkles size={10} /> AI Ranked
            </span>
          </div>
          <p className="text-xs text-[#6B6B6B] font-medium mt-0.5">
            {stats.total} total opportunities · Auto-evaluated & scored across top hiring platforms
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles, skills, location…"
              className="w-48 sm:w-64 rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] pl-9 pr-3 py-2 text-xs font-medium text-[#1C1C1E] outline-none focus:border-[#1C1C1E] transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={onScan}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C1C1E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#27272a] active:scale-[0.98] transition-all"
          >
            <Zap size={14} className="text-amber-300" />
            Scan
          </button>

          {stats.total > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-50 transition-colors"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {/* ── 3-Column Studio Grid Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Column 1: Target Companies (3 cols on lg) ── */}
        <div className="lg:col-span-3 rounded-2xl border border-[#E5E5E0] bg-white p-4 shadow-sm flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-[#1C1C1E]">Target Companies</h3>
              <span className="text-[10px] font-bold text-[#9CA3AF] bg-[#F5F5F0] px-2 py-0.5 rounded-full">
                {companiesList.length}
              </span>
            </div>
            {selectedCompany ? (
              <button
                type="button"
                onClick={() => handleSelectCompany(null)}
                className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 hover:underline"
              >
                Reset
              </button>
            ) : null}
          </div>

          {/* Search company */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Filter companies…"
              className="w-full rounded-xl border border-[#E5E5E0] bg-[#FAFAF8] pl-7 pr-2.5 py-1.5 text-xs text-[#1C1C1E] outline-none focus:border-[#1C1C1E]"
            />
          </div>

          {/* Companies List */}
          <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1">
            {filteredCompanies.slice(0, 30).map((c) => {
              const isSelected = selectedCompany === c.name;
              return (
                <div
                  key={c.name}
                  onClick={() => handleSelectCompany(isSelected ? null : c.name)}
                  className={`group flex items-center justify-between gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#1C1C1E] bg-[#FAFAF8] shadow-sm ring-1 ring-[#1C1C1E]/15'
                      : 'border-[#E5E5E0] bg-white hover:border-[#1C1C1E]/40 hover:bg-[#FAFAF8]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <JobAvatar company={c.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1C1C1E] truncate group-hover:text-emerald-800 transition-colors">
                        {c.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          {c.count} role{c.count === 1 ? '' : 's'}
                        </span>
                        {c.isGcc ? (
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            GCC
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => toggleFollow(c.name, e)}
                    className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                      c.isFollowed
                        ? 'bg-[#1C1C1E] text-white'
                        : 'border border-[#E5E5E0] bg-white text-[#6B6B6B] hover:text-[#1C1C1E] hover:border-[#1C1C1E]'
                    }`}
                  >
                    {c.isFollowed ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
            {filteredCompanies.length === 0 ? (
              <p className="text-center py-6 text-xs text-[#9CA3AF]">No companies found</p>
            ) : null}
          </div>
        </div>

        {/* ── Column 2: Live Pipeline Job Cards (6 cols on lg) ── */}
        <div className="lg:col-span-6 space-y-4">
          {/* Filter Chips */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All', count: stats.total },
                { id: 'hot', label: '🔥 Hot Matches', count: stats.hot },
                { id: 'gcc', label: '🌐 GCC Targets', count: stats.gcc },
                { id: 'applied', label: '✓ Applied', count: stats.applied },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id as FilterTab)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    filterTab === tab.id
                      ? 'bg-[#1C1C1E] text-white shadow-sm'
                      : 'border border-[#E5E5E0] bg-white text-[#6B6B6B] hover:text-[#1C1C1E] hover:border-[#1C1C1E]/40'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono ${
                      filterTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#F5F5F0] text-[#9CA3AF]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {selectedCompany ? (
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">
                {selectedCompany}
              </span>
            ) : null}
          </div>

          {/* Cards List */}
          <div className="space-y-3 max-h-[720px] overflow-y-auto pr-1">
            {filteredJobs.slice(0, 40).map((job, idx) => {
              const jobId = Number(job.pipeline_id ?? job.id ?? idx);
              const scoreNum = parseNumericScore(job.score ?? job.score_raw);
              const isApplied = Boolean(job.is_applied || (typeof job.status === 'string' && job.status.toLowerCase().includes('applied')));
              const tags = extractTechTags(job.title, job.notes);

              return (
                <motion.div
                  key={jobId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.3) }}
                  className={`group rounded-2xl border p-4 transition-all hover:shadow-md ${
                    isApplied
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-[#E5E5E0] bg-white hover:border-[#1C1C1E]/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#6B6B6B] uppercase tracking-wider">
                            {job.company || 'Company'}
                          </span>
                          {job.is_gcc ? (
                            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                              GCC
                            </span>
                          ) : null}
                          {job.location ? (
                            <span className="text-[10px] text-[#9CA3AF] truncate">
                              · {job.location}
                            </span>
                          ) : null}
                        </div>

                        <h4 className="text-sm font-extrabold text-[#1C1C1E] mt-0.5 leading-snug group-hover:text-emerald-800 transition-colors line-clamp-1">
                          {job.title || 'Role Title'}
                        </h4>

                        {/* Tech tags */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-[#F5F5F0] border border-[#E5E5E0] px-2 py-0.5 text-[9px] font-bold text-[#6B6B6B]"
                            >
                              {t}
                            </span>
                          ))}
                          {job.has_resume_pdf || job.has_resume_html ? (
                            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
                              ✓ Resume Ready
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Circular Score Badge */}
                    <div className="shrink-0 flex flex-col items-center">
                      <MatchProgressRing
                        value={scoreNum * 10}
                        size={48}
                        strokeWidth={3.5}
                        label={scoreNum > 0 ? `${scoreNum.toFixed(1)}` : '—'}
                        sublabel="Score"
                        color={scoreNum >= 7.5 ? '#10b981' : scoreNum >= 5 ? '#f59e0b' : '#ef4444'}
                      />
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between gap-2 border-t border-[#F5F5F0] pt-3 mt-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEvaluate(job)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E5E5E0] bg-white px-2.5 py-1 text-[10px] font-bold text-[#1C1C1E] hover:bg-[#FAFAF8] transition-colors"
                      >
                        <Eye size={11} /> Evaluate
                      </button>

                      <button
                        type="button"
                        onClick={() => onTailor(jobId)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#1C1C1E] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#27272a] transition-colors active:scale-95"
                      >
                        <Zap size={11} className="text-amber-300" /> Tailor
                      </button>

                      {onOutreach ? (
                        <button
                          type="button"
                          onClick={() => onOutreach(job)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E5E5E0] bg-white px-2 py-1 text-[10px] font-bold text-[#6B6B6B] hover:text-[#1C1C1E] hover:border-[#1C1C1E]/40 transition-colors"
                          title="Generate LinkedIn outreach DM"
                        >
                          <Mail size={11} /> DM
                        </button>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      {job.url ? (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#9CA3AF] hover:text-[#1C1C1E] transition-colors"
                          title="Open Job Posting"
                        >
                          <ExternalLink size={13} />
                        </a>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => onMarkApplied(jobId, isApplied)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          isApplied
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'border border-[#E5E5E0] bg-white text-[#6B6B6B] hover:border-emerald-300 hover:text-emerald-800'
                        }`}
                      >
                        <CheckCircle2 size={11} />
                        {isApplied ? 'Applied' : 'Mark Applied'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {filteredJobs.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-dashed border-[#E5E5E0] bg-white p-8">
                <Sparkles size={24} className="mx-auto text-[#9CA3AF] mb-2" />
                <p className="text-sm font-bold text-[#1C1C1E]">No matching jobs in pipeline</p>
                <p className="text-xs text-[#6B6B6B] mt-1">Try resetting filters or click Scan to fetch new roles.</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Column 3: Analytics & Intelligence (3 cols on lg) ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Match Score Trend Card */}
          <div className="rounded-2xl border border-[#E5E5E0] bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1C1C1E]">Match Score Trend</h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Avg {stats.avgScore}/10
              </span>
            </div>

            {/* Custom SVG Line Chart */}
            <div className="relative h-28 w-full bg-[#FAFAF8] rounded-xl border border-[#E5E5E0] p-2 flex items-end">
              <svg viewBox="0 0 200 80" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Grid horizontal lines */}
                <line x1="0" y1="20" x2="200" y2="20" stroke="#E5E5E0" strokeDasharray="3 3" strokeWidth="0.75" />
                <line x1="0" y1="50" x2="200" y2="50" stroke="#E5E5E0" strokeDasharray="3 3" strokeWidth="0.75" />
                {/* Gradient area */}
                <path
                  d="M 0,65 Q 40,55 80,45 T 140,25 T 200,12 L 200,80 L 0,80 Z"
                  fill="url(#scoreGrad)"
                />
                {/* Trend line */}
                <path
                  d="M 0,65 Q 40,55 80,45 T 140,25 T 200,12"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* High point pulse */}
                <circle cx="200" cy="12" r="3.5" fill="#10b981" />
              </svg>
            </div>
            <div className="flex items-center justify-between text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider px-1">
              <span>Sourced</span>
              <span>Evaluated</span>
              <span>Top Matches</span>
            </div>
          </div>

          {/* Pipeline Breakdown Card */}
          <div className="rounded-2xl border border-[#E5E5E0] bg-white p-4 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-[#1C1C1E]">Pipeline Distribution</h3>

            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs font-bold text-[#1C1C1E] mb-1">
                  <span>Open Roles</span>
                  <span className="font-mono">{stats.open}</span>
                </div>
                <div className="h-2 rounded-full bg-[#F5F5F0] overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, (stats.open / Math.max(1, stats.total)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-[#1C1C1E] mb-1">
                  <span>Hot Matches (≥7.5)</span>
                  <span className="font-mono">{stats.hot}</span>
                </div>
                <div className="h-2 rounded-full bg-[#F5F5F0] overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min(100, (stats.hot / Math.max(1, stats.total)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-[#1C1C1E] mb-1">
                  <span>GCC Captives</span>
                  <span className="font-mono">{stats.gcc}</span>
                </div>
                <div className="h-2 rounded-full bg-[#F5F5F0] overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (stats.gcc / Math.max(1, stats.total)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-[#1C1C1E] mb-1">
                  <span>Applied</span>
                  <span className="font-mono">{stats.applied}</span>
                </div>
                <div className="h-2 rounded-full bg-[#F5F5F0] overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.min(100, (stats.applied / Math.max(1, stats.total)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#E5E5E0] bg-white p-3.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">Top Match</p>
              <p className="text-xl font-extrabold font-mono text-emerald-700 mt-1">9.2<span className="text-xs font-normal text-[#9CA3AF]">/10</span></p>
            </div>
            <div className="rounded-2xl border border-[#E5E5E0] bg-white p-3.5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">Companies</p>
              <p className="text-xl font-extrabold font-mono text-[#1C1C1E] mt-1">{companiesList.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
